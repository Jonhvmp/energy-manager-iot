import { EventEmitter } from 'events';
import { MqttHandler, MqttHandlerOptions } from './mqtt-handler';
import { DeviceRegistry } from './device-registry';
import { Device, DeviceType, DeviceConfig } from '../types/device';
import { DeviceCommand, CommandType } from '../types/command';
import { DeviceStatus, PowerMode, ConnectionStatus, GroupStatistics } from '../types/status';
import { EnergyManagerError, ErrorType } from '../utils/error-handler';
import Logger from '../utils/logger';

/**
 * Opções de configuração para o Energy Manager
 */
export interface EnergyManagerOptions {
  topicPrefix?: string;
  mqttOptions?: MqttHandlerOptions;
  autoReconnect?: boolean;
  statusInterval?: number;
}

/**
 * Classe principal que gerencia energia de dispositivos IoT via MQTT
 */
export class EnergyManager extends EventEmitter {
  private mqtt: MqttHandler;
  private registry: DeviceRegistry;
  private topicPrefix: string;
  private statusCheckInterval?: NodeJS.Timeout;
  private autoReconnect: boolean;
  private statusUpdateInterval: number;

  /**
   * Cria nova instância do gerenciador de energia
   */
  constructor(options: EnergyManagerOptions = {}) {
    super();

    // Configurações padrão
    this.topicPrefix = options.topicPrefix || 'device/';
    this.autoReconnect = options.autoReconnect !== false;
    this.statusUpdateInterval = options.statusInterval || 60000; // 1 minuto

    // Inicializar componentes
    this.mqtt = new MqttHandler(options.mqttOptions);
    this.registry = new DeviceRegistry();

    // Configurar ouvintes de eventos MQTT
    this.setupMqttEventListeners();
  }

  /**
   * Conectar ao broker MQTT
   */
  public async connect(brokerUrl: string, options?: MqttHandlerOptions): Promise<void> {
    try {
      await this.mqtt.connect(brokerUrl, options);
      Logger.info('Energy Manager conectado ao broker MQTT');

      // Assinar tópicos de status para dispositivos existentes
      await this.subscribeToAllDeviceStatuses();

      // Iniciar verificação de status periódica
      this.startStatusCheck();

      this.emit('connected');
    } catch (error) {
      Logger.error('Falha ao conectar ao broker MQTT', error);
      throw error;
    }
  }

  /**
   * Desconectar do broker MQTT
   */
  public async disconnect(): Promise<void> {
    // Parar verificação de status
    this.stopStatusCheck();

    try {
      await this.mqtt.disconnect();
      Logger.info('Energy Manager desconectado do broker MQTT');
      this.emit('disconnected');
    } catch (error) {
      Logger.error('Erro ao desconectar do broker MQTT', error);
      throw error;
    }
  }

  /**
   * Registrar um novo dispositivo
   */
  public registerDevice(
    id: string,
    name: string,
    type: DeviceType,
    config: DeviceConfig = {},
    groups: string[] = []
  ): Device {
    const device = this.registry.registerDevice(id, name, type, config, groups);

    // Assinar tópico de status se estiver conectado
    if (this.mqtt.isClientConnected()) {
      this.subscribeToDeviceStatus(id).catch(err => {
        Logger.error(`Erro ao assinar tópico de status para ${id}`, err);
      });
    }

    this.emit('deviceRegistered', device);
    return device;
  }

  /**
   * Atualizar um dispositivo existente
   */
  public updateDevice(id: string, updates: Partial<Omit<Device, 'id' | 'createdAt'>>): Device {
    const device = this.registry.updateDevice(id, updates);
    this.emit('deviceUpdated', device);
    return device;
  }

