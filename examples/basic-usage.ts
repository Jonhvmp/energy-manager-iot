/**
 * Basic usage example of the Energy Manager IoT library
 *
 * This example demonstrates the core functionality including device registration,
 * group management, and command sending, with enhanced logging capabilities.
 */
import { EnergyManager, DeviceType, CommandType, PowerMode, Logger } from '../src';

async function basicExample() {
  // Create a module-specific logger
  const logger = Logger.child('basic-example');

  // Generate a unique operation ID for this example run
  const exampleId = 'basic-' + Math.random().toString(36).substring(2, 8);
  const exampleLogger = logger.withCorrelationId(exampleId);

  exampleLogger.info('Starting basic Energy Manager IoT example');

  // Create manager instance
  const energyManager = new EnergyManager({
    topicPrefix: 'home/devices/',
    mqttOptions: {
      clientId: 'energy-manager-example',
      clean: true
    }
  });

  // Performance tracking
  const startTime = performance.now();

  // Set up event listeners
  energyManager.on('connected', () => {
    exampleLogger.info('Connected to MQTT broker');
  });

  energyManager.on('statusUpdate', (deviceId, status) => {
    exampleLogger.info(`Status updated for ${deviceId}`, { status });
  });

  // Connect to MQTT broker (e.g., local Mosquitto)
  try {
    exampleLogger.debug('Connecting to MQTT broker');
    await energyManager.connect('mqtt://localhost:1883');

    // Register some devices
    exampleLogger.info('Registering devices');
    energyManager.registerDevice('temp-sensor-01', 'Living Room Temperature Sensor', DeviceType.SENSOR, {
      reportingInterval: 60, // every 60 seconds
      sleepThreshold: 15
    });
    exampleLogger.debug('Registered temperature sensor', { deviceId: 'temp-sensor-01' });

    energyManager.registerDevice('motion-sensor-01', 'Entrance Motion Sensor', DeviceType.SENSOR);
    energyManager.registerDevice('camera-01', 'External Camera', DeviceType.CAMERA);
    exampleLogger.debug('All devices registered successfully');

    // Create a group
    exampleLogger.info('Creating device group');
    energyManager.createGroup('living-room');

    // Add devices to the group
    exampleLogger.debug('Adding devices to group');
    energyManager.addDeviceToGroup('temp-sensor-01', 'living-room');
    energyManager.addDeviceToGroup('motion-sensor-01', 'living-room');

    // Send command to a device
    exampleLogger.info('Sending command to camera device');
    await energyManager.sendCommand('camera-01', CommandType.SET_REPORTING, { interval: 300 });

    // Put all devices in the living room into power saving mode
    exampleLogger.info('Putting living room devices to sleep');
    await energyManager.sleepGroup('living-room', 3600); // sleep for 1 hour

    // Wake up a specific device
    exampleLogger.info('Waking up temperature sensor');
    await energyManager.wakeDevice('temp-sensor-01');

    // Get group statistics
    const stats = energyManager.getGroupStatistics('living-room');
    exampleLogger.info('Statistics for living-room group', { stats });

    // Keep the application running for a while
    exampleLogger.info('Waiting for updates (60 seconds)');
    await new Promise(resolve => setTimeout(resolve, 60000));

    // Disconnect when finished
    exampleLogger.debug('Disconnecting from MQTT broker');
    await energyManager.disconnect();

    // Log performance information
    const executionTime = performance.now() - startTime;
    exampleLogger.info(`Example completed in ${executionTime.toFixed(2)}ms`);

  } catch (error) {
    exampleLogger.error('Error in example', error);
  }
}

// Run the example
basicExample();
