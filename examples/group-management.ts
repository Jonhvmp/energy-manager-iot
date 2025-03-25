/**
 * Example of device group management
 *
 * This example demonstrates how to create groups, add devices to them,
 * and send commands to multiple devices at once using groups.
 */
import { EnergyManager, DeviceType, CommandType } from '../src';

async function groupManagementExample() {
  console.log('Starting group management example');

  // Create manager instance
  const energyManager = new EnergyManager();

  try {
    // Connect to broker
    await energyManager.connect('mqtt://localhost:1883', {
      username: 'user',
      password: 'password',
      reconnectPeriod: 3000
    });

    // Create groups for different environments
    energyManager.createGroup('kitchen');
    energyManager.createGroup('bedroom');
    energyManager.createGroup('outdoor');

    console.log('Groups created:', energyManager.getAllGroups());

    // Register devices
    console.log('Registering devices...');

    // Kitchen devices
    energyManager.registerDevice('temp-kitchen', 'Kitchen Temperature Sensor', DeviceType.SENSOR, {}, ['kitchen']);
    energyManager.registerDevice('light-kitchen', 'Kitchen Light', DeviceType.ACTUATOR, {}, ['kitchen']);

    // Bedroom devices
    energyManager.registerDevice('temp-bedroom', 'Bedroom Temperature Sensor', DeviceType.SENSOR, {}, ['bedroom']);
    energyManager.registerDevice('humidity-bedroom', 'Bedroom Humidity Sensor', DeviceType.SENSOR, {}, ['bedroom']);

    // Outdoor devices
    energyManager.registerDevice('camera-front', 'Front Camera', DeviceType.CAMERA, {}, ['outdoor']);
    energyManager.registerDevice('camera-back', 'Back Camera', DeviceType.CAMERA, {}, ['outdoor']);

    // Create a group for all sensors
    energyManager.createGroup('all-sensors');

    // Add all sensors to the sensors group
    energyManager.addDeviceToGroup('temp-kitchen', 'all-sensors');
    energyManager.addDeviceToGroup('temp-bedroom', 'all-sensors');
    energyManager.addDeviceToGroup('humidity-bedroom', 'all-sensors');

    // Check devices in each group
    console.log('\nDevices by group:');
    for (const group of energyManager.getAllGroups()) {
      const devices = energyManager.getDevicesInGroup(group);
      console.log(`Group "${group}": ${devices.length} devices`);
      devices.forEach(device => {
        console.log(`  - ${device.name} (${device.id})`);
      });
    }

    // Send commands to specific groups
    console.log('\nSending commands to groups...');

    // Reduce reporting interval for outdoor cameras
    await energyManager.sendCommandToGroup('outdoor', CommandType.SET_REPORTING, { interval: 30 });
    console.log('SET_REPORTING command sent to "outdoor" group');

    // Put all sensors in power saving mode during the night
    await energyManager.sleepGroup('all-sensors', 28800); // 8 hours
    console.log('SLEEP command sent to "all-sensors" group');

    // Remove a device from a group
    energyManager.removeDeviceFromGroup('temp-kitchen', 'all-sensors');
    console.log('\nDevice temp-kitchen removed from all-sensors group');

    // Check groups for a specific device
    const cameraFront = energyManager.getDevice('camera-front');
    console.log(`\nGroups for device ${cameraFront.name}:`, cameraFront.groups);

    // Remove a group
    energyManager.removeGroup('bedroom');
    console.log('\nGroup "bedroom" removed');
    console.log('Remaining groups:', energyManager.getAllGroups());

    // Disconnect
    await energyManager.disconnect();
    console.log('\nExample completed');

  } catch (error) {
    console.error('Error in example:', error);
  }
}

// Run the example
groupManagementExample();
