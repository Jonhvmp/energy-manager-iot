/**
 * Advanced usage example of the Energy Manager IoT library
 *
 * This example demonstrates more complex features including event handling,
 * custom configurations, group commands, and advanced logging techniques.
 */
import { EnergyManager, DeviceType, CommandType, Logger } from '../src';

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

async function advancedExample() {
  // Create module-specific logger with correlation ID for traceability
  const sessionId = 'adv-' + Math.random().toString(36).substring(2, 10);
  const logger = Logger.child('advanced-example').withCorrelationId(sessionId);
  const perfTracker = new PerformanceTracker(logger);

  logger.info('Starting advanced Energy Manager IoT example', {
    sessionId,
    timestamp: new Date().toISOString()
  });

  // Track overall example execution time
  perfTracker.start('total-execution');

  // Create instance with auto-reconnect and status check every 30 seconds
  logger.debug('Creating Energy Manager instance');
  const manager = new EnergyManager({
    topicPrefix: 'advanced/devices/',
    mqttOptions: { clientId: 'advanced-manager' },
    statusInterval: 30000
  });

  // Set up listeners for relevant events with enhanced logging
  manager.on('connected', () => logger.info('Connected to MQTT broker'));

  manager.on('disconnected', () =>
    logger.warn('Disconnected from MQTT broker', { reconnecting: true })
  );

  manager.on('statusUpdate', (deviceId, status) =>
    logger.info(`Status updated for ${deviceId}`, { deviceId, status })
  );

  manager.on('deviceOffline', (deviceId) =>
    logger.warn(`Device ${deviceId} marked as offline`, { deviceId })
  );

  manager.on('commandSent', (deviceId, command) =>
    logger.debug(`Command sent to ${deviceId}`, { deviceId, command })
  );

  try {
    // Connect to local broker
    logger.info('Connecting to MQTT broker');
    perfTracker.start('mqtt-connection');
    await manager.connect('mqtt://localhost:1883');
    perfTracker.end('mqtt-connection', 'info');

    // Register advanced devices
    logger.info('Registering devices');
    perfTracker.start('device-registration');

    manager.registerDevice('sensor-advanced-01', 'Advanced Sensor 01', DeviceType.SENSOR, {
      reportingInterval: 30,
      sleepThreshold: 20
    });
    logger.debug('Registered sensor device', { deviceId: 'sensor-advanced-01' });

    manager.registerDevice('camera-advanced-01', 'Advanced Camera 01', DeviceType.CAMERA, {
      reportingInterval: 60
    });
    logger.debug('Registered camera device', { deviceId: 'camera-advanced-01' });

    perfTracker.end('device-registration');

    // Create groups and associate devices
    logger.info('Creating device group and assigning devices');
    manager.createGroup('advanced-group');
    manager.addDeviceToGroup('sensor-advanced-01', 'advanced-group');
    manager.addDeviceToGroup('camera-advanced-01', 'advanced-group');

    // Send command to update reporting interval for a device
    logger.info('Updating camera reporting interval');
    perfTracker.start('camera-command');
    await manager.sendCommand('camera-advanced-01', CommandType.SET_REPORTING, { interval: 45 });
    perfTracker.end('camera-command', 'info');

    // Send command to put all devices in the group to sleep mode
    logger.info('Setting all devices to sleep mode');
    perfTracker.start('group-sleep');
    await manager.sleepGroup('advanced-group', 3600);
    perfTracker.end('group-sleep', 'info');

    // Keep the application running for 1 minute to observe updates
    logger.info('Waiting for updates (60 seconds)');
    await new Promise(resolve => setTimeout(resolve, 60000));

    // Disconnect when finished
    logger.info('Disconnecting from MQTT broker');
    await manager.disconnect();

    perfTracker.end('total-execution', 'info');
    logger.info('Advanced example completed successfully');
  } catch (error) {
    perfTracker.end('total-execution');
    logger.error('Error in advanced example', error);
  }
}

// Run the example
advancedExample();
