/**
 * Simulador de dispositivo IoT para testes
 *
 * Este exemplo simula um dispositivo IoT que se comunica
 * com o Energy Manager usando o protocolo MQTT.
 */
import * as mqtt from 'mqtt';
import { DeviceStatus, PowerMode, ConnectionStatus } from '../src/types/status';
import { DeviceCommand, CommandType, CommandResponse } from '../src/types/command';

interface DeviceConfig {
  id: string;
  name: string;
  batteryLevel: number;
  batteryDrainRate: number;
  reportingInterval: number;
  broker: string;
  topicPrefix: string;
  username?: string;
  password?: string;
}

class IoTDeviceSimulator {
  private client: mqtt.MqttClient | null = null;
  private config: DeviceConfig;
  private powerMode: PowerMode = PowerMode.NORMAL;
  private status: DeviceStatus;
  private reportTimer?: NodeJS.Timeout;
  private batteryTimer?: NodeJS.Timeout;

  constructor(config: DeviceConfig) {
    this.config = {
      ...{
        batteryDrainRate: 0.1,
        reportingInterval: 10000,
        topicPrefix: 'device/'
      },
      ...config
    };

    // Nota: Removida declaração não utilizada de clientId

    this.status = {
      deviceId: this.config.id,
      batteryLevel: this.config.batteryLevel,
      powerMode: PowerMode.NORMAL,
      connectionStatus: ConnectionStatus.OFFLINE,
      lastSeen: Date.now(),
      firmwareVersion: '1.0.0',
      signalStrength: -70,
      errors: []
    };
  }

  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log(`Dispositivo ${this.config.name} (${this.config.id}) conectando...`);
        this.client = mqtt.connect(this.config.broker, {
          clientId: `device-${this.config.id}-${Math.random().toString(16).substring(2, 8)}`,
          username: this.config.username,
          password: this.config.password,
          clean: true,
          reconnectPeriod: 5000
        });

        this.client.on('connect', () => {
          console.log(`Dispositivo ${this.config.id} conectado ao broker ${this.config.broker}`);
          this.status.connectionStatus = ConnectionStatus.ONLINE;

          // Assinar tópico de comando
          const commandTopic = `${this.config.topicPrefix}${this.config.id}/command`;
          this.client?.subscribe(commandTopic, { qos: 1 }, (err) => {
            if (err) {
              console.error(`Erro ao assinar tópico de comando:`, err);
            } else {
              console.log(`Assinado tópico de comando: ${commandTopic}`);
            }
          });

          // Iniciar simulação
          this.startSimulation();
          resolve();
        });

        this.client.on('message', (topic, message) => {
          this.handleCommand(topic, message);
        });

