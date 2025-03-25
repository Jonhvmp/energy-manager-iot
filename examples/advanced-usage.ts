/**
 * Advanced usage example of the Energy Manager IoT library
 *
 * This example demonstrates more complex features including event handling,
 * custom configurations, and group commands.
 */
import { EnergyManager, DeviceType, CommandType } from '../src';

async function advancedExample() {
  console.log('Starting advanced Energy Manager IoT example');

  // Create instance with auto-reconnect and status check every 30 seconds
  const manager = new EnergyManager({
    topicPrefix: 'advanced/devices/',
    mqttOptions: { clientId: 'advanced-manager' },
    statusInterval: 30000
  });

  // Set up listeners for relevant events
  manager.on('connected', () => console.log('Connected to MQTT broker'));
  manager.on('disconnected', () => console.log('Disconnected from MQTT broker'));
  manager.on('statusUpdate', (deviceId, status) =>
    console.log(`Status updated for ${deviceId}:`, status)
  );
  manager.on('deviceOffline', (deviceId) =>
    console.log(`Device ${deviceId} marked as offline`)
  );
  manager.on('commandSent', (deviceId, command) =>
    console.log(`Command sent to ${deviceId}:`, command)
  );

  try {
    // Connect to local broker
    await manager.connect('mqtt://localhost:1883');

    // Register advanced devices
    manager.registerDevice('sensor-advanced-01', 'Advanced Sensor 01', DeviceType.SENSOR, {
      reportingInterval: 30,
      sleepThreshold: 20
    });
    manager.registerDevice('camera-advanced-01', 'Advanced Camera 01', DeviceType.CAMERA, {
      reportingInterval: 60
    });

    // Create groups and associate devices
    manager.createGroup('advanced-group');
    manager.addDeviceToGroup('sensor-advanced-01', 'advanced-group');
    manager.addDeviceToGroup('camera-advanced-01', 'advanced-group');

    // Send command to update reporting interval for a device
    await manager.sendCommand('camera-advanced-01', CommandType.SET_REPORTING, { interval: 45 });

    // Send command to put all devices in the group to sleep mode
    await manager.sleepGroup('advanced-group', 3600);

    // Keep the application running for 1 minute to observe updates
    await new Promise(resolve => setTimeout(resolve, 60000));

    // Disconnect when finished
    await manager.disconnect();
    console.log('Advanced example completed');
  } catch (error) {
    console.error('Error in advanced example:', error);
  }
}

// Run the example
advancedExample();
