# Advanced Logging and Error Handling

The Energy Manager IoT library includes advanced logging and error handling capabilities to help with debugging, monitoring, and diagnostics.

## Professional Logging System

The logging system provides:

- Winston-based logger with multiple log levels
- Context for each log message
- Correlation IDs for tracking related operations
- Smart formatting for objects and errors
- Simultaneous logging to console and files

### Log Levels

The library supports the following log levels, in order of priority:

- **error**: Critical errors that impact operation
- **warn**: Important warnings that don't prevent functionality
- **info**: General information about the system
- **http**: Specific HTTP/MQTT communications
- **debug**: Detailed information for development
- **trace**: Extremely detailed information for deep debugging

## Basic Usage

```typescript
import { Logger } from 'energy-manager-iot';

// Simple log
Logger.info('System initialized');

// Log with additional data
Logger.debug('Configuration loaded', {
  reportingInterval: 60,
  brokerUrl: 'mqtt://example.com'
});

// Error logging
try {
  // some operation
} catch (error) {
  Logger.error('Operation failed', error);
}
```

## Contextual Logging

```typescript
import { Logger } from 'energy-manager-iot';

// Create a module-specific logger
const deviceLogger = Logger.child('devices');

deviceLogger.info('Device registered', { deviceId: 'temp-01' });

// Add a correlation ID to track an operation
const operationLogger = deviceLogger.withCorrelationId('op-abc123');
operationLogger.debug('Starting operation');
operationLogger.info('Operation completed');
```

## Error Handling

The library provides an `EnergyManagerError` class that extends the standard `Error` with:

- Categorized error types
- Severity levels
- Unique error codes
- Structured additional data
- Correlation ID support

```typescript
import {
  EnergyManagerError,
  ErrorType,
  ErrorSeverity
} from 'energy-manager-iot';

try {
  // Some operation that might fail
} catch (error) {
  throw new EnergyManagerError(
    'Failed to connect to device',
    ErrorType.CONNECTION,
    { deviceId: 'temp-01', attempts: 3 },
    ErrorSeverity.HIGH
  );
}
```

## Error Handler

The library provides a `createErrorHandler` function to create module-specific error handlers:

```typescript
import { createErrorHandler } from 'energy-manager-iot';

const handleError = createErrorHandler('my-module');

try {
  // Some operation
} catch (error) {
  try {
    // Log and rethrow the error
    handleError(error, 'operation context', 'correlation-id');
  } catch (rethrown) {
    // Handle the rethrown error here
  }
}
```

## Performance Monitoring

Example of how to monitor operation performance:

```typescript
import { Logger } from 'energy-manager-iot';

const logger = Logger.child('performance');
const startTime = performance.now();

// Perform some operation
// ...

const duration = performance.now() - startTime;
logger.info(`Operation completed in ${duration.toFixed(2)}ms`);
```

## Complete Example

See the complete example in `examples/advanced-logging.ts` for a demonstration of all logging features.

To run the example:

```bash
npm run example:logging
```
