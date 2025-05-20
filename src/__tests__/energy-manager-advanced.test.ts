import {
  EnergyManager,
  DeviceType,
  CommandType,
  PowerMode,
  ConnectionStatus,
} from "../index";
import { EnergyManagerError } from "../utils/error-handler";
import * as mqtt from "mqtt";

// Define type for mock calls
type MockCall = [string, Function];

jest.mock("mqtt", () => {
  const mockClient = {
    on: jest.fn().mockReturnThis(),
    end: jest.fn((_, __, cb) => cb && cb()),
    publish: jest.fn((_, __, ___, cb) => cb && cb()),
    subscribe: jest.fn((_, __, cb) => cb && cb()),
    unsubscribe: jest.fn((_, cb) => cb && cb()),
    removeAllListeners: jest.fn(),
  };

  return {
    connect: jest.fn().mockReturnValue(mockClient),
  };
});

/**
 * Advanced coverage tests for the EnergyManager class
 *
 * These tests focus on improving code coverage by testing specific
 * behaviors and edge cases not covered by the main test suite.
 */
describe("EnergyManager - Advanced Coverage", () => {
  let energyManager: EnergyManager;
  let mockMqttClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    energyManager = new EnergyManager({
      topicPrefix: "advanced/test/",
      statusInterval: 500,
    });
    mockMqttClient = mqtt.connect("mqtt://localhost:1883");
  });

  afterEach(() => {
    if (energyManager["statusCheckInterval"]) {
      clearInterval(energyManager["statusCheckInterval"]);
    }
    energyManager.removeAllListeners();
  });

  describe("Topics and IDs", () => {
    test("should correctly extract device ID from topic", () => {
      // @ts-ignore - Access private method
      const deviceId = energyManager["extractDeviceIdFromStatusTopic"](
        "advanced/test/sensor123/status",
      );
      expect(deviceId).toBe("sensor123");
    });

    test("should return null for invalid topics", () => {
      // @ts-ignore - Access private method
      const deviceId1 = energyManager["extractDeviceIdFromStatusTopic"](
        "wrong-prefix/sensor123/status",
      );
      // @ts-ignore - Access private method
      const deviceId2 = energyManager["extractDeviceIdFromStatusTopic"](
        "advanced/test/sensor123/command",
      );

      expect(deviceId1).toBeNull();
      expect(deviceId2).toBeNull();
    });

    test("should generate unique request IDs", () => {
      // @ts-ignore - Access private method
      const requestId = energyManager["generateRequestId"]();
      expect(requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
    });
  });

  describe("Command Errors", () => {
    test("should throw error when sending command to non-existent device", async () => {
      // Simulate MQTT connection
      Object.defineProperty(energyManager["mqtt"], "isClientConnected", {
        value: () => true,
      });

      await expect(
        energyManager.sendCommand("non-existent", CommandType.SLEEP),
      ).rejects.toThrow(EnergyManagerError);
    });

    test("should handle error when publishing command", async () => {
      // Register device
      energyManager.registerDevice("sensor1", "Sensor", DeviceType.SENSOR);

      // Simulate MQTT connection
      Object.defineProperty(energyManager["mqtt"], "isClientConnected", {
        value: () => true,
      });

      // Simulate publish error
      energyManager["mqtt"].publish = jest
        .fn()
        .mockRejectedValue(new Error("Publish failed"));

      await expect(
        energyManager.sendCommand("sensor1", CommandType.SLEEP),
      ).rejects.toThrow();
    });

    test("should propagate error when sending command to group", async () => {
      // Create group and add device
      energyManager.createGroup("test-group");
      energyManager.registerDevice("sensor1", "Sensor", DeviceType.SENSOR);
      energyManager.addDeviceToGroup("sensor1", "test-group");

      // Simulate MQTT connection
      Object.defineProperty(energyManager["mqtt"], "isClientConnected", {
        value: () => true,
      });

      // Simulate command error
      energyManager.sendCommand = jest
        .fn()
        .mockRejectedValue(new Error("Command failed"));

      await expect(
        energyManager.sendCommandToGroup("test-group", CommandType.SLEEP),
      ).rejects.toThrow(EnergyManagerError);
    });
  });

  describe("MQTT Events", () => {
    beforeEach(() => {
      // Simulate MQTT connection to test events
      const connectPromise = energyManager.connect("mqtt://localhost:1883");

      // Simulate connect callback
      const onConnect = mockMqttClient.on.mock.calls.find(
        (c: MockCall) => c[0] === "connect",
      )?.[1];
      if (onConnect) onConnect();

      return connectPromise;
    });

    test("should emit reconnect event", () => {
      const reconnectListener = jest.fn();
      energyManager.on("reconnecting", reconnectListener);

      // Simulate reconnect event
      const onReconnect = mockMqttClient.on.mock.calls.find(
        (c: MockCall) => c[0] === "reconnect",
      )?.[1];
      if (onReconnect) onReconnect();

      expect(reconnectListener).toHaveBeenCalled();
    });

    test("should emit error event", () => {
      const errorListener = jest.fn();
      energyManager.on("error", errorListener);

      const testError = new Error("Test error");

      // Simulate error event
      const onError = mockMqttClient.on.mock.calls.find(
        (c: MockCall) => c[0] === "error",
      )?.[1];
      if (onError) onError(testError);

      expect(errorListener).toHaveBeenCalledWith(testError);
    });
  });

  describe("Topic Subscriptions", () => {
    test("should subscribe to all device status topics", async () => {
      // Register devices
      energyManager.registerDevice("sensor1", "Sensor 1", DeviceType.SENSOR);
      energyManager.registerDevice("sensor2", "Sensor 2", DeviceType.SENSOR);

      // Spy on subscribe method
      const subscribeSpy = jest
        .spyOn(energyManager["mqtt"], "subscribe")
        .mockResolvedValue();

      // Simulate connected state
      Object.defineProperty(energyManager["mqtt"], "isClientConnected", {
        value: () => true,
      });

      // @ts-ignore - Access private method
      await energyManager["subscribeToAllDeviceStatuses"]();

      // Should call subscribe for each device
      expect(subscribeSpy).toHaveBeenCalledTimes(2);
      expect(subscribeSpy).toHaveBeenCalledWith("advanced/test/sensor1/status");
      expect(subscribeSpy).toHaveBeenCalledWith("advanced/test/sensor2/status");
    });

    test("should not attempt to subscribe when disconnected", async () => {
      // Register device
      energyManager.registerDevice("sensor1", "Sensor", DeviceType.SENSOR);

      // Spy on subscribe method
      const subscribeSpy = jest
        .spyOn(energyManager["mqtt"], "subscribe")
        .mockResolvedValue();

      // Simulate disconnected state
      Object.defineProperty(energyManager["mqtt"], "isClientConnected", {
        value: () => false,
      });

      // @ts-ignore - Access private method
      await energyManager["subscribeToAllDeviceStatuses"]();

      // Should not call subscribe
      expect(subscribeSpy).not.toHaveBeenCalled();
    });
  });
});
