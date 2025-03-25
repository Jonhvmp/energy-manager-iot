import { EnergyManager, DeviceType, CommandType, PowerMode, ConnectionStatus } from '../index';
import * as mqtt from 'mqtt';

/**
 * Main tests for the EnergyManager class
 *
 * This test suite covers the core functionality of the EnergyManager,
 * including device management, group operations, and MQTT communication.
 */

// Mock MQTT client
jest.mock('mqtt', () => {
  const mockClient = {
    on: jest.fn(),
    end: jest.fn((force, opts, cb) => cb()),
    publish: jest.fn((topic, message, opts, cb) => cb()),
    subscribe: jest.fn((topic, opts, cb) => cb()),
    unsubscribe: jest.fn((topic, cb) => cb()),
    removeAllListeners: jest.fn()
  };

  return {
    connect: jest.fn().mockReturnValue(mockClient)
  };
});

describe('EnergyManager', () => {
  let energyManager: EnergyManager;
  let mockMqttClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    energyManager = new EnergyManager({
      topicPrefix: 'test/devices/',
      statusInterval: 1000
    });
    mockMqttClient = mqtt.connect('mqtt://localhost:1883');
  });

  // Clean up resources after each test
  afterEach(async () => {
    // Stop status check
    if (energyManager['statusCheckInterval']) {
      clearInterval(energyManager['statusCheckInterval']);
      energyManager['statusCheckInterval'] = undefined;
    }

    // Remove all listeners to prevent memory leaks
    energyManager.removeAllListeners();

    // Ensure MQTT client was terminated
    if (mockMqttClient.removeAllListeners) {
      mockMqttClient.removeAllListeners();
    }
  });

  // Clean up all resources after all tests
  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('Initialization', () => {
    test('should create instance with default properties', () => {
      expect(energyManager).toBeDefined();
      expect(energyManager.isConnected()).toBe(false);
    });

    test('should use custom topic prefix', () => {
      energyManager.setTopicPrefix('custom/prefix/');

      // Register a device to test the prefix
      energyManager.registerDevice('test-device', 'Test Device', DeviceType.SENSOR);

      // Simulate connection
      Object.defineProperty(energyManager, 'mqtt', {
        value: { isClientConnected: () => true }
      });

      // Verify prefix is used
      expect(energyManager['topicPrefix']).toBe('custom/prefix/');
    });
  });

  describe('Device Management', () => {
    test('should register and retrieve devices', () => {
      const device = energyManager.registerDevice(
        'sensor1',
        'Temperature Sensor',
        DeviceType.SENSOR,
        { reportingInterval: 60 }
      );

      expect(device).toBeDefined();
      expect(device.id).toBe('sensor1');
      expect(device.name).toBe('Temperature Sensor');
      expect(device.type).toBe(DeviceType.SENSOR);
      expect(device.config.reportingInterval).toBe(60);

      const retrievedDevice = energyManager.getDevice('sensor1');
      expect(retrievedDevice).toEqual(device);
    });

    test('should update devices', () => {
      energyManager.registerDevice('sensor1', 'Temperature Sensor', DeviceType.SENSOR);

      const updatedDevice = energyManager.updateDevice('sensor1', {
        name: 'Updated Sensor',
        config: { reportingInterval: 120 }
      });

      expect(updatedDevice.name).toBe('Updated Sensor');
      expect(updatedDevice.config.reportingInterval).toBe(120);
    });

    test('should remove devices', () => {
      energyManager.registerDevice('sensor1', 'Temperature Sensor', DeviceType.SENSOR);

      const removed = energyManager.removeDevice('sensor1');
      expect(removed).toBe(true);

      // Verify device no longer exists
      expect(() => energyManager.getDevice('sensor1')).toThrow();
    });
  });

  describe('Group Management', () => {
    beforeEach(() => {
      energyManager.registerDevice('sensor1', 'Temperature Sensor', DeviceType.SENSOR);
      energyManager.registerDevice('sensor2', 'Humidity Sensor', DeviceType.SENSOR);
    });

    test('should create groups', () => {
      const created = energyManager.createGroup('bedroom');
      expect(created).toBe(true);

      const groups = energyManager.getAllGroups();
      expect(groups).toContain('bedroom');
    });

    test('should add devices to groups', () => {
      energyManager.createGroup('bedroom');
      const added = energyManager.addDeviceToGroup('sensor1', 'bedroom');

      expect(added).toBe(true);

      const devices = energyManager.getDevicesInGroup('bedroom');
      expect(devices.length).toBe(1);
      expect(devices[0].id).toBe('sensor1');

      // Verify group is in device
      const device = energyManager.getDevice('sensor1');
      expect(device.groups).toContain('bedroom');
    });

    test('should remove devices from groups', () => {
      energyManager.createGroup('bedroom');
      energyManager.addDeviceToGroup('sensor1', 'bedroom');

      const removed = energyManager.removeDeviceFromGroup('sensor1', 'bedroom');
      expect(removed).toBe(true);

      const devices = energyManager.getDevicesInGroup('bedroom');
      expect(devices.length).toBe(0);

      // Verify group was removed from device
      const device = energyManager.getDevice('sensor1');
      expect(device.groups).not.toContain('bedroom');
    });

    test('should calculate group statistics', () => {
      // Add simulated status to devices
      const device1 = energyManager.getDevice('sensor1');
      const device2 = energyManager.getDevice('sensor2');

      // @ts-ignore - Accessing private method for test
      energyManager.registry.updateDeviceStatus('sensor1', {
        deviceId: 'sensor1',
        batteryLevel: 80,
        powerMode: PowerMode.NORMAL,
        connectionStatus: ConnectionStatus.ONLINE,
        lastSeen: Date.now()
      });

      // @ts-ignore - Accessing private method for test
      energyManager.registry.updateDeviceStatus('sensor2', {
        deviceId: 'sensor2',
        batteryLevel: 60,
        powerMode: PowerMode.LOW_POWER,
        connectionStatus: ConnectionStatus.ONLINE,
        lastSeen: Date.now()
      });

      // Create group with both sensors
      energyManager.createGroup('sensors');
      energyManager.addDeviceToGroup('sensor1', 'sensors');
      energyManager.addDeviceToGroup('sensor2', 'sensors');

      // Calculate statistics
      const stats = energyManager.getGroupStatistics('sensors');

      // Verify statistics
      expect(stats.totalDevices).toBe(2);
      expect(stats.averageBatteryLevel).toBe(70); // (80 + 60) / 2
      expect(stats.onlineCount).toBe(2);
      expect(stats.powerModeDistribution[PowerMode.NORMAL]).toBe(1);
      expect(stats.powerModeDistribution[PowerMode.LOW_POWER]).toBe(1);
    });
  });

  // Basic MQTT connection simulation
  describe('MQTT Connection', () => {
    test('should connect to MQTT broker', async () => {
      // Set up mock events
      let connectCallback: Function | undefined;
      mockMqttClient.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect') {
          connectCallback = callback;
        }
        return mockMqttClient; // Return client to allow chaining
      });

      // Start connection
      const connectPromise = energyManager.connect('mqtt://localhost');

      // Ensure callback was defined
      expect(connectCallback).toBeDefined();

      // Simulate successful connect event
      if (connectCallback) {
        connectCallback();
      }

      await connectPromise;

      expect(mqtt.connect).toHaveBeenCalledWith('mqtt://localhost', expect.any(Object));
    });

    // New test for disconnection
    test('should disconnect from MQTT broker', async () => {
      // Simulate connected state
      Object.defineProperty(energyManager['mqtt'], 'isConnected', { value: true });

      // Spy on MQTT handler's disconnect method
      const disconnectSpy = jest.spyOn(energyManager['mqtt'], 'disconnect')
        .mockResolvedValue();

      await energyManager.disconnect();

      expect(disconnectSpy).toHaveBeenCalled();
    });
  });
});
