import { EnergyManager, DeviceType, CommandType, PowerMode, ConnectionStatus } from '../index';
import { EnergyManagerError } from '../utils/error-handler';
import * as mqtt from 'mqtt';

jest.mock('mqtt', () => {
  // Reuse the mock implementation from the previous test
  // ... (similar to mqtt-handler.test.ts)
});

describe('EnergyManager - Funcionalidades Avançadas', () => {
  let energyManager: EnergyManager;

  beforeEach(() => {
    jest.clearAllMocks();
    energyManager = new EnergyManager({
      topicPrefix: 'test/devices/',
      statusInterval: 1000
    });
  });

  afterEach(() => {
    if (energyManager['statusCheckInterval']) {
      clearInterval(energyManager['statusCheckInterval']);
    }
    energyManager.removeAllListeners();
  });

  describe('Manipulação de Status', () => {
    test('deve detectar dispositivos offline após intervalo', () => {
      // Registrar dispositivo
      energyManager.registerDevice('sensor1', 'Sensor', DeviceType.SENSOR);

      // Simular conexão MQTT
      Object.defineProperty(energyManager['mqtt'], 'isClientConnected', {
        value: () => true
      });

      // Simular status inicial (online)
      const now = Date.now();
      const offlineListener = jest.fn();
      energyManager.on('deviceOffline', offlineListener);

      // @ts-ignore - Acessar método privado para teste
      energyManager.registry.updateDeviceStatus('sensor1', {
        deviceId: 'sensor1',
        batteryLevel: 80,
        powerMode: PowerMode.NORMAL,
        connectionStatus: ConnectionStatus.ONLINE,
        lastSeen: now - 3000 // 3 segundos atrás (mais que 2x o intervalo de 1000ms)
      });

      // Acionar verificação de status
      // @ts-ignore - Acessar método privado para teste
      energyManager['checkDevicesStatus']();

      // Verificar se o dispositivo foi marcado como offline
      expect(offlineListener).toHaveBeenCalledWith('sensor1');

      // Verificar novo status
      const device = energyManager.getDevice('sensor1');
      expect(device.status?.connectionStatus).toBe(ConnectionStatus.OFFLINE);
    });

    test('deve processar mensagens de status recebidas', () => {
      // Registrar dispositivo
      energyManager.registerDevice('sensor1', 'Sensor', DeviceType.SENSOR);

      // Configurar listener
      const statusUpdateListener = jest.fn();
      energyManager.on('statusUpdate', statusUpdateListener);

      // Simular recebimento de mensagem de status
      const statusMessage = JSON.stringify({
        batteryLevel: 75,
        powerMode: PowerMode.LOW_POWER,
        connectionStatus: ConnectionStatus.ONLINE
      });

      // @ts-ignore - Acessar método privado para teste
      energyManager['handleIncomingMessage']('test/devices/sensor1/status', Buffer.from(statusMessage));

      // Verificar se o evento foi emitido
      expect(statusUpdateListener).toHaveBeenCalledWith('sensor1', expect.objectContaining({
        batteryLevel: 75,
        powerMode: PowerMode.LOW_POWER,
        connectionStatus: ConnectionStatus.ONLINE
      }));
    });

    test('deve lidar com mensagens de status inválidas', () => {
      // Registrar dispositivo
      energyManager.registerDevice('sensor1', 'Sensor', DeviceType.SENSOR);

      // Configurar listener
      const statusUpdateListener = jest.fn();
      energyManager.on('statusUpdate', statusUpdateListener);

      // Simular recebimento de mensagem inválida
      // @ts-ignore - Acessar método privado para teste
      energyManager['handleIncomingMessage']('test/devices/sensor1/status', Buffer.from('invalid json'));

      // Não deve emitir evento de atualização
      expect(statusUpdateListener).not.toHaveBeenCalled();
    });
  });

  describe('Comandos Avançados', () => {
    test('deve lançar erro ao enviar comando com MQTT desconectado', async () => {
      // Registrar dispositivo
      energyManager.registerDevice('sensor1', 'Sensor', DeviceType.SENSOR);

      // Tentar enviar comando sem conectar
      await expect(
        energyManager.sendCommand('sensor1', CommandType.SLEEP)
      ).rejects.toThrow(EnergyManagerError);
    });

    test('deve enviar comando para grupo vazio sem erro', async () => {
      // Criar grupo vazio
      energyManager.createGroup('empty-group');

      // Simular conexão
      Object.defineProperty(energyManager['mqtt'], 'isClientConnected', {
        value: () => true
      });

      // Enviar comando para grupo vazio
      await energyManager.sendCommandToGroup('empty-group', CommandType.WAKE);

      // Nenhum erro deve ser lançado
    });
  });

  describe('Métodos de Conveniência', () => {
    beforeEach(() => {
      // Mockear sendCommand para testes
      energyManager.sendCommand = jest.fn().mockResolvedValue(undefined);
      energyManager.sendCommandToGroup = jest.fn().mockResolvedValue(undefined);
    });

    test('deve chamar sendCommand com parâmetros corretos ao usar sleepDevice', async () => {
      await energyManager.sleepDevice('sensor1', 3600);
      expect(energyManager.sendCommand).toHaveBeenCalledWith('sensor1', CommandType.SLEEP, { duration: 3600 });
    });

    test('deve chamar sendCommand com parâmetros corretos ao usar wakeDevice', async () => {
      await energyManager.wakeDevice('sensor1');
      expect(energyManager.sendCommand).toHaveBeenCalledWith('sensor1', CommandType.WAKE);
    });

    test('deve chamar sendCommandToGroup com parâmetros corretos ao usar sleepGroup', async () => {
      await energyManager.sleepGroup('bedroom', 3600);
      expect(energyManager.sendCommandToGroup).toHaveBeenCalledWith('bedroom', CommandType.SLEEP, { duration: 3600 });
    });

    test('deve chamar sendCommandToGroup com parâmetros corretos ao usar wakeGroup', async () => {
      await energyManager.wakeGroup('bedroom');
      expect(energyManager.sendCommandToGroup).toHaveBeenCalledWith('bedroom', CommandType.WAKE);
    });
  });
});
