import Logger from './logger';

/**
 * Custom error types for the Energy Manager system
 */
export enum ErrorType {
  CONNECTION = 'connection_error',
  VALIDATION = 'validation_error',
  AUTHENTICATION = 'authentication_error',
  DEVICE_NOT_FOUND = 'device_not_found',
  GROUP_NOT_FOUND = 'group_not_found',
  COMMAND_FAILED = 'command_failed',
  INTERNAL_ERROR = 'internal_error'
}

/**
 * Custom error class for Energy Manager errors
 *
 * Extends the standard Error class with additional properties
 * for error type categorization and contextual data.
 */
export class EnergyManagerError extends Error {
  /** Classification of the error */
  type: ErrorType;

  /** Optional data related to the error context */
  data?: any;

  /**
   * Creates a new Energy Manager error
   *
   * @param message - Human-readable error message
   * @param type - Error type classification
   * @param data - Optional data or original error
   */
  constructor(message: string, type: ErrorType, data?: any) {
    super(message);
    this.name = 'EnergyManagerError';
    this.type = type;
    this.data = data;

    // Correctly capture stack trace in TypeScript
    Object.setPrototypeOf(this, EnergyManagerError.prototype);
  }
}

/**
 * Handles errors in a consistent way across the library
 *
 * @param error - Error object to handle
 * @param context - Optional context information for the error
 * @throws The original error after logging it
 */
export function handleError(error: Error | EnergyManagerError, context?: string): never {
  // If it's our custom error, log with additional information
  if (error instanceof EnergyManagerError) {
    Logger.error(`[${error.type}]${context ? ` (${context})` : ''}: ${error.message}`, {
      errorData: error.data,
      stack: error.stack
    });
  } else {
    // For other errors
    Logger.error(`[UNEXPECTED_ERROR]${context ? ` (${context})` : ''}: ${error.message}`, {
      stack: error.stack
    });
  }

  throw error;
}
