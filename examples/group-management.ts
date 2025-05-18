/**
 * Example of device group management with enhanced logging
 *
 * This example demonstrates how to create groups, add devices to them,
 * and send commands to multiple devices at once using groups, all with
 * professional-grade logging capabilities.
 */
import { EnergyManager, DeviceType, CommandType, Logger } from '../src';

async function groupManagementExample() {
  // Create logger for this example with a unique correlation ID
  const groupManagementId = 'grp-' + Math.random().toString(36).substring(2, 8);
  const logger = Logger.child('group-management').withCorrelationId(groupManagementId);

  logger.info('Starting group management example');

  // Create manager instance
  const energyManager = new EnergyManager();

  try {
    // Connect to broker
    logger.info('Connecting to MQTT broker');
    await energyManager.connect('mqtt://localhost:1883', {
      username: 'user',
      password: 'password',
      reconnectPeriod: 3000
    });
    logger.info('Successfully connected to broker');

    // Create groups for different environments
    logger.info('Creating room-based device groups');
    energyManager.createGroup('kitchen');
    energyManager.createGroup('bedroom');
    energyManager.createGroup('outdoor');

    logger.info('Groups created', {
      groups: energyManager.getAllGroups()
    });

    // Register devices with structured logging
    logger.info('Registering devices');

    // Use structured logging for device registration
    const registerDevice = (id: string, name: string, type: DeviceType, groups: string[]) => {
      logger.debug('Registering device', {deviceId: id, type, groups});
      energyManager.registerDevice(id, name, type, {}, groups);
    };

    // Kitchen devices
    registerDevice('temp-kitchen', 'Kitchen Temperature Sensor', DeviceType.SENSOR, ['kitchen']);
    registerDevice('light-kitchen', 'Kitchen Light', DeviceType.ACTUATOR, ['kitchen']);

    // Bedroom devices
    registerDevice('temp-bedroom', 'Bedroom Temperature Sensor', DeviceType.SENSOR, ['bedroom']);
    registerDevice('humidity-bedroom', 'Bedroom Humidity Sensor', DeviceType.SENSOR, ['bedroom']);

    // Outdoor devices
    registerDevice('camera-front', 'Front Camera', DeviceType.CAMERA, ['outdoor']);
    registerDevice('camera-back', 'Back Camera', DeviceType.CAMERA, ['outdoor']);

    // Create a group for all sensors
    logger.info('Creating functional group for sensors');
    energyManager.createGroup('all-sensors');

    // Add all sensors to the sensors group
    logger.debug('Adding temperature and humidity sensors to all-sensors group');
    energyManager.addDeviceToGroup('temp-kitchen', 'all-sensors');
    energyManager.addDeviceToGroup('temp-bedroom', 'all-sensors');
    energyManager.addDeviceToGroup('humidity-bedroom', 'all-sensors');

    // Check devices in each group with structured logging
    logger.info('Listing devices by group');
    const groupDeviceMap: Record<string, {count: number; devices: {name: string, id: string}[]}> = {};

    for (const group of energyManager.getAllGroups()) {
      const devices = energyManager.getDevicesInGroup(group);

      groupDeviceMap[group] = {
        count: devices.length,
        devices: devices.map(device => ({
          name: device.name,
          id: device.id
        }))
      };

      logger.debug(`Group "${group}": ${devices.length} devices`);
    }

    logger.info('Group device summary', { groups: groupDeviceMap });

    // Send commands to specific groups with performance monitoring
    logger.info('Sending commands to groups');
    const commandStart = performance.now();

    // Reduce reporting interval for outdoor cameras
    logger.debug('Setting reporting interval for outdoor devices');
    await energyManager.sendCommandToGroup('outdoor', CommandType.SET_REPORTING, { interval: 30 });
    logger.info('SET_REPORTING command sent to "outdoor" group', { interval: 30 });

    // Put all sensors in power saving mode during the night
    logger.debug('Setting sleep mode for all sensors');
    await energyManager.sleepGroup('all-sensors', 28800); // 8 hours
    logger.info('SLEEP command sent to "all-sensors" group', { duration: '8 hours (28800 seconds)' });

    const commandDuration = performance.now() - commandStart;
    logger.info(`Commands executed in ${commandDuration.toFixed(2)}ms`);

    // Remove a device from a group
    logger.info('Removing device from group', { deviceId: 'temp-kitchen', group: 'all-sensors' });
    energyManager.removeDeviceFromGroup('temp-kitchen', 'all-sensors');

    // Check groups for a specific device
    const cameraFront = energyManager.getDevice('camera-front');
    logger.info(`Groups for device ${cameraFront.name}`, {
      deviceId: cameraFront.id,
      groups: cameraFront.groups
    });

    // Remove a group
    logger.info('Removing bedroom group');
    energyManager.removeGroup('bedroom');
    logger.info('Remaining groups after removal', {
      groups: energyManager.getAllGroups()
    });

    // Disconnect
    logger.debug('Disconnecting from MQTT broker');
    await energyManager.disconnect();
    logger.info('Example completed successfully');

  } catch (error) {
    logger.error('Error in group management example', error);
  }
}

// Run the example
groupManagementExample();
