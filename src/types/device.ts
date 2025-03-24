import { DeviceStatus } from './status';

/**
 * Tipo de dispositivo IoT
 */
export enum DeviceType {
  SENSOR = 'sensor',
  CAMERA = 'camera',
  ACTUATOR = 'actuator',
  GATEWAY = 'gateway',
  GENERIC = 'generic'
}

/**
 * Interface de configuração do dispositivo
 */
export interface DeviceConfig {
  reportingInterval?: number; // Intervalo de relatórios em segundos
  sleepThreshold?: number;    // Nível de bateria para entrar em modo sleep
  autoWake?: boolean;         // Acordar automaticamente após período
  securityLevel?: number;     // Nível de segurança (1-5)
}

/**
 * Interface para dispositivos IoT
 */
export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  status?: DeviceStatus;
  groups: string[];
  config: DeviceConfig;
  createdAt: number;
  updatedAt: number;
}
