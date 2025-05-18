/**
 * Advanced Logging Example
 *
 * This example demonstrates the advanced logging features of the Energy Manager IoT library.
 */

import {
  EnergyManager,
  Logger,
  EnergyManagerError,
  ErrorType,
  ErrorSeverity,
  DeviceType,
  createErrorHandler
} from '../src';

// Create a module-specific logger
const moduleLogger = Logger.child('example');
moduleLogger.info('Starting advanced logging example');

// Demonstrate the use of different log levels
moduleLogger.debug('This is a debug message with detailed data', {
  timestamp: Date.now(),
  environment: process.env.NODE_ENV
});

moduleLogger.info('This is an informational message');

moduleLogger.warn('This is a warning message', {
  resourceUsage: {
    memory: process.memoryUsage().heapUsed / 1024 / 1024,
    uptime: process.uptime()
  }
});

// Demonstrate the use of correlation IDs for tracking
const operationId = 'op-' + Math.random().toString(36).substring(2, 10);
const correlatedLogger = moduleLogger.withCorrelationId(operationId);

correlatedLogger.info('Starting operation with tracking');
correlatedLogger.debug('Current operation details', { step: 'initialization' });

// Demonstrate error handling with the custom error handler
const errorLogger = Logger.child('example').withCorrelationId(operationId);

try {
  correlatedLogger.info('Attempting operation that may fail...');

  // Simulating an error
  throw new EnergyManagerError(
    'Failed to connect to remote device',
    ErrorType.CONNECTION,
    { deviceId: 'temp-sensor-01', attempts: 3 },
    ErrorSeverity.HIGH,
    operationId
  );

} catch (error) {
  // Note that we don't use handleError directly here because it rethrows the error
  // Instead, we log the error and continue program flow
  if (error instanceof EnergyManagerError) {
    // Log the error with structured data
    errorLogger.error(
      `[${error.type}] (connection operation): ${error.message}`,
      error.toJSON()
    );
    correlatedLogger.info('Error handled and logged successfully');
  } else {
    // For generic errors
    errorLogger.error(
      `[UNEXPECTED_ERROR] (unknown operation): ${(error as Error).message}`,
      { stack: (error as Error).stack }
    );
    correlatedLogger.info('Generic error handled and logged');
  }
}

/**
 * Simple utility to measure operation execution time
 */
class PerformanceTracker {
  private startTimes: Map<string, number> = new Map();
  private logger: typeof Logger;

  constructor(logger: typeof Logger) {
    this.logger = logger;
  }

  /**
   * Starts timing an operation
   *
   * @param operation - Name of the operation
   */
  start(operation: string): void {
    this.startTimes.set(operation, performance.now());
  }

  /**
   * Ends timing and logs the elapsed time
   *
   * @param operation - Name of the operation
   * @param logLevel - Log level to use (default: 'debug')
   */
  end(operation: string, logLevel: 'debug' | 'info' = 'debug'): number {
    const startTime = this.startTimes.get(operation);
    if (!startTime) {
      this.logger.warn(`Operation "${operation}" was not started before calling end()`);
      return 0;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    if (logLevel === 'info') {
      this.logger.info(`Performance [${operation}]: ${duration.toFixed(2)}ms`);
    } else {
      this.logger.debug(`Performance [${operation}]: ${duration.toFixed(2)}ms`);
    }

    return duration;
  }
}

// Example of practical use in a real scenario
async function realExampleWithLogs() {
  const requestId = 'req-' + Math.random().toString(36).substring(2, 10);
  const requestLogger = Logger.child('request-handler').withCorrelationId(requestId);
  const perfTracker = new PerformanceTracker(requestLogger);

  requestLogger.info('Processing new request');
  perfTracker.start('complete-request');

  try {
    // Creating the energy manager
    perfTracker.start('create-manager');
    const manager = new EnergyManager({
      topicPrefix: 'example/devices/',
      statusInterval: 30000
    });
    perfTracker.end('create-manager');

    requestLogger.debug('Connecting to MQTT broker');

    // We simulate a delay to demonstrate performance monitoring
    perfTracker.start('simulated-delay');
    await new Promise(resolve => setTimeout(resolve, 50));
    perfTracker.end('simulated-delay', 'info');

    // Simulating device operations
    perfTracker.start('register-device');
    requestLogger.info('Registering new device');
    manager.registerDevice('temp-01', 'Temperature Sensor', DeviceType.SENSOR, {
      reportingInterval: 60,
      sleepThreshold: 20
    });
    perfTracker.end('register-device', 'info');

    requestLogger.info('Operation completed successfully');
    perfTracker.end('complete-request', 'info');

  } catch (error) {
    perfTracker.end('complete-request');
    requestLogger.error('Failed to process request', error);
  }
}

// Example of using createErrorHandler in a practical case
async function errorHandlerExample() {
  const handlerId = 'err-' + Math.random().toString(36).substring(2, 8);
  const errorHandlerLogger = Logger.child('error-handler-demo').withCorrelationId(handlerId);

  errorHandlerLogger.info('Demonstrating the use of createErrorHandler in functions');

  // Create an error handler specific to this module
  const moduleErrorHandler = createErrorHandler('error-handler-demo');

  // Function that uses the error handler
  function operationThatMayFail() {
    try {
      errorHandlerLogger.debug('Attempting operation that may fail');
      // Simulating a failure
      const value = undefined;
      // @ts-ignore - Intentional error for demonstration
      const result = value.nonExistentProperty;
      return result;
    } catch (error) {
      // Here we use try/catch to capture the error rethrown by moduleErrorHandler
      try {
        // moduleErrorHandler logs the error and rethrows it
        moduleErrorHandler(error as Error, 'critical operation', handlerId);
      } catch (rethrown) {
        // We capture the rethrown error and do additional handling
        errorHandlerLogger.info('Error captured after logging by errorHandler');
        throw new EnergyManagerError(
          'Failure in critical operation',
          ErrorType.INTERNAL_ERROR,
          { originalError: error },
          ErrorSeverity.HIGH
        );
      }
    }
  }

  // Try to execute the operation with error
  try {
    operationThatMayFail();
  } catch (finalError) {
    errorHandlerLogger.info('Final error handled correctly', {
      errorType: finalError instanceof EnergyManagerError ? finalError.type : 'unknown'
    });
  }

  errorHandlerLogger.info('createErrorHandler example completed');
}

// Execute the practical examples
Promise.all([
  realExampleWithLogs(),
  errorHandlerExample()
]).then(() => {
  moduleLogger.info('All examples completed successfully');
}).catch(error => {
  moduleLogger.error('Failed to execute examples', error);
});
