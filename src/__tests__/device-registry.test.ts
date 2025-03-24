import { DeviceRegistry } from '../lib/device-registry';
import { DeviceType } from '../types/device';
import { PowerMode, ConnectionStatus } from '../types/status';
import { EnergyManagerError, ErrorType } from '../utils/error-handler';

// Mock do módulo MQTT para evitar conexões reais durante o teste
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

describe('DeviceRegistry', () => {
  let registry: DeviceRegistry;

  beforeEach(() => {
    registry = new DeviceRegistry();
  });

  describe('Registro de Dispositivos', () => {
    test('deve lançar erro ao registrar dispositivo com ID inválido', () => {
      // IDs inválidos: vazio, muito curto ou com caracteres não permitidos
      expect(() => registry.registerDevice('', 'Device', DeviceType.SENSOR)).toThrow(EnergyManagerError);
      expect(() => registry.registerDevice('ab', 'Device', DeviceType.SENSOR)).toThrow(EnergyManagerError);
      expect(() => registry.registerDevice('device@123', 'Device', DeviceType.SENSOR)).toThrow(EnergyManagerError);
    });

    test('deve lançar erro ao registrar dispositivo duplicado', () => {
      registry.registerDevice('sensor1', 'Sensor 1', DeviceType.SENSOR);
      expect(() => registry.registerDevice('sensor1', 'Duplicado', DeviceType.SENSOR)).toThrow(EnergyManagerError);
    });

    test('deve lançar erro com configuração inválida', () => {
      // Testar intervalos de relatório inválidos
      expect(() => registry.registerDevice(
        'sensor1',
        'Sensor 1',
        DeviceType.SENSOR,
        { reportingInterval: 0 } // Valor inválido
      )).toThrow(EnergyManagerError);

      expect(() => registry.registerDevice(
        'sensor1',
        'Sensor 1',
        DeviceType.SENSOR,
        { sleepThreshold: 101 } // Valor inválido
      )).toThrow(EnergyManagerError);
    });
  });

  describe('Gerenciamento de Grupos', () => {
    test('deve lançar erro ao usar nome de grupo inválido', () => {
      expect(() => registry.createGroup('')).toThrow(EnergyManagerError);
      expect(() => registry.createGroup('grupo@especial')).toThrow(EnergyManagerError);
    });

    test('deve lançar erro ao acessar grupo inexistente', () => {
      expect(() => registry.getDevicesInGroup('grupo-inexistente')).toThrow(EnergyManagerError);
      expect(() => registry.getDeviceIdsInGroup('grupo-inexistente')).toThrow(EnergyManagerError);
    });

    test('deve lançar erro ao remover dispositivo de grupo inexistente', () => {
      registry.registerDevice('sensor1', 'Sensor 1', DeviceType.SENSOR);
      expect(() => registry.removeDeviceFromGroup('sensor1', 'grupo-inexistente')).toThrow(EnergyManagerError);
    });
  });
});