  /**
   * Remover um dispositivo
   */
  public removeDevice(id: string): boolean {
    // Cancelar assinatura do tópico de status
    if (this.mqtt.isClientConnected()) {
      const statusTopic = this.getStatusTopic(id);
      this.mqtt.unsubscribe(statusTopic).catch(err => {
        Logger.error(`Erro ao cancelar assinatura para ${id}`, err);
      });
    }

    const result = this.registry.removeDevice(id);
    if (result) {
      this.emit('deviceRemoved', id);
    }
    return result;
  }

  /**
   * Obter um dispositivo por ID
   */
  public getDevice(id: string): Device {
    return this.registry.getDevice(id);
  }

  /**
   * Enviar comando para um dispositivo
   */
  public async sendCommand(deviceId: string, command: CommandType, payload?: any): Promise<void> {
    if (!this.registry.hasDevice(deviceId)) {
      throw new EnergyManagerError(
        `Dispositivo não encontrado: ${deviceId}`,
        ErrorType.DEVICE_NOT_FOUND
      );
    }

    if (!this.mqtt.isClientConnected()) {
      throw new EnergyManagerError(
        'Não conectado ao broker MQTT',
        ErrorType.CONNECTION
      );
    }

    const commandTopic = this.getCommandTopic(deviceId);
    const commandObject: DeviceCommand = {
      type: command,
      payload,
      timestamp: Date.now(),
      requestId: this.generateRequestId()
    };

    try {
      await this.mqtt.publish(commandTopic, commandObject, { qos: 1 });
      Logger.info(`Comando ${command} enviado para ${deviceId}`);
      this.emit('commandSent', deviceId, commandObject);
    } catch (error) {
      Logger.error(`Falha ao enviar comando para ${deviceId}`, error);
      throw error;
    }
  }

  /**
   * Enviar comando para um grupo de dispositivos
   */
  public async sendCommandToGroup(groupName: string, command: CommandType, payload?: any): Promise<void> {
    const deviceIds = this.registry.getDeviceIdsInGroup(groupName);

    if (deviceIds.length === 0) {
      Logger.warn(`Grupo ${groupName} não tem dispositivos`);
      return;
    }

    const promises: Promise<void>[] = [];
    for (const deviceId of deviceIds) {
      promises.push(this.sendCommand(deviceId, command, payload));
    }

    try {
      await Promise.all(promises);
      Logger.info(`Comando ${command} enviado para o grupo ${groupName} (${deviceIds.length} dispositivos)`);
    } catch (error) {
      Logger.error(`Erro ao enviar comando para o grupo ${groupName}`, error);
      throw new EnergyManagerError(
        `Falha ao enviar comando para o grupo ${groupName}`,
        ErrorType.COMMAND_FAILED,
        error
      );
    }
  }

  /**
   * Criar um novo grupo
   */
  public createGroup(name: string): boolean {
    return this.registry.createGroup(name);
  }

  /**
   * Adicionar dispositivo a um grupo
   */
  public addDeviceToGroup(deviceId: string, groupName: string): boolean {
    return this.registry.addDeviceToGroup(deviceId, groupName);
  }

  /**
   * Remover dispositivo de um grupo
   */
  public removeDeviceFromGroup(deviceId: string, groupName: string): boolean {
    return this.registry.removeDeviceFromGroup(deviceId, groupName);
  }

  /**
   * Remover um grupo
   */
  public removeGroup(name: string): boolean {
    return this.registry.removeGroup(name);
  }

  /**
   * Obter dispositivos em um grupo
   */
  public getDevicesInGroup(groupName: string): Device[] {
    return this.registry.getDevicesInGroup(groupName);
  }

