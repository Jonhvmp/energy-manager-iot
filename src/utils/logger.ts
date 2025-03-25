import { warn } from 'console';
import winston from 'winston';

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
};

// Set log level based on environment
const level = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

/**
 * Log formatting configuration
 * Includes timestamp, error stack traces, and JSON output
 */
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

/**
 * Log transport configurations
 * Console for development and files for production logging
 */
const transports = [
  // Console transport for development
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize({ all: true }),
      winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: ${info.message}`
      ),
    ),
  }),
  // File transports for production
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
  }),
  new winston.transports.File({ filename: 'logs/combined.log' }),
];

// Create logger instance with Winston
const Logger = winston.createLogger({
  level,
  levels,
  format,
  transports,
});

/**
 * Format argument for logging
 * Converts objects to JSON strings when possible
 *
 * @param arg - Value to format for logging
 * @returns String representation of the value
 */
function formatArg(arg: any): string {
  if (typeof arg === 'object') {
    try {
      return JSON.stringify(arg);
    } catch (e) {
      return String(arg);
    }
  }
  return String(arg);
}

/**
 * Simplified logger interface that wraps console logging
 * This can be replaced with the full Winston implementation as needed
 */
export default {
  /**
   * Log informational message
   *
   * @param msg - Primary message to log
   * @param args - Additional data to include in the log
   */
  info: (msg: string, ...args: any[]) => {
    console.log(`${new Date().toISOString()} info: ${msg}`, ...args.map(formatArg));
  },

  /**
   * Log debug message
   *
   * @param msg - Primary message to log
   * @param args - Additional data to include in the log
   */
  debug: (msg: string, ...args: any[]) => {
    console.debug(`${new Date().toISOString()} debug: ${msg}`, ...args.map(formatArg));
  },

  /**
   * Log error message
   *
   * @param msg - Primary message to log
   * @param args - Additional data to include in the log
   */
  error: (msg: string, ...args: any[]) => {
    console.error(`${new Date().toISOString()} error: ${msg}`, ...args.map(formatArg));
  },

  /**
   * Log warning message
   *
   * @param msg - Primary message to log
   * @param args - Additional data to include in the log
   */
  warn: (msg: string, ...args: any[]) => {
    console.warn(`${new Date().toISOString()} warn: ${msg}`, ...args.map(formatArg));
  },
};
