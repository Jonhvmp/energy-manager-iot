import * as mqtt from 'mqtt';
import { EventEmitter } from 'events';
import Logger from '../utils/logger';
import { validateMqttBrokerUrl } from '../utils/validators';
import { EnergyManagerError, ErrorType } from '../utils/error-handler';

/**
 * Opções de configuração para o manipulador MQTT
 */
export interface MqttHandlerOptions {
  clientId?: string;
  clean?: boolean;
  keepalive?: number;
  reconnectPeriod?: number;
  connectTimeout?: number;
  username?: string;
  password?: string;
  ssl?: boolean;
  will?: {
    topic: string;
    payload: string;
    qos?: 0 | 1 | 2;
    retain?: boolean;
  };
}

/**
 * Manipulador de conexões MQTT
 */
export class MqttHandler extends EventEmitter {
  private client: mqtt.MqttClient | null = null;
  private options: MqttHandlerOptions;
  private brokerUrl: string = '';
  private isConnected: boolean = false;
  private topicSubscriptions: Map<string, (topic: string, payload: Buffer) => void>;

  /**
   * Cria nova instância do manipulador MQTT
   */
  constructor(options: MqttHandlerOptions = {}) {
    super();

    // Define opções padrão
    this.options = {
      clientId: `energy-manager-${Math.random().toString(16).substring(2, 10)}`,
      clean: true,
      keepalive: 60,
      reconnectPeriod: 5000,
      connectTimeout: 30000,
      ...options
    };

    this.topicSubscriptions = new Map();
  }

  /**
   * Conecta ao broker MQTT
   */
  public connect(brokerUrl: string, options?: MqttHandlerOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!validateMqttBrokerUrl(brokerUrl)) {
        reject(new EnergyManagerError('URL do broker MQTT inválida', ErrorType.VALIDATION));
        return;
      }

      this.brokerUrl = brokerUrl;

      // Mesclar opções
      const mqttOptions = { ...this.options, ...options };

      try {
        this.client = mqtt.connect(brokerUrl, mqttOptions);

        this.client.on('connect', () => {
          Logger.info(`Conectado ao broker MQTT: ${brokerUrl}`);
          this.isConnected = true;
          this.emit('connect');
          resolve();
        });

        this.client.on('message', (topic, payload) => {
          this.handleMessage(topic, payload);
        });

        this.client.on('reconnect', () => {
          Logger.warn('Tentando reconectar ao broker MQTT...');
          this.emit('reconnect');
        });

        this.client.on('error', (err) => {
          Logger.error(`Erro na conexão MQTT: ${err.message}`);
          this.emit('error', err);
          reject(new EnergyManagerError(`Falha na conexão MQTT: ${err.message}`, ErrorType.CONNECTION, err));
        });

        this.client.on('offline', () => {
          Logger.warn('Cliente MQTT desconectado');
          this.isConnected = false;
          this.emit('offline');
        });

      } catch (err: any) {
        Logger.error(`Exceção ao conectar ao MQTT: ${err.message}`);
        reject(new EnergyManagerError(`Exceção na conexão MQTT: ${err.message}`, ErrorType.CONNECTION, err));
      }
    });
  }

  /**
   * Desconecta do broker MQTT
   */
  public disconnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        resolve();
        return;
      }

      this.client.end(false, {}, (err) => {
        if (err) {
          reject(new EnergyManagerError(`Erro ao desconectar: ${err.message}`, ErrorType.CONNECTION, err));
        } else {
          Logger.info('Desconectado do broker MQTT');
          this.isConnected = false;
          this.client = null;
          resolve();
        }
      });
    });
  }

  /**
   * Publica mensagem em um tópico
   */
  public publish(topic: string, message: string | object, options?: mqtt.IClientPublishOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.isConnected) {
        reject(new EnergyManagerError('Não conectado ao broker MQTT', ErrorType.CONNECTION));
        return;
      }

      const payload = typeof message === 'string' ? message : JSON.stringify(message);

      const defaultOptions: mqtt.IClientPublishOptions = {
        qos: 1,
        retain: false
      };

      const publishOptions = { ...defaultOptions, ...options };

      this.client.publish(topic, payload, publishOptions, (err) => {
        if (err) {
          Logger.error(`Erro ao publicar em ${topic}: ${err.message}`);
          reject(new EnergyManagerError(`Falha ao publicar mensagem: ${err.message}`, ErrorType.COMMAND_FAILED, err));
        } else {
          Logger.debug(`Mensagem publicada em ${topic}: ${payload}`);
          resolve();
        }
      });
    });
  }

  /**
   * Assina um tópico
   */
  public subscribe(topic: string, callback?: (topic: string, payload: Buffer) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.isConnected) {
        reject(new EnergyManagerError('Não conectado ao broker MQTT', ErrorType.CONNECTION));
        return;
      }

      // Registrar callback se fornecido
      if (callback) {
        this.topicSubscriptions.set(topic, callback);
      }

      this.client.subscribe(topic, { qos: 1 }, (err) => {
        if (err) {
          Logger.error(`Erro ao assinar tópico ${topic}: ${err.message}`);
          reject(new EnergyManagerError(`Falha ao assinar tópico: ${err.message}`, ErrorType.COMMAND_FAILED, err));
        } else {
          Logger.info(`Assinado tópico: ${topic}`);
          resolve();
        }
      });
    });
  }

  /**
   * Cancela assinatura de um tópico
   */
  public unsubscribe(topic: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.isConnected) {
        reject(new EnergyManagerError('Não conectado ao broker MQTT', ErrorType.CONNECTION));
        return;
      }

      // Remover callback registrado
      this.topicSubscriptions.delete(topic);

      this.client.unsubscribe(topic, (err) => {
        if (err) {
          Logger.error(`Erro ao cancelar assinatura do tópico ${topic}: ${err.message}`);
          reject(new EnergyManagerError(`Falha ao cancelar assinatura: ${err.message}`, ErrorType.COMMAND_FAILED, err));
        } else {
          Logger.info(`Cancelada assinatura do tópico: ${topic}`);
          resolve();
        }
      });
    });
  }

  /**
   * Verifica se está conectado ao broker
   */
  public isClientConnected(): boolean {
    return this.isConnected && !!this.client;
  }

  /**
   * Gerencia mensagens recebidas
   */
  private handleMessage(topic: string, payload: Buffer): void {
    Logger.debug(`Mensagem recebida no tópico ${topic}`);

    // Emitir evento para todos ouvirem
    this.emit('message', topic, payload);

    // Chamar callback específico se registrado
    const callback = this.topicSubscriptions.get(topic);
    if (callback) {
      try {
        callback(topic, payload);
      } catch (err: any) {
        Logger.error(`Erro no callback para tópico ${topic}: ${err.message}`);
      }
    }
  }
}
