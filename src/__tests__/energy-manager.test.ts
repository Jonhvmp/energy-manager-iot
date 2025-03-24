import { EnergyManager, DeviceType, CommandType, PowerMode, ConnectionStatus } from '../index';
import * as mqtt from 'mqtt';

// Mock do cliente MQTT
jest.mock('mqtt', () => {
  const mockClient = {
    on: jest.fn(),
    end: jest.fn((force, opts, cb) => cb()),
    publish: jest.fn((topic, message, opts, cb) => cb()),
    subscribe: jest.fn((topic, opts, cb) => cb()),
    unsubscribe: jest.fn((topic, cb) => cb()),
    removeAllListeners: jest.fn()
  };

  return {
    connect: jest.fn().mockReturnValue(mockClient)
  };
});

describe('EnergyManager', () => {
  let energyManager: EnergyManager;
  let mockMqttClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    energyManager = new EnergyManager({
      topicPrefix: 'test/devices/',
      statusInterval: 1000
    });
    mockMqttClient = mqtt.connect('mqtt://localhost:1883');
  });

  // Limpar recursos após cada teste
  afterEach(async () => {
    // Parar verificação de status
    if (energyManager['statusCheckInterval']) {
      clearInterval(energyManager['statusCheckInterval']);
      energyManager['statusCheckInterval'] = undefined;
    }

    // Remover todos os listeners para evitar memory leaks
    energyManager.removeAllListeners();

    // Certificar-se de que o cliente MQTT foi encerrado
    if (mockMqttClient.removeAllListeners) {
      mockMqttClient.removeAllListeners();
    }
  });

  // Limpar todos os recursos após todos os testes
  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('Inicialização', () => {
    test('deve criar instância com propriedades padrão', () => {
      expect(energyManager).toBeDefined();
      expect(energyManager.isConnected()).toBe(false);
    });

    test('deve usar prefixo de tópico personalizado', () => {
      energyManager.setTopicPrefix('custom/prefix/');

      // Registrar um dispositivo para testar o prefixo
      energyManager.registerDevice('test-device', 'Test Device', DeviceType.SENSOR);

      // Simular conexão
      Object.defineProperty(energyManager, 'mqtt', {
        value: { isClientConnected: () => true }
      });

      // Verificar se o prefixo é usado
      expect(energyManager['topicPrefix']).toBe('custom/prefix/');
    });
  });

  describe('Gerenciamento de Dispositivos', () => {
    test('deve registrar e recuperar dispositivos', () => {
      const device = energyManager.registerDevice(
        'sensor1',
        'Temperature Sensor',
        DeviceType.SENSOR,
        { reportingInterval: 60 }
      );

      expect(device).toBeDefined();
      expect(device.id).toBe('sensor1');
      expect(device.name).toBe('Temperature Sensor');
      expect(device.type).toBe(DeviceType.SENSOR);
      expect(device.config.reportingInterval).toBe(60);

      const retrievedDevice = energyManager.getDevice('sensor1');
      expect(retrievedDevice).toEqual(device);
    });

    test('deve atualizar dispositivos', () => {
      energyManager.registerDevice('sensor1', 'Temperature Sensor', DeviceType.SENSOR);

      const updatedDevice = energyManager.updateDevice('sensor1', {
        name: 'Updated Sensor',
        config: { reportingInterval: 120 }
      });

      expect(updatedDevice.name).toBe('Updated Sensor');
      expect(updatedDevice.config.reportingInterval).toBe(120);
    });

    test('deve remover dispositivos', () => {
      energyManager.registerDevice('sensor1', 'Temperature Sensor', DeviceType.SENSOR);

      const removed = energyManager.removeDevice('sensor1');
      expect(removed).toBe(true);

      // Verificar se o dispositivo não existe mais
      expect(() => energyManager.getDevice('sensor1')).toThrow();
    });
  });

  describe('Gerenciamento de Grupos', () => {
    beforeEach(() => {
      energyManager.registerDevice('sensor1', 'Temperature Sensor', DeviceType.SENSOR);
      energyManager.registerDevice('sensor2', 'Humidity Sensor', DeviceType.SENSOR);
    });

    test('deve criar grupos', () => {
      const created = energyManager.createGroup('bedroom');
      expect(created).toBe(true);

      const groups = energyManager.getAllGroups();
      expect(groups).toContain('bedroom');
    });

    test('deve adicionar dispositivos a grupos', () => {
      energyManager.createGroup('bedroom');
      const added = energyManager.addDeviceToGroup('sensor1', 'bedroom');

      expect(added).toBe(true);

      const devices = energyManager.getDevicesInGroup('bedroom');
      expect(devices.length).toBe(1);
      expect(devices[0].id).toBe('sensor1');

      // Verificar se o grupo está no dispositivo
      const device = energyManager.getDevice('sensor1');
      expect(device.groups).toContain('bedroom');
    });

    test('deve remover dispositivos de grupos', () => {
      energyManager.createGroup('bedroom');
      energyManager.addDeviceToGroup('sensor1', 'bedroom');

      const removed = energyManager.removeDeviceFromGroup('sensor1', 'bedroom');
      expect(removed).toBe(true);

      const devices = energyManager.getDevicesInGroup('bedroom');
      expect(devices.length).toBe(0);

      // Verificar se o grupo foi removido do dispositivo
      const device = energyManager.getDevice('sensor1');
      expect(device.groups).not.toContain('bedroom');
    });

    test('deve calcular estatísticas de grupo', () => {
      // Adicionar status simulado aos dispositivos
      const device1 = energyManager.getDevice('sensor1');
      const device2 = energyManager.getDevice('sensor2');

      // @ts-ignore - Acessando método privado para teste
      energyManager.registry.updateDeviceStatus('sensor1', {
        deviceId: 'sensor1',
        batteryLevel: 80,
        powerMode: PowerMode.NORMAL,
        connectionStatus: ConnectionStatus.ONLINE,
        lastSeen: Date.now()
      });

      // @ts-ignore - Acessando método privado para teste
      energyManager.registry.updateDeviceStatus('sensor2', {
        deviceId: 'sensor2',
        batteryLevel: 60,
        powerMode: PowerMode.LOW_POWER,
        connectionStatus: ConnectionStatus.ONLINE,
        lastSeen: Date.now()
      });

      // Criar grupo com os dois sensores
      energyManager.createGroup('sensors');
      energyManager.addDeviceToGroup('sensor1', 'sensors');
      energyManager.addDeviceToGroup('sensor2', 'sensors');

      // Calcular estatísticas
      const stats = energyManager.getGroupStatistics('sensors');

      // Verificar estatísticas
      expect(stats.totalDevices).toBe(2);
      expect(stats.averageBatteryLevel).toBe(70); // (80 + 60) / 2
      expect(stats.onlineCount).toBe(2);
      expect(stats.powerModeDistribution[PowerMode.NORMAL]).toBe(1);
      expect(stats.powerModeDistribution[PowerMode.LOW_POWER]).toBe(1);
    });
  });

  // Simulação básica de conexão MQTT
  describe('Conexão MQTT', () => {
    test('deve conectar ao broker MQTT', async () => {
      // Configurar mock de eventos
      let connectCallback: Function | undefined;
      mockMqttClient.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect') {
          connectCallback = callback;
        }
        return mockMqttClient; // Retornar o cliente para permitir encadeamento
      });

      // Iniciar conexão
      const connectPromise = energyManager.connect('mqtt://localhost');

      // Garantir que o callback foi definido
      expect(connectCallback).toBeDefined();

      // Simular evento de conexão bem-sucedida
      if (connectCallback) {
        connectCallback();
      }

      await connectPromise;

      expect(mqtt.connect).toHaveBeenCalledWith('mqtt://localhost', expect.any(Object));
    });

    // Novo teste para desconexão
    test('deve desconectar do broker MQTT', async () => {
      // Simular estado conectado
      Object.defineProperty(energyManager['mqtt'], 'isConnected', { value: true });

      // Espiar o método disconnect do MQTT handler
      const disconnectSpy = jest.spyOn(energyManager['mqtt'], 'disconnect')
        .mockResolvedValue();

      await energyManager.disconnect();

      expect(disconnectSpy).toHaveBeenCalled();
    });
  });
});
