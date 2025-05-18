import winston from 'winston';
import path from 'path';
import fs from 'fs';

/**
 * Custom log levels with numeric priorities
 * Lower numbers represent higher priority levels
 */
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
  trace: 5
};

// Set log level based on environment
const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Create logs directory if it doesn't exist
const logDir = 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

/**
 * Custom formatter that intelligently formats objects and arrays
 */
const smartFormat = winston.format((info: winston.Logform.TransformableInfo) => {
  const args = info.args as any[] || [];

  // Process each argument for better formatting
  if (args && Array.isArray(args) && args.length > 0) {
    info.metadata = info.metadata || {};

    // TypeScript workaround to access arbitrary properties
    const metadata = info.metadata as Record<string, any>;
    metadata.details = args.map((arg: any) => {
      if (arg instanceof Error) {
        return {
          errorMessage: arg.message,
          stack: arg.stack,
          ...(Object.getOwnPropertyNames(arg).reduce((obj, key) => {
            obj[key] = (arg as any)[key];
            return obj;
          }, {} as Record<string, any>))
        };
      }
      return arg;
    });
  }

  return info;
});

/**
 * Log formatting configuration for console output
 */
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.colorize({ all: false }),
  winston.format.padLevels(),
  winston.format.printf((info: winston.Logform.TransformableInfo) => {
    const { timestamp, level, message } = info;
    const module = info.module as string | undefined;
    const correlationId = info.correlationId as string | undefined;

    let logMessage = `${timestamp} [${level}]`;

    if (module) {
      logMessage += ` [${module}]`;
    }

    if (correlationId) {
      logMessage += ` [${correlationId}]`;
    }

    logMessage += `: ${message}`;

    // Add metadata if present
    const metadata = info.metadata as Record<string, any> | undefined;
    if (metadata && Object.keys(metadata).length > 0) {
      if (metadata.details && Array.isArray(metadata.details)) {
        // Format each detailed item on new line
        const detailsText = metadata.details
          .map((detail: any) => typeof detail === 'object' ? JSON.stringify(detail, null, 2) : String(detail))
          .join('\n  ');
        if (detailsText.trim()) {
          logMessage += `\n  ${detailsText}`;
        }
      } else {
        // General metadata
        logMessage += ` ${JSON.stringify(metadata)}`;
      }
    }

    return logMessage;
  })
);

/**
 * Log formatting configuration for file output (JSON for machine processing)
 */
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  smartFormat(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Log transport configurations for different environments
 */
const transports = [
  // Console transport for all environments
  new winston.transports.Console({
    format: consoleFormat,
    handleExceptions: true
  }),

  // File transports for all environments
  new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    level: 'error',
    format: fileFormat,
    maxsize: 10485760, // 10MB
    maxFiles: 5,
    handleExceptions: true
  }),

  new winston.transports.File({
    filename: path.join(logDir, 'combined.log'),
    format: fileFormat,
    maxsize: 10485760, // 10MB
    maxFiles: 5
  })
];

// Create logger instance with Winston
const winstonLogger = winston.createLogger({
  level,
  levels,
  defaultMeta: { service: 'energy-manager' },
  transports,
  exitOnError: false
});

/**
 * Enhanced professional logger with contextual information support
 */
class EnhancedLogger {
  private correlationId?: string;
  private module?: string;

  /**
   * Creates a new logger instance with optional context
   *
   * @param module - Name of the module using this logger
   * @param correlationId - Optional correlation ID for tracking related log entries
   */
  constructor(module?: string, correlationId?: string) {
    this.module = module;
    this.correlationId = correlationId;
  }

  /**
   * Creates a child logger with additional context
   *
   * @param module - Name of the module using this logger
   * @param correlationId - Optional correlation ID for tracking related log entries
   * @returns A new logger instance with the specified context
   */
  child(module: string, correlationId?: string): EnhancedLogger {
    return new EnhancedLogger(
      module || this.module,
      correlationId || this.correlationId
    );
  }

  /**
   * Sets a correlation ID for tracking related log entries
   *
   * @param id - Correlation ID to use for subsequent logs
   * @returns This logger instance for method chaining
   */
  withCorrelationId(id: string): EnhancedLogger {
    this.correlationId = id;
    return this;
  }

  /**
   * Log error message with stack trace support
   *
   * @param msg - Primary message to log
   * @param args - Additional data or error objects to include
   */
  error(msg: string, ...args: any[]): void {
    winstonLogger.error(msg, {
      module: this.module,
      correlationId: this.correlationId,
      args
    });
  }

  /**
   * Log warning message
   *
   * @param msg - Primary message to log
   * @param args - Additional data to include in the log
   */
  warn(msg: string, ...args: any[]): void {
    winstonLogger.warn(msg, {
      module: this.module,
      correlationId: this.correlationId,
      args
    });
  }

  /**
   * Log informational message
   *
   * @param msg - Primary message to log
   * @param args - Additional data to include in the log
   */
  info(msg: string, ...args: any[]): void {
    winstonLogger.info(msg, {
      module: this.module,
      correlationId: this.correlationId,
      args
    });
  }

  /**
   * Log debug message for development troubleshooting
   *
   * @param msg - Primary message to log
   * @param args - Additional data to include in the log
   */
  debug(msg: string, ...args: any[]): void {
    winstonLogger.debug(msg, {
      module: this.module,
      correlationId: this.correlationId,
      args
    });
  }

  /**
   * Log detailed trace message for deep troubleshooting
   *
   * @param msg - Primary message to log
   * @param args - Additional data to include in the log
   */
  trace(msg: string, ...args: any[]): void {
    winstonLogger.log('trace', msg, {
      module: this.module,
      correlationId: this.correlationId,
      args
    });
  }

  /**
   * Log HTTP communication for API troubleshooting
   *
   * @param msg - Primary message to log
   * @param args - Additional data to include in the log
   */
  http(msg: string, ...args: any[]): void {
    winstonLogger.http(msg, {
      module: this.module,
      correlationId: this.correlationId,
      args
    });
  }
}

export default new EnhancedLogger('core');
