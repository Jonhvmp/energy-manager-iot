import { DeviceRegistry } from "../lib/device-registry";
import { DeviceType } from "../types/device";
import { PowerMode, ConnectionStatus } from "../types/status";
import { EnergyManagerError, ErrorType } from "../utils/error-handler";

/**
 * Tests for the DeviceRegistry class
 *
 * This test suite covers validation, device registration, management,
 * and group operations of the DeviceRegistry.
 */

// Mock MQTT module to avoid real connections during tests
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

describe("DeviceRegistry", () => {
  let registry: DeviceRegistry;

  beforeEach(() => {
    registry = new DeviceRegistry();
  });

  describe("Device Registration", () => {
    test("should throw error when registering device with invalid ID", () => {
      // Invalid IDs: empty, too short, or with disallowed characters
      expect(() =>
        registry.registerDevice("", "Device", DeviceType.SENSOR),
      ).toThrow(EnergyManagerError);
      expect(() =>
        registry.registerDevice("ab", "Device", DeviceType.SENSOR),
      ).toThrow(EnergyManagerError);
      expect(() =>
        registry.registerDevice("device@123", "Device", DeviceType.SENSOR),
      ).toThrow(EnergyManagerError);
    });

    test("should throw error when registering duplicate device", () => {
      registry.registerDevice("sensor1", "Sensor 1", DeviceType.SENSOR);
      expect(() =>
        registry.registerDevice("sensor1", "Duplicate", DeviceType.SENSOR),
      ).toThrow(EnergyManagerError);
    });

    test("should throw error with invalid configuration", () => {
      // Test invalid reporting intervals
      expect(() =>
        registry.registerDevice(
          "sensor1",
          "Sensor 1",
          DeviceType.SENSOR,
          { reportingInterval: 0 }, // Invalid value
        ),
      ).toThrow(EnergyManagerError);

      expect(() =>
        registry.registerDevice(
          "sensor1",
          "Sensor 1",
          DeviceType.SENSOR,
          { sleepThreshold: 101 }, // Invalid value
        ),
      ).toThrow(EnergyManagerError);
    });
  });

  describe("Group Management", () => {
    test("should throw error when using invalid group name", () => {
      expect(() => registry.createGroup("")).toThrow(EnergyManagerError);
      expect(() => registry.createGroup("group@special")).toThrow(
        EnergyManagerError,
      );
    });

    test("should throw error when accessing non-existent group", () => {
      expect(() => registry.getDevicesInGroup("non-existent-group")).toThrow(
        EnergyManagerError,
      );
      expect(() => registry.getDeviceIdsInGroup("non-existent-group")).toThrow(
        EnergyManagerError,
      );
    });

    test("should throw error when removing device from non-existent group", () => {
      registry.registerDevice("sensor1", "Sensor 1", DeviceType.SENSOR);
      expect(() =>
        registry.removeDeviceFromGroup("sensor1", "non-existent-group"),
      ).toThrow(EnergyManagerError);
    });
  });
});
