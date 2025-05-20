import Logger from "./logger";

/**
 * Custom error types for the Energy Manager system
 */
export enum ErrorType {
  CONNECTION = "connection_error",
  VALIDATION = "validation_error",
  AUTHENTICATION = "authentication_error",
  DEVICE_NOT_FOUND = "device_not_found",
  GROUP_NOT_FOUND = "group_not_found",
  COMMAND_FAILED = "command_failed",
  CONFIGURATION_ERROR = "configuration_error",
  TIMEOUT_ERROR = "timeout_error",
  MESSAGE_FORMAT_ERROR = "message_format_error",
  PROTOCOL_ERROR = "protocol_error",
  PERMISSION_DENIED = "permission_denied",
  RATE_LIMIT_EXCEEDED = "rate_limit_exceeded",
  INTERNAL_ERROR = "internal_error",
}

/**
 * Error severity levels
 * Used to indicate the operational impact of an error
 */
export enum ErrorSeverity {
  /** Critical errors requiring immediate attention */
  CRITICAL = "critical",

  /** High-impact errors affecting system functionality */
  HIGH = "high",

  /** Medium-impact errors affecting specific features */
  MEDIUM = "medium",

  /** Low-impact errors with minimal functional impact */
  LOW = "low",
}

/**
 * Custom error class for Energy Manager errors
 *
 * Extends the standard Error class with additional properties
 * for error type categorization and contextual data.
 */
export class EnergyManagerError extends Error {
  /** Classification of the error */
  readonly type: ErrorType;

  /** Operational impact of the error */
  readonly severity: ErrorSeverity;

  /** Optional data related to the error context */
  readonly data?: any;

  /** Unique error code for lookup in documentation */
  readonly code: string;

  /** Timestamp when the error occurred */
  readonly timestamp: Date;

  /** Optional correlation ID for tracing related operations */
  readonly correlationId?: string;

  /**
   * Creates a new Energy Manager error
   *
   * @param message - Human-readable error message
   * @param type - Error type classification
   * @param data - Optional data or original error
   * @param severity - Operational severity of the error (defaults to MEDIUM)
   * @param correlationId - Optional correlation ID for tracing
   */
  constructor(
    message: string,
    type: ErrorType,
    data?: any,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    correlationId?: string,
  ) {
    super(message);
    this.name = "EnergyManagerError";
    this.type = type;
    this.data = data;
    this.severity = severity;
    this.timestamp = new Date();
    this.correlationId = correlationId;

    // Generate error code based on type and timestamp
    // Format: EM-{TYPE_PREFIX}-{TIMESTAMP}
    const typePrefix = type.slice(0, 4).toUpperCase();
    const timeCode = Math.floor(this.timestamp.getTime() / 1000)
      .toString(36)
      .slice(-6);
    this.code = `EM-${typePrefix}-${timeCode}`;

    // Correctly capture stack trace in TypeScript
    Object.setPrototypeOf(this, EnergyManagerError.prototype);
  }

  /**
   * Returns a structured object representation of the error
   * for logging or serialization
   *
   * @returns Structured error object
   */
  toJSON(): object {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      severity: this.severity,
      code: this.code,
      timestamp: this.timestamp.toISOString(),
      correlationId: this.correlationId,
      data: this.data,
      stack: this.stack,
    };
  }
}

/**
 * Creates a standardized error handler for a specific module
 *
 * @param moduleName - Name of the module using this error handler
 * @returns An error handler function for the specified module
 */
export function createErrorHandler(moduleName: string) {
  const moduleLogger = Logger.child(moduleName);

  return function handleModuleError(
    error: Error | EnergyManagerError,
    context?: string,
    correlationId?: string,
  ): never {
    // Create logger with correlation ID if provided
    const logger = correlationId
      ? moduleLogger.withCorrelationId(correlationId)
      : moduleLogger;

    // If it's our custom error, log with additional information
    if (error instanceof EnergyManagerError) {
      logger.error(
        `[${error.type}]${context ? ` (${context})` : ""}: ${error.message}`,
        error.toJSON(),
      );
    } else {
      // Convert standard errors to our format for consistent handling
      const wrappedError = new EnergyManagerError(
        error.message,
        ErrorType.INTERNAL_ERROR,
        { originalStack: error.stack },
        ErrorSeverity.MEDIUM,
        correlationId,
      );

      logger.error(
        `[UNEXPECTED_ERROR]${context ? ` (${context})` : ""}: ${error.message}`,
        wrappedError.toJSON(),
      );
    }

    throw error;
  };
}

/**
 * Handles errors in a consistent way across the library
 *
 * @param error - Error object to handle
 * @param context - Optional context information for the error
 * @param correlationId - Optional correlation ID for tracing
 * @throws The original error after logging it
 *
 * @deprecated Use createErrorHandler() to create a module-specific error handler instead
 */
export function handleError(
  error: Error | EnergyManagerError,
  context?: string,
  correlationId?: string,
): never {
  const logger = correlationId
    ? Logger.withCorrelationId(correlationId)
    : Logger;

  // If it's our custom error, log with additional information
  if (error instanceof EnergyManagerError) {
    logger.error(
      `[${error.type}]${context ? ` (${context})` : ""}: ${error.message}`,
      error.toJSON(),
    );
  } else {
    // For other errors
    logger.error(
      `[UNEXPECTED_ERROR]${context ? ` (${context})` : ""}: ${error.message}`,
      { stack: error.stack },
    );
  }

  throw error;
}
