/**
 * Modos de energia do dispositivo
 */
export enum PowerMode {
  NORMAL = 'normal',     // Funcionamento normal
  LOW_POWER = 'low_power', // Economia de energia
  SLEEP = 'sleep',       // Modo de hibernação
  CRITICAL = 'critical'  // Bateria crítica
}

/**
 * Status de conexão do dispositivo
 */
export enum ConnectionStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  INTERMITTENT = 'intermittent'
}

/**
 * Interface para o status do dispositivo
 */
export interface DeviceStatus {
  deviceId: string;
  batteryLevel: number;  // Nível de bateria em porcentagem
  powerMode: PowerMode;
  connectionStatus: ConnectionStatus;
  lastSeen: number;      // Timestamp do último contato
  firmwareVersion?: string;
  signalStrength?: number;
  errors?: string[];
  additionalInfo?: Record<string, any>;
}

/**
 * Interface para estatísticas de grupo de dispositivos
 */
export interface GroupStatistics {
  averageBatteryLevel: number;
  powerModeDistribution: Record<PowerMode, number>;
  onlineCount: number;
  offlineCount: number;
  totalDevices: number;
}
