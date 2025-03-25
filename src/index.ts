/**
 * Energy Manager IoT - Library for managing energy in IoT devices
 * via MQTT protocol
 *
 * @packageDocumentation
 */

// Export main classes
export { EnergyManager, EnergyManagerOptions } from './lib/energy-manager';
export { MqttHandler, MqttHandlerOptions } from './lib/mqtt-handler';
export { DeviceRegistry } from './lib/device-registry';

// Export types
export { Device, DeviceType, DeviceConfig } from './types/device';
export { DeviceStatus, PowerMode, ConnectionStatus, GroupStatistics } from './types/status';
export { DeviceCommand, CommandType, CommandResponse } from './types/command';

// Export utilities
export { EnergyManagerError, ErrorType } from './utils/error-handler';
export { default as Logger } from './utils/logger';

// Library version
export const VERSION = '1.0.0';
