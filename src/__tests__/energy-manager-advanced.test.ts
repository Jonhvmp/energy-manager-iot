import { EnergyManager, DeviceType, CommandType, PowerMode, ConnectionStatus } from "../index";
import * as mqtt from "mqtt";
import { EnergyManagerError } from "../utils/error-handler";

/**
 * Advanced tests for EnergyManager covering error cases and MQTT handling
 */

// Mock MQTT client
jest.mock("mqtt");

describe("EnergyManager Advanced Tests", () => {
  let energyManager: EnergyManager;
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      on: jest.fn(),
      publish: jest.fn(),
      subscribe: jest.fn(),
      end: jest.fn(),
      removeAllListeners: jest.fn()
    };

    (mqtt.connect as jest.Mock).mockReturnValue(mockClient);

    energyManager = new EnergyManager();
  });

  afterEach(() => {
    if (energyManager["statusCheckInterval"]) {
      clearInterval(energyManager["statusCheckInterval"]);
    }
    energyManager.removeAllListeners();
  });

  test("should throw error when sending command to non-existent device", async () => {
    const nonExistentDeviceId = "non-existent-device";

    await expect(energyManager.sendCommand(
      nonExistentDeviceId,
      CommandType.SLEEP
    )).rejects.toThrow(EnergyManagerError);
  });

  test("should throw error when sending command without connection", async () => {
    // Register device but don't connect
    const deviceId = "sensor1";
    energyManager.registerDevice(
      deviceId,
      "Temperature Sensor",
      DeviceType.SENSOR
    );

    // Try to send command without MQTT connection
    await expect(energyManager.sendCommand(
      deviceId,
      CommandType.SLEEP
    )).rejects.toThrow(EnergyManagerError);
  });

  // Increase timeout for this test to avoid timeout errors
  test("should throw error when command sending fails", async () => {
    const deviceId = "sensor1";
    energyManager.registerDevice(
      deviceId,
      "Temperature Sensor",
      DeviceType.SENSOR
    );

    // Mock successful connection - executed synchronously
    mockClient.on.mockImplementation((event: string, cb: Function) => {
      if (event === 'connect') {
        cb(); // Execute callback immediately for connect
      }
      return mockClient;
    });

    // Mock subscribe that responds immediately
    mockClient.subscribe.mockImplementation((_topic: string, _opts: any, cb: Function) => {
      if (cb) cb(null); // Execute callback immediately without error
      return mockClient;
    });

    await energyManager.connect("mqtt://localhost");

    // Verify it's actually "connected"
    expect(energyManager.isConnected()).toBe(true);

    // Mock publish failure that resolves immediately
    mockClient.publish.mockImplementation(
      (_topic: string, _message: string, _opts: any, cb: Function) => {
        // Call callback with error immediately
        if (cb) cb(new Error("Publish failure"));
        return mockClient;
      }
    );

    await expect(
      energyManager.sendCommand(deviceId, CommandType.SLEEP)
    ).rejects.toThrow();
  }, 30000);

  // Increase timeout for this test to avoid timeout errors
  test("should throw error when sending command to group fails", async () => {
    // Create group and add device
    const groupName = "test-group";
    energyManager.createGroup(groupName);

    const deviceId = "sensor1";
    energyManager.registerDevice(
      deviceId,
      "Temperature Sensor",
      DeviceType.SENSOR
    );

    energyManager.addDeviceToGroup(deviceId, groupName);

    // Mock successful connection - executed synchronously
    mockClient.on.mockImplementation((event: string, cb: Function) => {
      if (event === 'connect') {
        cb(); // Execute callback immediately for connect
      }
      return mockClient;
    });

    // Mock subscribe that responds immediately
    mockClient.subscribe.mockImplementation((_topic: string, _opts: any, cb: Function) => {
      if (cb) cb(null); // Execute callback immediately without error
      return mockClient;
    });

    await energyManager.connect("mqtt://localhost");

    // Verify it's actually "connected"
    expect(energyManager.isConnected()).toBe(true);

    // Mock publish failure that resolves immediately
    mockClient.publish.mockImplementation(
      (_topic: string, _message: string, _opts: any, cb: Function) => {
        // Call callback with error immediately
        if (cb) cb(new Error("Publish failure"));
        return mockClient;
      }
    );

    await expect(
      energyManager.sendCommandToGroup(groupName, CommandType.SLEEP)
    ).rejects.toThrow();
  }, 10000);

  test("should emit error event when MQTT error occurs", async () => {
    // Prepare spy for error event
    const errorSpy = jest.fn();
    energyManager.on("error", errorSpy);

    // Mock MQTT error - with immediate execution
    const mqttError = new Error("MQTT Error");
    mockClient.on.mockImplementation((event: string, cb: Function) => {
      if (event === 'error') {
        setTimeout(() => cb(mqttError), 0);
      }
      return mockClient;
    });

    // Start connection
    const connectPromise = energyManager.connect("mqtt://localhost");

    // Connection should fail
    await expect(connectPromise).rejects.toThrow();

    // Verify error event was emitted
    expect(errorSpy).toHaveBeenCalledWith(mqttError);
  });

  test("should resubscribe to topics when prefix is changed", async () => {
    // Mock successful connection
    mockClient.on.mockImplementation((event: string, cb: Function) => {
      if (event === 'connect') setTimeout(() => cb(), 0);
      return mockClient;
    });

    // Mock subscribe to return immediately
    mockClient.subscribe.mockImplementation((_topic: string, _opts: any, cb: Function) => {
      if (cb) setTimeout(() => cb(null), 0);
      return mockClient;
    });

    await energyManager.connect("mqtt://localhost");

    // Register devices
    energyManager.registerDevice("sensor1", "Sensor 1", DeviceType.SENSOR);
    energyManager.registerDevice("sensor2", "Sensor 2", DeviceType.SENSOR);

    // Clear mock to count new calls
    mockClient.subscribe.mockClear();

    // Change prefix
    energyManager.setTopicPrefix("new/prefix/");

    // Verify resubscription happened
    expect(mockClient.subscribe).toHaveBeenCalled();
    expect(mockClient.subscribe.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  test("should ignore resubscription if not connected when changing prefix", () => {
    // Register devices without connecting
    energyManager.registerDevice("sensor1", "Sensor 1", DeviceType.SENSOR);
    energyManager.registerDevice("sensor2", "Sensor 2", DeviceType.SENSOR);

    // Change prefix
    energyManager.setTopicPrefix("new/prefix/");

    // There should be no subscription attempt
    expect(mockClient.subscribe).not.toHaveBeenCalled();
  });
});
