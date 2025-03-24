import { DeviceCommand, CommandType } from '../types/command';
import { DeviceConfig } from '../types/device';

/**
 * Valida ID de dispositivo
 */
export function validateDeviceId(id: string): boolean {
  // ID deve ter entre 3-50 caracteres, alfanuméricos e hífens/underscores
  return /^[a-zA-Z0-9_-]{3,50}$/.test(id);
}

/**
 * Valida nome de grupo
 */
export function validateGroupName(name: string): boolean {
  // Nome deve ter entre 2-50 caracteres, sem caracteres especiais exceto espaço e hífen
  return /^[a-zA-Z0-9 -]{2,50}$/.test(name);
}

/**
 * Valida endereço do broker MQTT
 */
export function validateMqttBrokerUrl(url: string): boolean {
  // Verifica se a URL é válida para MQTT (mqtt:// ou mqtts://)
  return /^mqtt(s)?:\/\/[a-zA-Z0-9_.-]+(\:[0-9]+)?$/.test(url);
}

/**
 * Valida comando de dispositivo
 */
export function validateCommand(command: DeviceCommand): boolean {
  // Verifica se é um tipo de comando válido
  if (!Object.values(CommandType).includes(command.type)) {
    return false;
  }

  // Verifica timestamp
  if (!command.timestamp || typeof command.timestamp !== 'number') {
    return false;
  }

  // Validações específicas para cada tipo de comando
  if (command.type === CommandType.SET_REPORTING &&
      (!command.payload || typeof command.payload.interval !== 'number')) {
    return false;
  }

  return true;
}

/**
 * Valida configuração de dispositivo
 */
export function validateDeviceConfig(config: DeviceConfig): boolean {
  if (config.reportingInterval !== undefined &&
      (config.reportingInterval < 1 || config.reportingInterval > 86400)) {
    return false;
  }

  if (config.sleepThreshold !== undefined &&
      (config.sleepThreshold < 0 || config.sleepThreshold > 100)) {
    return false;
  }

  if (config.securityLevel !== undefined &&
      (config.securityLevel < 1 || config.securityLevel > 5)) {
    return false;
  }

  return true;
}
