import { EnergyManager } from "../lib/energy-manager";
import { DeviceType } from "../types/device";
import { PowerMode, ConnectionStatus } from "../types/status";
import * as mqtt from "mqtt";

/**
 * Tests for device status management functionality
 *
 * This test suite verifies the functionality of updating,
 * tracking, and notifying device status.
 */

// Mock MQTT client
jest.mock("mqtt");

describe("Device Status Management", () => {
  let energyManager: EnergyManager;
  let mockClient: any;
  let mockHandlers: Record<string, Function>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create handlers for events
    mockHandlers = {
      connect: jest.fn(),
      message: jest.fn(),
      error: jest.fn(),
      reconnect: jest.fn(),
      offline: jest.fn(),
    };

    // Create a mock client
    mockClient = {
      on: jest.fn(),
      publish: jest.fn(),
      subscribe: jest.fn(),
      end: jest.fn(),
    };

    // Add implementation for subscribe to invoke callback immediately
    mockClient.subscribe.mockImplementation((topic: string, opts: any, cb: Function) => {
      cb(null);
      return mockClient;
    });

    (mqtt.connect as jest.Mock).mockReturnValue(mockClient);

    // Configure client to use our handlers
    mockClient.on.mockImplementation((event: string, callback: Function) => {
      mockHandlers[event] = callback;
      return mockClient;
    });

    energyManager = new EnergyManager({
      topicPrefix: "test/devices/",
      statusInterval: 1000, // Short interval for tests
    });
  });

  afterEach(() => {
    // Stop status check
    if (energyManager["statusCheckInterval"]) {
      clearInterval(energyManager["statusCheckInterval"]);
      energyManager["statusCheckInterval"] = undefined;
    }

    // Remove all listeners to avoid memory leaks
    energyManager.removeAllListeners();

    if (mockClient.removeAllListeners) {
      mockClient.removeAllListeners();
    }
  });

  test("should process device status updates", async () => {
    // Connect to broker
    const connectPromise = energyManager.connect("mqtt://localhost:1883");
    mockHandlers.connect();
    await connectPromise;

    // Register a device
    const device = energyManager.registerDevice(
      "sensor1",
      "Temperature Sensor",
      DeviceType.SENSOR
    );

    // Configure listener for status updates
    const statusListener = jest.fn();
    energyManager.on("statusUpdate", statusListener);

    // Simulate receiving status message
    const statusTopic = "test/devices/sensor1/status";
    const statusData = {
      deviceId: "sensor1",
      batteryLevel: 85,
      powerMode: PowerMode.NORMAL,
      connectionStatus: ConnectionStatus.ONLINE,
      lastSeen: Date.now(),
    };

    mockHandlers.message(
      statusTopic,
      Buffer.from(JSON.stringify(statusData))
    );

    // Verify status was updated
    expect(statusListener).toHaveBeenCalledWith("sensor1", expect.objectContaining({
      deviceId: "sensor1",
      batteryLevel: 85,
      powerMode: PowerMode.NORMAL,
      connectionStatus: ConnectionStatus.ONLINE,
    }));

    // Verify device has updated status
    const updatedDevice = energyManager.getDevice("sensor1");
    expect(updatedDevice.status).toBeDefined();
    expect(updatedDevice.status?.batteryLevel).toBe(85);
  });

  test("should detect offline devices after timeout", async () => {
    // Connect to broker
    const connectPromise = energyManager.connect("mqtt://localhost:1883");
    mockHandlers.connect();
    await connectPromise;

    // Configure listener for offline devices
    const offlineListener = jest.fn();
    energyManager.on("deviceOffline", offlineListener);

    // Register a device with status
    const device = energyManager.registerDevice(
      "sensor1",
      "Temperature Sensor",
      DeviceType.SENSOR
    );

    // Set initial status (online but with old timestamp)
    const oldTimestamp = Date.now() - 5000; // 5 seconds ago

    // @ts-ignore - Access to private method for testing
    energyManager.registry.updateDeviceStatus("sensor1", {
      deviceId: "sensor1",
      batteryLevel: 70,
      powerMode: PowerMode.NORMAL,
      connectionStatus: ConnectionStatus.ONLINE,
      lastSeen: oldTimestamp,
    });

    // Force status check
    // @ts-ignore - Access to private method for testing
    energyManager["checkDevicesStatus"]();

    // Verify device was marked as offline
    expect(offlineListener).toHaveBeenCalledWith("sensor1");

    // Verify device status was updated
    const updatedDevice = energyManager.getDevice("sensor1");
    expect(updatedDevice.status?.connectionStatus).toBe(ConnectionStatus.OFFLINE);
  });

  test("should calculate group statistics correctly", async () => {
    // Register devices and groups
    energyManager.createGroup("test-group");

    const sensor1 = energyManager.registerDevice(
      "sensor1",
      "Sensor 1",
      DeviceType.SENSOR
    );

    const sensor2 = energyManager.registerDevice(
      "sensor2",
      "Sensor 2",
      DeviceType.SENSOR
    );

    energyManager.addDeviceToGroup("sensor1", "test-group");
    energyManager.addDeviceToGroup("sensor2", "test-group");

    // Set status for devices
    // @ts-ignore - Access to private method for testing
    energyManager.registry.updateDeviceStatus("sensor1", {
      deviceId: "sensor1",
      batteryLevel: 80,
      powerMode: PowerMode.NORMAL,
      connectionStatus: ConnectionStatus.ONLINE,
      lastSeen: Date.now(),
    });

    // @ts-ignore - Access to private method for testing
    energyManager.registry.updateDeviceStatus("sensor2", {
      deviceId: "sensor2",
      batteryLevel: 20,
      powerMode: PowerMode.CRITICAL,
      connectionStatus: ConnectionStatus.ONLINE,
      lastSeen: Date.now(),
    });

    // Calculate group statistics
    const stats = energyManager.getGroupStatistics("test-group");

    // Verify statistics
    expect(stats.totalDevices).toBe(2);
    expect(stats.onlineCount).toBe(2);
    expect(stats.offlineCount).toBe(0);
    expect(stats.averageBatteryLevel).toBe(50); // (80 + 20) / 2
    expect(stats.powerModeDistribution[PowerMode.NORMAL]).toBe(1);
    expect(stats.powerModeDistribution[PowerMode.CRITICAL]).toBe(1);
  });

  test("should ignore status messages for unregistered devices", async () => {
    // Connect to broker
    const connectPromise = energyManager.connect("mqtt://localhost:1883");
    mockHandlers.connect();
    await connectPromise;

    // Configure listener for status updates
    const statusListener = jest.fn();
    energyManager.on("statusUpdate", statusListener);

    // Simulate receiving status message for unregistered device
    const statusTopic = "test/devices/unknown-device/status";
    const statusData = {
      deviceId: "unknown-device",
      batteryLevel: 85,
      powerMode: PowerMode.NORMAL,
      connectionStatus: ConnectionStatus.ONLINE,
      lastSeen: Date.now(),
    };

    mockHandlers.message(
      statusTopic,
      Buffer.from(JSON.stringify(statusData))
    );

    // Verify listener was not called
    expect(statusListener).not.toHaveBeenCalled();
  });
});
