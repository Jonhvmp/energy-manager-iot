/**
 * Device power modes
 *
 * Represents different energy consumption states of a device.
 */
export enum PowerMode {
  /** Normal operation mode with full functionality */
  NORMAL = "normal",

  /** Reduced power consumption mode with limited functionality */
  LOW_POWER = "low_power",

  /** Minimal power consumption hibernation mode */
  SLEEP = "sleep",

  /** Emergency mode due to critically low battery */
  CRITICAL = "critical",
}

/**
 * Device connection status
 *
 * Represents the current connectivity state of a device.
 */
export enum ConnectionStatus {
  /** Device is connected and responsive */
  ONLINE = "online",

  /** Device is disconnected or unresponsive */
  OFFLINE = "offline",

  /** Device has unstable or intermittent connectivity */
  INTERMITTENT = "intermittent",
}

/**
 * Device status interface
 *
 * Represents the current operational state of a device.
 */
export interface DeviceStatus {
  /** ID of the device this status belongs to */
  deviceId: string;

  /** Battery level as a percentage (0-100) */
  batteryLevel: number;

  /** Current power saving mode */
  powerMode: PowerMode;

  /** Current connection state */
  connectionStatus: ConnectionStatus;

  /** Timestamp of when the device was last seen (epoch milliseconds) */
  lastSeen: number;

  /** Optional firmware version string */
  firmwareVersion?: string;

  /** Optional signal strength in dBm */
  signalStrength?: number;

  /** Optional array of error messages */
  errors?: string[];

  /** Optional additional device-specific information */
  additionalInfo?: Record<string, any>;
}

/**
 * Group statistics interface
 *
 * Provides aggregated statistics for a group of devices.
 */
export interface GroupStatistics {
  /** Average battery level across all devices in the group */
  averageBatteryLevel: number;

  /** Distribution of devices across different power modes */
  powerModeDistribution: Record<PowerMode, number>;

  /** Number of devices currently online */
  onlineCount: number;

  /** Number of devices currently offline */
  offlineCount: number;

  /** Total number of devices in the group */
  totalDevices: number;
}
