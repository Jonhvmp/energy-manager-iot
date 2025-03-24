import { EnergyManager, DeviceType, PowerMode, ConnectionStatus, CommandType } from '../../index';
import * as mqtt from 'mqtt';

// Este teste requer um broker MQTT local rodando na porta 1883
// Pule se não estiver disponível
const localBrokerAvailable = async (): Promise<boolean> => {
  let client: mqtt.MqttClient | undefined = undefined;
  let timeoutHandle: NodeJS.Timeout | null = null;

  try {
    return new Promise<boolean>((resolve) => {
      // Criar timeout para evitar que o teste fique preso aguardando conexão
      timeoutHandle = setTimeout(() => {
        if (client) {
          client.removeAllListeners();
          client.end(true, {}, () => resolve(false));
        } else {
          resolve(false);
        }
      }, 1000);

      // Tentar conectar
      client = mqtt.connect('mqtt://localhost:1883', {
        connectTimeout: 1000,
        reconnectPeriod: 0
      });

      client.on('connect', () => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        client?.end(true, {}, () => resolve(true));
      });

      client.on('error', () => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        client?.removeAllListeners();
        client?.end(true, {}, () => resolve(false));
      });
    });
  } catch (e) {
    if (timeoutHandle) clearTimeout(timeoutHandle);

    // Corrigir o erro de tipagem usando verificação de tipo explícita
    // e um operador de não-nulidade para garantir que TypeScript reconheça client
    if (client!) {
      const mqttClient = client as mqtt.MqttClient;
      mqttClient.removeAllListeners();
      mqttClient.end(true, {});
    }

    return false;
  }
};

describe('Integração MQTT', () => {
  let energyManager: EnergyManager;
  let testClient: mqtt.MqttClient;
  let brokerAvailable = false;

  // Verificar se o broker está disponível antes dos testes
  beforeAll(async () => {
    try {
      brokerAvailable = await localBrokerAvailable();
      if (!brokerAvailable) {
        console.warn('Broker MQTT local não disponível. Testes de integração serão ignorados.');
      }
    } catch (error) {
      console.error('Erro ao verificar disponibilidade do broker:', error);
      brokerAvailable = false;
    }
  });

  beforeEach(async () => {
    if (!brokerAvailable) {
      return;
    }
    // Criar instância do gerenciador
    energyManager = new EnergyManager({
      topicPrefix: 'test/devices/'
    });

    // Conectar ao broker
    await energyManager.connect('mqtt://localhost:1883');

    // Cliente de teste para simular dispositivos
    testClient = mqtt.connect('mqtt://localhost:1883', {
      clientId: `test-client-${Date.now()}`
    });

    // Aguardar conexão do cliente de teste
    await new Promise<void>((resolve) => {
      testClient.on('connect', () => resolve());
    });
  });

  afterEach(async () => {
    if (!brokerAvailable) {
      return;
    }
    // Limpar recursos
    if (energyManager) {
      await energyManager.disconnect();
    }
    if (testClient) {
      await new Promise<void>((resolve) => {
        testClient.end(false, {}, () => resolve());
      });
    }
  });

  test('deve atualizar status ao receber mensagem do dispositivo', async () => {
    if (!brokerAvailable) {
      return;
    }

    // Registrar dispositivo
    energyManager.registerDevice('sensor1', 'Test Sensor', DeviceType.SENSOR);

    // Configurar listener de status
    const statusUpdatePromise = new Promise<void>((resolve) => {
      energyManager.on('statusUpdate', (deviceId, status) => {
        if (deviceId === 'sensor1' && status.batteryLevel === 85) {
          resolve();
        }
      });
    });

    // Publicar mensagem de status simulando o dispositivo
    testClient.publish('test/devices/sensor1/status', JSON.stringify({
      batteryLevel: 85,
      powerMode: PowerMode.NORMAL,
      connectionStatus: ConnectionStatus.ONLINE
    }));

    // Aguardar atualização de status
    await statusUpdatePromise;

    // Verificar se o status foi atualizado
    const device = energyManager.getDevice('sensor1');
    expect(device.status).toBeDefined();
    expect(device.status?.batteryLevel).toBe(85);
    expect(device.status?.powerMode).toBe(PowerMode.NORMAL);
  }, 5000); // Timeout de 5 segundos

  test('deve enviar comando para o dispositivo', async () => {
    if (!brokerAvailable) {
      return;
    }

    // Registrar dispositivo
    energyManager.registerDevice('sensor1', 'Test Sensor', DeviceType.SENSOR);

    // Promessa para verificar recebimento do comando
    const commandReceivedPromise = new Promise<any>((resolve) => {
      testClient.subscribe('test/devices/sensor1/command', (err) => {
        if (err) {
          console.error('Erro ao assinar tópico de comando:', err);
        }
      });

      testClient.on('message', (topic, message) => {
        if (topic === 'test/devices/sensor1/command') {
          try {
            const command = JSON.parse(message.toString());
            resolve(command);
          } catch (e) {
            console.error('Erro ao analisar comando:', e);
          }
        }
      });
    });

    // Corrigido: Usando o enum CommandType em vez da string literal
    await energyManager.sendCommand('sensor1', CommandType.SLEEP, { duration: 300 });

    // Aguardar recebimento do comando
    const command = await commandReceivedPromise;

    // Verificar comando
    expect(command).toBeDefined();
    expect(command.type).toBe(CommandType.SLEEP);
    expect(command.payload).toEqual({ duration: 300 });
    expect(command.requestId).toBeDefined();
  }, 5000); // Timeout de 5 segundos
});
