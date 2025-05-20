import { DeviceCommand, CommandType } from "../types/command";
import { DeviceConfig } from "../types/device";
import Logger from "./logger";

// Module-specific logger
const logger = Logger.child("validators");

/**
 * Validation result with details
 */
export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validates a device ID
 *
 * @param id - Device ID to validate
 * @param logResults - Whether to log validation results (default: false)
 * @returns True if ID is valid
 *
 * @remarks
 * Valid device IDs must be 3-50 characters in length and contain only
 * alphanumeric characters, hyphens, and underscores.
 */
export function validateDeviceId(id: string, logResults = false): boolean {
  // ID must be 3-50 characters, alphanumeric and hyphens/underscores
  const valid = /^[a-zA-Z0-9_-]{3,50}$/.test(id);

  if (logResults) {
    if (valid) {
      logger.debug(`Device ID validation passed: "${id}"`);
    } else {
      logger.warn(
        `Device ID validation failed: "${id}" - Must be 3-50 alphanumeric chars, hyphens, underscores`,
      );
    }
  }

  return valid;
}

/**
 * Validates a group name
 *
 * @param name - Group name to validate
 * @param logResults - Whether to log validation results (default: false)
 * @returns True if name is valid
 *
 * @remarks
 * Valid group names must be 2-50 characters in length and contain only
 * alphanumeric characters, spaces, and hyphens.
 */
export function validateGroupName(name: string, logResults = false): boolean {
  // Name must be 2-50 characters, no special characters except spaces and hyphens
  const valid = /^[a-zA-Z0-9 -]{2,50}$/.test(name);

  if (logResults) {
    if (valid) {
      logger.debug(`Group name validation passed: "${name}"`);
    } else {
      logger.warn(
        `Group name validation failed: "${name}" - Must be 2-50 chars, only alphanumeric, spaces, hyphens`,
      );
    }
  }

  return valid;
}

/**
 * Validates an MQTT broker URL
 *
 * @param url - MQTT broker URL to validate
 * @param logResults - Whether to log validation results (default: false)
 * @returns True if URL is valid
 *
 * @remarks
 * Valid URLs must start with mqtt:// or mqtts:// and contain a properly
 * formed host name with optional port number.
 */
export function validateMqttBrokerUrl(
  url: string,
  logResults = false,
): boolean {
  // Check if URL is valid for MQTT (mqtt:// or mqtts://)
  const valid = /^mqtt(s)?:\/\/[a-zA-Z0-9_.-]+(\:[0-9]+)?$/.test(url);

  if (logResults) {
    if (valid) {
      logger.debug(`MQTT broker URL validation passed: "${url}"`);
    } else {
      logger.warn(
        `MQTT broker URL validation failed: "${url}" - Must start with mqtt:// or mqtts:// and have valid hostname`,
      );
    }
  }

  return valid;
}

/**
 * Validates a device command structure
 *
 * @param command - Command object to validate
 * @param logResults - Whether to log validation results (default: false)
 * @returns Validation result with details
 *
 * @remarks
 * Validates that command type is valid, timestamp exists,
 * and command-specific requirements are met.
 */
export function validateCommandDetailed(
  command: DeviceCommand,
  logResults = false,
): ValidationResult {
  // Check if command type is valid
  if (!Object.values(CommandType).includes(command.type)) {
    const result = {
      valid: false,
      reason: `Invalid command type: "${command.type}"`,
    };

    if (logResults) {
      logger.warn(`Command validation failed: ${result.reason}`, { command });
    }

    return result;
  }

  // Check timestamp
  if (!command.timestamp || typeof command.timestamp !== "number") {
    const result = {
      valid: false,
      reason: "Missing or invalid timestamp",
    };

    if (logResults) {
      logger.warn(`Command validation failed: ${result.reason}`, { command });
    }

    return result;
  }

  // Command-specific validations
  if (
    command.type === CommandType.SET_REPORTING &&
    (!command.payload || typeof command.payload.interval !== "number")
  ) {
    const result = {
      valid: false,
      reason: "SET_REPORTING command requires payload with numeric interval",
    };

    if (logResults) {
      logger.warn(`Command validation failed: ${result.reason}`, { command });
    }

    return result;
  }

  if (logResults) {
    logger.debug(`Command validation passed: ${command.type}`, {
      type: command.type,
      requestId: command.requestId,
    });
  }

  return { valid: true };
}

/**
 * Validates a device command structure
 *
 * @param command - Command object to validate
 * @param logResults - Whether to log validation results (default: false)
 * @returns True if command is valid
 *
 * @remarks
 * Validates that command type is valid, timestamp exists,
 * and command-specific requirements are met.
 */
export function validateCommand(
  command: DeviceCommand,
  logResults = false,
): boolean {
  return validateCommandDetailed(command, logResults).valid;
}

/**
 * Validates device configuration with detailed results
 *
 * @param config - Device configuration to validate
 * @param logResults - Whether to log validation results (default: false)
 * @returns Validation result with details
 *
 * @remarks
 * Validates the ranges and types of configuration parameters.
 */
export function validateDeviceConfigDetailed(
  config: DeviceConfig,
  logResults = false,
): ValidationResult {
  if (config.reportingInterval !== undefined) {
    if (config.reportingInterval < 1 || config.reportingInterval > 86400) {
      const result = {
        valid: false,
        reason: `Invalid reportingInterval: ${config.reportingInterval} (must be between 1-86400)`,
      };

      if (logResults) {
        logger.warn(`Config validation failed: ${result.reason}`);
      }

      return result;
    }
  }

  if (config.sleepThreshold !== undefined) {
    if (config.sleepThreshold < 0 || config.sleepThreshold > 100) {
      const result = {
        valid: false,
        reason: `Invalid sleepThreshold: ${config.sleepThreshold} (must be between 0-100)`,
      };

      if (logResults) {
        logger.warn(`Config validation failed: ${result.reason}`);
      }

      return result;
    }
  }

  if (config.securityLevel !== undefined) {
    if (config.securityLevel < 1 || config.securityLevel > 5) {
      const result = {
        valid: false,
        reason: `Invalid securityLevel: ${config.securityLevel} (must be between 1-5)`,
      };

      if (logResults) {
        logger.warn(`Config validation failed: ${result.reason}`);
      }

      return result;
    }
  }

  if (logResults) {
    logger.debug("Device configuration validation passed", {
      configSummary: {
        reportingInterval: config.reportingInterval,
        sleepThreshold: config.sleepThreshold,
        securityLevel: config.securityLevel,
      },
    });
  }

  return { valid: true };
}

/**
 * Validates device configuration
 *
 * @param config - Device configuration to validate
 * @param logResults - Whether to log validation results (default: false)
 * @returns True if configuration is valid
 *
 * @remarks
 * Validates the ranges and types of configuration parameters.
 */
export function validateDeviceConfig(
  config: DeviceConfig,
  logResults = false,
): boolean {
  return validateDeviceConfigDetailed(config, logResults).valid;
}
