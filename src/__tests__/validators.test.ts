// Garantir que o mock do MQTT seja aplicado antes de importar os validadores
import {
  validateDeviceId,
  validateGroupName,
  validateMqttBrokerUrl,
  validateCommand,
  validateDeviceConfig
} from '../utils/validators';
import { CommandType } from '../types/command';

// Garantir que o módulo MQTT está mockado
jest.mock('mqtt');

describe('Validadores', () => {
  describe('validateDeviceId', () => {
    test('deve aceitar IDs válidos', () => {
      expect(validateDeviceId('sensor1')).toBe(true);
      expect(validateDeviceId('DEVICE_123')).toBe(true);
      expect(validateDeviceId('temp-sensor-01')).toBe(true);
      expect(validateDeviceId('a'.repeat(50))).toBe(true); // 50 caracteres
    });

    test('deve rejeitar IDs inválidos', () => {
      expect(validateDeviceId('')).toBe(false); // Vazio
      expect(validateDeviceId('ab')).toBe(false); // Muito curto
      expect(validateDeviceId('device@123')).toBe(false); // Caracteres especiais
      expect(validateDeviceId('a'.repeat(51))).toBe(false); // Muito longo
    });
  });

  describe('validateGroupName', () => {
    test('deve aceitar nomes de grupo válidos', () => {
      expect(validateGroupName('living-room')).toBe(true);
      expect(validateGroupName('Room 1')).toBe(true);
      expect(validateGroupName('ab')).toBe(true); // 2 caracteres
      expect(validateGroupName('a'.repeat(50))).toBe(true); // 50 caracteres
    });

    test('deve rejeitar nomes de grupo inválidos', () => {
      expect(validateGroupName('')).toBe(false); // Vazio
      expect(validateGroupName('a')).toBe(false); // Muito curto
      expect(validateGroupName('room@home')).toBe(false); // Caracteres especiais
      expect(validateGroupName('a'.repeat(51))).toBe(false); // Muito longo
    });
  });

  describe('validateMqttBrokerUrl', () => {
    test('deve aceitar URLs de broker válidas', () => {
      expect(validateMqttBrokerUrl('mqtt://localhost')).toBe(true);
      expect(validateMqttBrokerUrl('mqtt://localhost:1883')).toBe(true);
      expect(validateMqttBrokerUrl('mqtts://broker.example.com:8883')).toBe(true);
    });

    test('deve rejeitar URLs de broker inválidas', () => {
      expect(validateMqttBrokerUrl('')).toBe(false);
      expect(validateMqttBrokerUrl('http://localhost')).toBe(false); // Protocolo errado
      expect(validateMqttBrokerUrl('mqtt://')).toBe(false); // Sem host
      expect(validateMqttBrokerUrl('mqtt://@:1883')).toBe(false); // Formato inválido
    });
  });

  describe('validateCommand', () => {
    test('deve aceitar comandos válidos', () => {
      expect(validateCommand({
        type: CommandType.SLEEP,
        timestamp: Date.now()
      })).toBe(true);

      expect(validateCommand({
        type: CommandType.SET_REPORTING,
        payload: { interval: 60 },
        timestamp: Date.now()
      })).toBe(true);
    });

    test('deve rejeitar comandos inválidos', () => {
      // Tipo inválido
      expect(validateCommand({
        // @ts-ignore - Testando propositalmente com tipo inválido
        type: 'invalid_command',
        timestamp: Date.now()
      })).toBe(false);

      // Sem timestamp
      expect(validateCommand({
        type: CommandType.SLEEP,
        // @ts-ignore - Testando sem timestamp
        timestamp: undefined
      })).toBe(false);

      // SET_REPORTING sem payload correto
      expect(validateCommand({
        type: CommandType.SET_REPORTING,
        timestamp: Date.now()
      })).toBe(false);

      expect(validateCommand({
        type: CommandType.SET_REPORTING,
        payload: { }, // Sem intervalo
        timestamp: Date.now()
      })).toBe(false);

      expect(validateCommand({
        type: CommandType.SET_REPORTING,
        payload: { interval: 'invalid' }, // Intervalo não-numérico
        timestamp: Date.now()
      })).toBe(false);
    });
  });

  describe('validateDeviceConfig', () => {
    test('deve aceitar configurações válidas', () => {
      expect(validateDeviceConfig({})).toBe(true);
      expect(validateDeviceConfig({ reportingInterval: 60 })).toBe(true);
      expect(validateDeviceConfig({ sleepThreshold: 15 })).toBe(true);
      expect(validateDeviceConfig({ securityLevel: 3 })).toBe(true);
    });

    test('deve rejeitar configurações inválidas', () => {
      expect(validateDeviceConfig({ reportingInterval: 0 })).toBe(false);
      expect(validateDeviceConfig({ reportingInterval: -1 })).toBe(false);
      expect(validateDeviceConfig({ reportingInterval: 86401 })).toBe(false);

      expect(validateDeviceConfig({ sleepThreshold: -1 })).toBe(false);
      expect(validateDeviceConfig({ sleepThreshold: 101 })).toBe(false);

      expect(validateDeviceConfig({ securityLevel: 0 })).toBe(false);
      expect(validateDeviceConfig({ securityLevel: 6 })).toBe(false);
    });
  });
});
