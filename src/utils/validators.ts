import { DeviceCommand, CommandType } from '../types/command';
import { DeviceConfig } from '../types/device';

/**
 * Validates a device ID
 *
 * @param id - Device ID to validate
 * @returns True if ID is valid
 *
 * @remarks
 * Valid device IDs must be 3-50 characters in length and contain only
 * alphanumeric characters, hyphens, and underscores.
 */
export function validateDeviceId(id: string): boolean {
  // ID must be 3-50 characters, alphanumeric and hyphens/underscores
  return /^[a-zA-Z0-9_-]{3,50}$/.test(id);
}

/**
 * Validates a group name
 *
 * @param name - Group name to validate
 * @returns True if name is valid
 *
 * @remarks
 * Valid group names must be 2-50 characters in length and contain only
 * alphanumeric characters, spaces, and hyphens.
 */
export function validateGroupName(name: string): boolean {
  // Name must be 2-50 characters, no special characters except spaces and hyphens
  return /^[a-zA-Z0-9 -]{2,50}$/.test(name);
}

/**
 * Validates an MQTT broker URL
 *
 * @param url - MQTT broker URL to validate
 * @returns True if URL is valid
 *
 * @remarks
 * Valid URLs must start with mqtt:// or mqtts:// and contain a properly
 * formed host name with optional port number.
 */
export function validateMqttBrokerUrl(url: string): boolean {
  // Check if URL is valid for MQTT (mqtt:// or mqtts://)
  return /^mqtt(s)?:\/\/[a-zA-Z0-9_.-]+(\:[0-9]+)?$/.test(url);
}

/**
 * Validates a device command structure
 *
 * @param command - Command object to validate
 * @returns True if command is valid
 *
 * @remarks
 * Validates that command type is valid, timestamp exists,
 * and command-specific requirements are met.
 */
export function validateCommand(command: DeviceCommand): boolean {
  // Check if command type is valid
  if (!Object.values(CommandType).includes(command.type)) {
    return false;
  }

  // Check timestamp
  if (!command.timestamp || typeof command.timestamp !== 'number') {
    return false;
  }

  // Command-specific validations
  if (command.type === CommandType.SET_REPORTING &&
      (!command.payload || typeof command.payload.interval !== 'number')) {
    return false;
  }

  return true;
}

/**
 * Validates device configuration
 *
 * @param config - Device configuration to validate
 * @returns True if configuration is valid
 *
 * @remarks
 * Validates the ranges and types of configuration parameters.
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