        this.client.on('error', (err) => {
          console.error(`Erro de conexão: ${err.message}`);
          reject(err);
        });

      } catch (err) {
        console.error('Erro ao conectar:', err);
        reject(err);
      }
    });
  }

  public disconnect(): Promise<void> {
    return new Promise((resolve) => {
      this.stopSimulation();

      if (this.client) {
        this.client.end(false, {}, () => {
          console.log(`Dispositivo ${this.config.id} desconectado`);
          this.status.connectionStatus = ConnectionStatus.OFFLINE;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private startSimulation(): void {
    // Iniciar envio regular de status
    this.reportTimer = setInterval(() => {
      this.reportStatus();
    }, this.config.reportingInterval);

    // Iniciar simulação de consumo de bateria
    this.batteryTimer = setInterval(() => {
      this.drainBattery();
    }, 5000);

    // Reportar status inicial
    this.reportStatus();
  }

  private stopSimulation(): void {
    if (this.reportTimer) {
      clearInterval(this.reportTimer);
    }
    if (this.batteryTimer) {
      clearInterval(this.batteryTimer);
    }
  }

  private reportStatus(): void {
    if (!this.client || this.status.connectionStatus !== ConnectionStatus.ONLINE) {
      return;
    }

    const statusTopic = `${this.config.topicPrefix}${this.config.id}/status`;

    // Atualizar timestamp
    this.status.lastSeen = Date.now();

    this.client.publish(statusTopic, JSON.stringify(this.status), { qos: 1 }, (err) => {
      if (err) {
        console.error(`Erro ao publicar status:`, err);
      } else {
        console.log(`Status publicado para ${statusTopic}: ${JSON.stringify(this.status)}`);
      }
    });
  }

  private drainBattery(): void {
    // Diferentes taxas de consumo de bateria com base no modo de energia
    let drainMultiplier = 1.0;

    switch (this.powerMode) {
      case PowerMode.LOW_POWER:
        drainMultiplier = 0.5;
        break;
      case PowerMode.SLEEP:
        drainMultiplier = 0.1;
        break;
      case PowerMode.NORMAL:
      default:
        drainMultiplier = 1.0;
    }

    // Reduzir nível de bateria
    this.status.batteryLevel = Math.max(
      0,
      this.status.batteryLevel - (this.config.batteryDrainRate * drainMultiplier)
    );

    // Se bateria estiver crítica, mudar para modo crítico
    if (this.status.batteryLevel < 10 && this.powerMode !== PowerMode.CRITICAL) {
      this.powerMode = PowerMode.CRITICAL;
      this.status.powerMode = PowerMode.CRITICAL;
      console.log(`${this.config.id}: Bateria crítica! Nível: ${this.status.batteryLevel.toFixed(1)}%`);
      this.reportStatus();
    }
  }
  private handleCommand(_topic: string, message: Buffer): void {
    try {
      const command = JSON.parse(message.toString()) as DeviceCommand;
      console.log(`${this.config.id}: Comando recebido:`, command);

      // Processar comando
      switch (command.type) {
        case CommandType.SLEEP:
          this.powerMode = PowerMode.SLEEP;
          this.status.powerMode = PowerMode.SLEEP;
          console.log(`${this.config.id}: Entrando em modo de hibernação`);

          // Se houver duração, agendar retorno ao modo normal
          if (command.payload && command.payload.duration) {
            const duration = command.payload.duration * 1000; // converter para ms
            setTimeout(() => {
              this.powerMode = PowerMode.NORMAL;
              this.status.powerMode = PowerMode.NORMAL;
              console.log(`${this.config.id}: Saindo do modo de hibernação`);
              this.reportStatus();
            }, duration);
          }
          break;

        case CommandType.WAKE:
          this.powerMode = PowerMode.NORMAL;
          this.status.powerMode = PowerMode.NORMAL;
          console.log(`${this.config.id}: Acordando para modo normal`);
          break;

        case CommandType.SET_REPORTING:
          if (command.payload && command.payload.interval) {
            const newInterval = command.payload.interval * 1000; // converter para ms
            this.config.reportingInterval = newInterval;

            // Reiniciar timer com novo intervalo
            if (this.reportTimer) {
              clearInterval(this.reportTimer);
            }
            this.reportTimer = setInterval(() => {
              this.reportStatus();
            }, this.config.reportingInterval);

            console.log(`${this.config.id}: Intervalo de relatório alterado para ${command.payload.interval}s`);
          }
          break;

        case CommandType.GET_STATUS:
          // Responder imediatamente com o status atual
          this.reportStatus();
          break;

        default:
          console.log(`${this.config.id}: Comando não reconhecido: ${command.type}`);
      }

      // Enviar resposta de comando, se houver requestId
      if (command.requestId) {
        this.sendCommandResponse(command, true);
      }

      // Atualizar status após qualquer comando
      this.reportStatus();

    } catch (err) {
      console.error(`${this.config.id}: Erro ao processar comando:`, err);
    }
  }

  private sendCommandResponse(command: DeviceCommand, success: boolean): void {
    if (!this.client) return;

    const responseTopic = `${this.config.topicPrefix}${this.config.id}/response`;

    const response: CommandResponse = {
      success,
      requestId: command.requestId,
      message: success ? 'Comando executado com sucesso' : 'Falha na execução do comando',
      timestamp: Date.now()
    };

    this.client.publish(responseTopic, JSON.stringify(response), { qos: 1 }, (err) => {
      if (err) {
        console.error(`${this.config.id}: Erro ao enviar resposta de comando:`, err);
      }
    });
  }
}

// Executar simulador
async function runSimulator() {
  // Criar dispositivos simulados
  const devices = [
    new IoTDeviceSimulator({
      id: 'temp-sensor-01',
      name: 'Sensor de Temperatura Sala',
      batteryLevel: 90,
      batteryDrainRate: 0.05,
      reportingInterval: 5000,
      broker: 'mqtt://localhost:1883',
      topicPrefix: 'home/devices/'
    }),
    new IoTDeviceSimulator({
      id: 'motion-sensor-01',
      name: 'Sensor de Movimento Entrada',
      batteryLevel: 75,
      batteryDrainRate: 0.1,
      reportingInterval: 8000,
      broker: 'mqtt://localhost:1883',
      topicPrefix: 'home/devices/'
    }),
    new IoTDeviceSimulator({
      id: 'camera-01',
      name: 'Câmera Externa',
      batteryLevel: 60,
      batteryDrainRate: 0.3,
      reportingInterval: 10000,
      broker: 'mqtt://localhost:1883',
      topicPrefix: 'home/devices/'
    })
  ];

  // Conectar todos os dispositivos
  for (const device of devices) {
    try {
      await device.connect();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Pequeno atraso entre conexões
    } catch (err) {
      console.error('Falha ao conectar dispositivo:', err);
    }
  }

  // Manter os dispositivos rodando até que o processo seja encerrado
  console.log('Simulador de dispositivos iniciado. Pressione Ctrl+C para encerrar.');

  // Tratar encerramentos
  process.on('SIGINT', async () => {
    console.log('\nDesconectando dispositivos...');
    for (const device of devices) {
      await device.disconnect();
    }
    process.exit(0);
  });
}

// Iniciar simulação
runSimulator();
