/**
 * Energy Manager IoT - Biblioteca para gerenciamento de energia em dispositivos IoT
 * via protocolo MQTT
 */

// Exportar classe principal
export { EnergyManager, EnergyManagerOptions } from './lib/energy-manager';
export { MqttHandler, MqttHandlerOptions } from './lib/mqtt-handler';
export { DeviceRegistry } from './lib/device-registry';

// Exportar tipos
export { Device, DeviceType, DeviceConfig } from './types/device';
export { DeviceStatus, PowerMode, ConnectionStatus, GroupStatistics } from './types/status';
export { DeviceCommand, CommandType, CommandResponse } from './types/command';

// Exportar utilitários
export { EnergyManagerError, ErrorType } from './utils/error-handler';
export { default as Logger } from './utils/logger';

// Versão da biblioteca
export const VERSION = '1.0.0';
