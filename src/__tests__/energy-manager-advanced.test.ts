import { EnergyManager, DeviceType, CommandType, PowerMode, ConnectionStatus } from '../index';
import { EnergyManagerError } from '../utils/error-handler';
import * as mqtt from 'mqtt';

// Defina o tipo para chamadas de mock
type MockCall = [string, Function];

jest.mock('mqtt', () => {
  const mockClient = {
    on: jest.fn().mockReturnThis(),
    end: jest.fn((_, __, cb) => cb && cb()),
    publish: jest.fn((_, __, ___, cb) => cb && cb()),
    subscribe: jest.fn((_, __, cb) => cb && cb()),
    unsubscribe: jest.fn((_, cb) => cb && cb()),
    removeAllListeners: jest.fn()
  };

  return {
    connect: jest.fn().mockReturnValue(mockClient)
  };
});

describe('EnergyManager - Cobertura Avançada', () => {
  let energyManager: EnergyManager;
  let mockMqttClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    energyManager = new EnergyManager({
      topicPrefix: 'advanced/test/',
      statusInterval: 500
    });
    mockMqttClient = mqtt.connect('mqtt://localhost:1883');
  });

  afterEach(() => {
    if (energyManager['statusCheckInterval']) {
      clearInterval(energyManager['statusCheckInterval']);
    }
    energyManager.removeAllListeners();
  });

  describe('Tópicos e IDs', () => {
    test('deve extrair corretamente ID de dispositivo do tópico', () => {
      // @ts-ignore - Acessar método privado
      const deviceId = energyManager['extractDeviceIdFromStatusTopic']('advanced/test/sensor123/status');
      expect(deviceId).toBe('sensor123');
    });

    test('deve retornar null para tópicos inválidos', () => {
      // @ts-ignore - Acessar método privado
      const deviceId1 = energyManager['extractDeviceIdFromStatusTopic']('wrong-prefix/sensor123/status');
      // @ts-ignore - Acessar método privado
      const deviceId2 = energyManager['extractDeviceIdFromStatusTopic']('advanced/test/sensor123/command');

      expect(deviceId1).toBeNull();
      expect(deviceId2).toBeNull();
    });

    test('deve gerar ID de solicitação único', () => {
      // @ts-ignore - Acessar método privado
      const requestId = energyManager['generateRequestId']();
      expect(requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
    });
  });

  describe('Erros em Comandos', () => {
    test('deve lançar erro ao enviar comando para dispositivo inexistente', async () => {
      // Simular conexão MQTT
      Object.defineProperty(energyManager['mqtt'], 'isClientConnected', {
        value: () => true
      });

      await expect(
        energyManager.sendCommand('non-existent', CommandType.SLEEP)
      ).rejects.toThrow(EnergyManagerError);
    });

    test('deve tratar erro ao publicar comando', async () => {
      // Registrar dispositivo
      energyManager.registerDevice('sensor1', 'Sensor', DeviceType.SENSOR);

      // Simular conexão MQTT
      Object.defineProperty(energyManager['mqtt'], 'isClientConnected', {
        value: () => true
      });

      // Simular erro de publicação
      energyManager['mqtt'].publish = jest.fn().mockRejectedValue(
        new Error('Publish failed')
      );

      await expect(
        energyManager.sendCommand('sensor1', CommandType.SLEEP)
      ).rejects.toThrow();
    });

    test('deve propagar erro ao enviar comando para grupo', async () => {
      // Criar grupo e adicionar dispositivo
      energyManager.createGroup('test-group');
      energyManager.registerDevice('sensor1', 'Sensor', DeviceType.SENSOR);
      energyManager.addDeviceToGroup('sensor1', 'test-group');

      // Simular conexão MQTT
      Object.defineProperty(energyManager['mqtt'], 'isClientConnected', {
        value: () => true
      });

      // Simular erro no envio de comando
      energyManager.sendCommand = jest.fn().mockRejectedValue(
        new Error('Command failed')
      );

      await expect(
        energyManager.sendCommandToGroup('test-group', CommandType.SLEEP)
      ).rejects.toThrow(EnergyManagerError);
    });
  });

  describe('Eventos do MQTT', () => {
    beforeEach(() => {
      // Simular conexão MQTT para testar eventos
      const connectPromise = energyManager.connect('mqtt://localhost:1883');

      // Simular callback de conexão
      const onConnect = mockMqttClient.on.mock.calls.find((c: MockCall) => c[0] === 'connect')?.[1];
      if (onConnect) onConnect();

      return connectPromise;
    });

    test('deve emitir evento de reconexão', () => {
      const reconnectListener = jest.fn();
      energyManager.on('reconnecting', reconnectListener);

      // Simular evento de reconexão
      const onReconnect = mockMqttClient.on.mock.calls.find((c: MockCall) => c[0] === 'reconnect')?.[1];
      if (onReconnect) onReconnect();

      expect(reconnectListener).toHaveBeenCalled();
    });

    test('deve emitir evento de erro', () => {
      const errorListener = jest.fn();
      energyManager.on('error', errorListener);

      const testError = new Error('Test error');

      // Simular evento de erro
      const onError = mockMqttClient.on.mock.calls.find((c: MockCall) => c[0] === 'error')?.[1];
      if (onError) onError(testError);

      expect(errorListener).toHaveBeenCalledWith(testError);
    });
  });

  describe('Assinatura de tópicos', () => {
    test('deve assinar tópicos de todos os dispositivos', async () => {
      // Registrar dispositivos
      energyManager.registerDevice('sensor1', 'Sensor 1', DeviceType.SENSOR);
      energyManager.registerDevice('sensor2', 'Sensor 2', DeviceType.SENSOR);

      // Espiar método de assinatura
      const subscribeSpy = jest.spyOn(energyManager['mqtt'], 'subscribe')
        .mockResolvedValue();

      // Simular estado conectado
      Object.defineProperty(energyManager['mqtt'], 'isClientConnected', {
        value: () => true
      });

      // @ts-ignore - Acessar método privado
      await energyManager['subscribeToAllDeviceStatuses']();

      // Deve chamar subscribe para cada dispositivo
      expect(subscribeSpy).toHaveBeenCalledTimes(2);
      expect(subscribeSpy).toHaveBeenCalledWith('advanced/test/sensor1/status');
      expect(subscribeSpy).toHaveBeenCalledWith('advanced/test/sensor2/status');
    });

    test('não deve tentar assinar quando desconectado', async () => {
      // Registrar dispositivo
      energyManager.registerDevice('sensor1', 'Sensor', DeviceType.SENSOR);

      // Espiar método de assinatura
      const subscribeSpy = jest.spyOn(energyManager['mqtt'], 'subscribe')
        .mockResolvedValue();

      // Simular estado desconectado
      Object.defineProperty(energyManager['mqtt'], 'isClientConnected', {
        value: () => false
      });

      // @ts-ignore - Acessar método privado
      await energyManager['subscribeToAllDeviceStatuses']();

      // Não deve chamar subscribe
      expect(subscribeSpy).not.toHaveBeenCalled();
    });
  });
});
