import { DeviceStatus } from "./status";

/**
 * IoT device types
 *
 * Classification of different IoT device categories.
 */
export enum DeviceType {
  /** Device that collects environmental or system data */
  SENSOR = "sensor",

  /** Device that captures visual data */
  CAMERA = "camera",

  /** Device that controls or affects physical systems */
  ACTUATOR = "actuator",

  /** Device that connects and bridges other devices */
  GATEWAY = "gateway",

  /** General purpose device that doesn't fit other categories */
  GENERIC = "generic",
}

/**
 * Device configuration interface
 *
 * Defines configurable parameters for IoT devices.
 */
export interface DeviceConfig {
  /** Reporting interval in seconds */
  reportingInterval?: number;

  /** Battery level percentage threshold to enter sleep mode */
  sleepThreshold?: number;

  /** Whether device should automatically wake after sleep period */
  autoWake?: boolean;

  /** Security level from 1 (low) to 5 (high) */
  securityLevel?: number;
}

/**
 * Device interface
 *
 * Core representation of an IoT device in the system.
 */
export interface Device {
  /** Unique identifier for the device */
  id: string;

  /** Human-readable name of the device */
  name: string;

  /** Classification of the device */
  type: DeviceType;

  /** Current operational status of the device (if known) */
  status?: DeviceStatus;

  /** Groups this device belongs to */
  groups: string[];

  /** Device configuration settings */
  config: DeviceConfig;

  /** Timestamp when the device was first registered (epoch milliseconds) */
  createdAt: number;

  /** Timestamp when the device was last updated (epoch milliseconds) */
  updatedAt: number;
}
