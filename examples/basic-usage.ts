/**
 * Basic usage example of the Energy Manager IoT library
 *
 * This example demonstrates the core functionality including device registration,
 * group management, and command sending.
 */
import { EnergyManager, DeviceType, CommandType, PowerMode } from '../src';

async function basicExample() {
  console.log('Starting basic Energy Manager IoT example');

  // Create manager instance
  const energyManager = new EnergyManager({
    topicPrefix: 'home/devices/',
    mqttOptions: {
      clientId: 'energy-manager-example',
      clean: true
    }
  });

  // Set up event listeners
  energyManager.on('connected', () => {
    console.log('Connected to MQTT broker');
  });

  energyManager.on('statusUpdate', (deviceId, status) => {
    console.log(`Status updated for ${deviceId}:`, status);
  });

  // Connect to MQTT broker (e.g., local Mosquitto)
  try {
    await energyManager.connect('mqtt://localhost:1883');

    // Register some devices
    energyManager.registerDevice('temp-sensor-01', 'Living Room Temperature Sensor', DeviceType.SENSOR, {
      reportingInterval: 60, // every 60 seconds
      sleepThreshold: 15
    });

    energyManager.registerDevice('motion-sensor-01', 'Entrance Motion Sensor', DeviceType.SENSOR);
    energyManager.registerDevice('camera-01', 'External Camera', DeviceType.CAMERA);

    // Create a group
    energyManager.createGroup('living-room');

    // Add devices to the group
    energyManager.addDeviceToGroup('temp-sensor-01', 'living-room');
    energyManager.addDeviceToGroup('motion-sensor-01', 'living-room');

    // Send command to a device
    await energyManager.sendCommand('camera-01', CommandType.SET_REPORTING, { interval: 300 });

    // Put all devices in the living room into power saving mode
    await energyManager.sleepGroup('living-room', 3600); // sleep for 1 hour

    // Wake up a specific device
    await energyManager.wakeDevice('temp-sensor-01');

    // Get group statistics
    const stats = energyManager.getGroupStatistics('living-room');
    console.log('Statistics for living-room group:', stats);

    // Keep the application running for a while
    await new Promise(resolve => setTimeout(resolve, 60000));

    // Disconnect when finished
    await energyManager.disconnect();
    console.log('Example completed');

  } catch (error) {
    console.error('Error in example:', error);
  }
}

// Run the example
basicExample();