  /**
   * Obter estatísticas de um grupo de dispositivos
   */
  public getGroupStatistics(groupName: string): GroupStatistics {
    const devices = this.registry.getDevicesInGroup(groupName);

    // Inicializar estatísticas
    const statistics: GroupStatistics = {
      averageBatteryLevel: 0,
      powerModeDistribution: {
        [PowerMode.NORMAL]: 0,
        [PowerMode.LOW_POWER]: 0,
        [PowerMode.SLEEP]: 0,
        [PowerMode.CRITICAL]: 0
      },
      onlineCount: 0,
      offlineCount: 0,
      totalDevices: devices.length
    };

    // Se não houver dispositivos, retornar estatísticas vazias
    if (devices.length === 0) {
      return statistics;
    }

    // Calcular estatísticas
    let batterySum = 0;
    let batteryCount = 0;

    for (const device of devices) {
      // Contar dispositivos online/offline
      if (device.status) {
        if (device.status.connectionStatus === ConnectionStatus.ONLINE) {
          statistics.onlineCount++;
        } else {
          statistics.offlineCount++;
        }

        // Adicionar ao modo de energia
        if (device.status.powerMode) {
          statistics.powerModeDistribution[device.status.powerMode]++;
        }

        // Adicionar ao cálculo de bateria média
        if (typeof device.status.batteryLevel === 'number') {
          batterySum += device.status.batteryLevel;
          batteryCount++;
        }
      } else {
        statistics.offlineCount++;
      }
    }

    // Calcular média de bateria
    statistics.averageBatteryLevel = batteryCount > 0 ? batterySum / batteryCount : 0;

    return statistics;
  }

  /**
   * Definir prefixo de tópico
   */
  public setTopicPrefix(prefix: string): void {
    // Verificar se o prefixo termina com /
    if (!prefix.endsWith('/')) {
      prefix = prefix + '/';
    }

    // Se o prefixo mudou e estamos conectados, reinscrever em todos os tópicos
    const resubscribe = prefix !== this.topicPrefix && this.mqtt.isClientConnected();

    this.topicPrefix = prefix;
    Logger.info(`Prefixo de tópico definido para: ${prefix}`);

    if (resubscribe) {
      this.subscribeToAllDeviceStatuses().catch(err => {
        Logger.error('Erro ao reinscrever nos tópicos de status', err);
      });
    }
  }

  /**
   * Verificar se está conectado
   */
  public isConnected(): boolean {
    return this.mqtt.isClientConnected();
  }

  /**
   * Obter todos os dispositivos
   */
  public getAllDevices(): Device[] {
    return this.registry.getAllDevices();
  }

  /**
   * Obter todos os grupos
   */
  public getAllGroups(): string[] {
    return this.registry.getAllGroups();
  }

  /**
   * Colocar dispositivo em modo de economia de energia
   */
  public async sleepDevice(deviceId: string, duration?: number): Promise<void> {
    await this.sendCommand(deviceId, CommandType.SLEEP, { duration });
  }

  /**
   * Acordar dispositivo do modo de economia
   */
  public async wakeDevice(deviceId: string): Promise<void> {
    await this.sendCommand(deviceId, CommandType.WAKE);
  }

  /**
   * Colocar grupo em modo de economia de energia
   */
  public async sleepGroup(groupName: string, duration?: number): Promise<void> {
    await this.sendCommandToGroup(groupName, CommandType.SLEEP, { duration });
  }

  /**
   * Acordar grupo do modo de economia
   */
  public async wakeGroup(groupName: string): Promise<void> {
    await this.sendCommandToGroup(groupName, CommandType.WAKE);
  }

  /**
   * Configurar listeners de eventos MQTT
   */
  private setupMqttEventListeners(): void {
    this.mqtt.on('message', (topic: string, message: Buffer) => {
      this.handleIncomingMessage(topic, message);
    });

    this.mqtt.on('reconnect', () => {
      this.emit('reconnecting');
    });

    this.mqtt.on('offline', () => {
      this.emit('disconnected');
    });

    this.mqtt.on('error', (error: Error) => {
      this.emit('error', error);
    });
  }

