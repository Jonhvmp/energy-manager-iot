import { EnergyManager, DeviceType, CommandType, PowerMode, ConnectionStatus } from '../index';
import { EnergyManagerError } from '../utils/error-handler';
import * as mqtt from 'mqtt';

jest.mock('mqtt', () => {
  // Reuse the mock implementation from the previous test
  // ... (similar to mqtt-handler.test.ts)
});

/**
 * Tests for advanced functionality of the EnergyManager class
 *
 * These tests cover edge cases and more complex scenarios like offline detection,
 * status processing, and error handling in commands.
 */
describe('EnergyManager - Advanced Features', () => {
  let energyManager: EnergyManager;

  beforeEach(() => {
    jest.clearAllMocks();
    energyManager = new EnergyManager({
      topicPrefix: 'test/devices/',
      statusInterval: 1000
    });
  });

  afterEach(() => {
    if (energyManager['statusCheckInterval']) {
      clearInterval(energyManager['statusCheckInterval']);
    }
    energyManager.removeAllListeners();
  });

  describe('Status Handling', () => {
    test('should detect offline devices after interval', () => {
      // Register device
      energyManager.registerDevice('sensor1', 'Sensor', DeviceType.SENSOR);

      // Simulate MQTT connection
      Object.defineProperty(energyManager['mqtt'], 'isClientConnected', {
        value: () => true
      });

      // Simulate initial status (online)
      const now = Date.now();
      const offlineListener = jest.fn();
      energyManager.on('deviceOffline', offlineListener);

      // @ts-ignore - Access private method for testing
      energyManager.registry.updateDeviceStatus('sensor1', {
        deviceId: 'sensor1',
        batteryLevel: 80,
        powerMode: PowerMode.NORMAL,
        connectionStatus: ConnectionStatus.ONLINE,
        lastSeen: now - 3000 // 3 seconds ago (more than 2x the 1000ms interval)
      });

      // Trigger status check
      // @ts-ignore - Access private method for testing
      energyManager['checkDevicesStatus']();

      // Verify device was marked as offline
      expect(offlineListener).toHaveBeenCalledWith('sensor1');

      // Verify new status
      const device = energyManager.getDevice('sensor1');
      expect(device.status?.connectionStatus).toBe(ConnectionStatus.OFFLINE);
    });

    test('should process received status messages', () => {
      // Register device
      energyManager.registerDevice('sensor1', 'Sensor', DeviceType.SENSOR);

      // Set up listener
      const statusUpdateListener = jest.fn();
      energyManager.on('statusUpdate', statusUpdateListener);

      // Simulate receiving status message
      const statusMessage = JSON.stringify({
        batteryLevel: 75,
        powerMode: PowerMode.LOW_POWER,
        connectionStatus: ConnectionStatus.ONLINE
      });

      // @ts-ignore - Access private method for testing
      energyManager['handleIncomingMessage']('test/devices/sensor1/status', Buffer.from(statusMessage));

      // Verify event was emitted
      expect(statusUpdateListener).toHaveBeenCalledWith('sensor1', expect.objectContaining({
        batteryLevel: 75,
        powerMode: PowerMode.LOW_POWER,
        connectionStatus: ConnectionStatus.ONLINE
      }));
    });

    test('should handle invalid status messages', () => {
      // Register device
      energyManager.registerDevice('sensor1', 'Sensor', DeviceType.SENSOR);

      // Set up listener
      const statusUpdateListener = jest.fn();
      energyManager.on('statusUpdate', statusUpdateListener);

      // Simulate receiving invalid message
      // @ts-ignore - Access private method for testing
      energyManager['handleIncomingMessage']('test/devices/sensor1/status', Buffer.from('invalid json'));

      // Should not emit update event
      expect(statusUpdateListener).not.toHaveBeenCalled();
    });
  });

  describe('Advanced Commands', () => {
    test('should throw error when sending command with MQTT disconnected', async () => {
      // Register device
      energyManager.registerDevice('sensor1', 'Sensor', DeviceType.SENSOR);

      // Try to send command without connecting
      await expect(
        energyManager.sendCommand('sensor1', CommandType.SLEEP)
      ).rejects.toThrow(EnergyManagerError);
    });

    test('should send command to empty group without error', async () => {
      // Create empty group
      energyManager.createGroup('empty-group');

      // Simulate connection
      Object.defineProperty(energyManager['mqtt'], 'isClientConnected', {
        value: () => true
      });

      // Send command to empty group
      await energyManager.sendCommandToGroup('empty-group', CommandType.WAKE);

      // No error should be thrown
    });
  });

  describe('Convenience Methods', () => {
    beforeEach(() => {
      // Mock sendCommand for tests
      energyManager.sendCommand = jest.fn().mockResolvedValue(undefined);
      energyManager.sendCommandToGroup = jest.fn().mockResolvedValue(undefined);
    });

    test('should call sendCommand with correct parameters when using sleepDevice', async () => {
      await energyManager.sleepDevice('sensor1', 3600);
      expect(energyManager.sendCommand).toHaveBeenCalledWith('sensor1', CommandType.SLEEP, { duration: 3600 });
    });

    test('should call sendCommand with correct parameters when using wakeDevice', async () => {
      await energyManager.wakeDevice('sensor1');
      expect(energyManager.sendCommand).toHaveBeenCalledWith('sensor1', CommandType.WAKE);
    });

    test('should call sendCommandToGroup with correct parameters when using sleepGroup', async () => {
      await energyManager.sleepGroup('bedroom', 3600);
      expect(energyManager.sendCommandToGroup).toHaveBeenCalledWith('bedroom', CommandType.SLEEP, { duration: 3600 });
    });

    test('should call sendCommandToGroup with correct parameters when using wakeGroup', async () => {
      await energyManager.wakeGroup('bedroom');
      expect(energyManager.sendCommandToGroup).toHaveBeenCalledWith('bedroom', CommandType.WAKE);
    });
  });
});
