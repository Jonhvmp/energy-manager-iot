/**
 * Command types that can be sent to IoT devices
 *
 * Defines the standard operations that can be performed on devices.
 */
export enum CommandType {
  /** Put device into power saving mode */
  SLEEP = 'sleep',

  /** Exit power saving mode */
  WAKE = 'wake',

  /** Restart the device */
  RESTART = 'restart',

  /** Request firmware update */
  UPDATE = 'update',

  /** Configure status reporting interval */
  SET_REPORTING = 'set_reporting_interval',

  /** Request immediate status update */
  GET_STATUS = 'get_status'
}

/**
 * Device command interface
 *
 * Structure for commands sent to IoT devices.
 */
export interface DeviceCommand {
  /** Type of command to execute */
  type: CommandType;

  /** Optional data payload for the command */
  payload?: any;

  /** Timestamp when command was issued (epoch milliseconds) */
  timestamp: number;

  /** Optional unique identifier to correlate responses */
  requestId?: string;
}

/**
 * Command response interface
 *
 * Structure for responses from devices after processing commands.
 */
export interface CommandResponse {
  /** Whether the command was successfully executed */
  success: boolean;

  /** Optional ID matching the original request */
  requestId?: string;

  /** Optional message providing additional context */
  message?: string;

  /** Timestamp when response was generated (epoch milliseconds) */
  timestamp: number;
}