  /**
   * Processar mensagens recebidas
   */
  private handleIncomingMessage(topic: string, message: Buffer): void {
    // Verificar se é um tópico de status
    const deviceId = this.extractDeviceIdFromStatusTopic(topic);
    if (!deviceId) {
      return;
    }

    try {
      // Analisar a mensagem como JSON
      const statusData = JSON.parse(message.toString());

      // Verificar se é um dispositivo registrado
      if (this.registry.hasDevice(deviceId)) {
        // Atualizar status do dispositivo
        const device = this.registry.updateDeviceStatus(deviceId, {
          deviceId,
          ...statusData,
          lastSeen: Date.now()
        });

        // Emitir evento de atualização de status
        this.emit('statusUpdate', deviceId, device.status);

        Logger.debug(`Status atualizado para ${deviceId}: ${message.toString()}`);
      } else {
        Logger.debug(`Status recebido para dispositivo não registrado: ${deviceId}`);
      }
    } catch (err) {
      Logger.error(`Erro ao processar mensagem de status de ${deviceId}:`, err);
    }
  }

  /**
   * Extrair ID do dispositivo do tópico de status
   */
  private extractDeviceIdFromStatusTopic(topic: string): string | null {
    const prefix = this.topicPrefix;
    const suffix = '/status';

    if (topic.startsWith(prefix) && topic.endsWith(suffix)) {
      return topic.substring(prefix.length, topic.length - suffix.length);
    }

    return null;
  }

  /**
   * Obter tópico de status para um dispositivo
   */
  private getStatusTopic(deviceId: string): string {
    return `${this.topicPrefix}${deviceId}/status`;
  }

  /**
   * Obter tópico de comando para um dispositivo
   */
  private getCommandTopic(deviceId: string): string {
    return `${this.topicPrefix}${deviceId}/command`;
  }

  /**
   * Assinar tópico de status para um dispositivo
   */
  private async subscribeToDeviceStatus(deviceId: string): Promise<void> {
    const statusTopic = this.getStatusTopic(deviceId);
    await this.mqtt.subscribe(statusTopic);
  }

  /**
   * Assinar tópicos de status para todos os dispositivos
   */
  private async subscribeToAllDeviceStatuses(): Promise<void> {
    if (!this.mqtt.isClientConnected()) {
      return;
    }

    const deviceIds = this.registry.getAllDeviceIds();
    const promises: Promise<void>[] = [];

    for (const deviceId of deviceIds) {
      promises.push(this.subscribeToDeviceStatus(deviceId));
    }

    await Promise.all(promises);
    Logger.info(`Inscrito em ${deviceIds.length} tópicos de status`);
  }

  /**
   * Iniciar verificação periódica de status
   */
  private startStatusCheck(): void {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
    }

    this.statusCheckInterval = setInterval(() => {
      this.checkDevicesStatus();
    }, this.statusUpdateInterval);

    Logger.debug(`Verificação de status iniciada (intervalo: ${this.statusUpdateInterval}ms)`);
  }

  /**
   * Parar verificação periódica de status
   */
  private stopStatusCheck(): void {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = undefined;
      Logger.debug('Verificação de status parada');
    }
  }

  /**
   * Verificar status de todos os dispositivos
   */
  private checkDevicesStatus(): void {
    const devices = this.registry.getAllDevices();
    const now = Date.now();

    for (const device of devices) {
      // Verificar se temos status
      if (device.status) {
        // Verificar se o status está desatualizado (2x o intervalo de status)
        const threshold = 2 * this.statusUpdateInterval;
        if (now - device.status.lastSeen > threshold) {
          // Marcar como offline se estava online
          if (device.status.connectionStatus === ConnectionStatus.ONLINE) {
            const updatedStatus = {
              ...device.status,
              connectionStatus: ConnectionStatus.OFFLINE,
              lastSeen: device.status.lastSeen // manter o último timestamp
            };

            // Atualizar status
            this.registry.updateDeviceStatus(device.id, updatedStatus);
            this.emit('deviceOffline', device.id);

            Logger.debug(`Dispositivo marcado como offline: ${device.id}`);
          }
        }
      }
    }
  }

  /**
   * Gerar ID de solicitação único
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
