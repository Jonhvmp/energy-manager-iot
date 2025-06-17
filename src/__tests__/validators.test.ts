// Ensure MQTT mock is applied before importing validators
import {
  validateDeviceId,
  validateGroupName,
  validateMqttBrokerUrl,
  validateCommand,
  validateDeviceConfig,
  validateCommandDetailed,
  validateDeviceConfigDetailed,
  ValidationResult
} from "../utils/validators";
import { CommandType } from "../types/command";

/**
 * Tests for validator utility functions
 *
 * This test suite verifies that the validator functions correctly
 * identify valid and invalid input values according to system requirements.
 */

// Ensure MQTT module is mocked
jest.mock("mqtt");

describe("Validators", () => {
  describe("validateDeviceId", () => {
    test("should accept valid IDs", () => {
      expect(validateDeviceId("sensor1")).toBe(true);
      expect(validateDeviceId("DEVICE_123")).toBe(true);
      expect(validateDeviceId("temp-sensor-01")).toBe(true);
      expect(validateDeviceId("a".repeat(50))).toBe(true); // 50 characters
    });

    test("should reject invalid IDs", () => {
      expect(validateDeviceId("")).toBe(false); // Empty
      expect(validateDeviceId("ab")).toBe(false); // Too short
      expect(validateDeviceId("device@123")).toBe(false); // Special characters
      expect(validateDeviceId("a".repeat(51))).toBe(false); // Too long
    });
  });

  describe("validateGroupName", () => {
    test("should accept valid group names", () => {
      expect(validateGroupName("living-room")).toBe(true);
      expect(validateGroupName("Room 1")).toBe(true);
      expect(validateGroupName("ab")).toBe(true); // 2 characters
      expect(validateGroupName("a".repeat(50))).toBe(true); // 50 characters
    });

    test("should reject invalid group names", () => {
      expect(validateGroupName("")).toBe(false); // Empty
      expect(validateGroupName("a")).toBe(false); // Too short
      expect(validateGroupName("room@home")).toBe(false); // Special characters
      expect(validateGroupName("a".repeat(51))).toBe(false); // Too long
    });
  });

  describe("validateMqttBrokerUrl", () => {
    test("should accept valid broker URLs", () => {
      expect(validateMqttBrokerUrl("mqtt://localhost")).toBe(true);
      expect(validateMqttBrokerUrl("mqtt://localhost:1883")).toBe(true);
      expect(validateMqttBrokerUrl("mqtts://broker.example.com:8883")).toBe(
        true,
      );
    });

    test("should reject invalid broker URLs", () => {
      expect(validateMqttBrokerUrl("")).toBe(false);
      expect(validateMqttBrokerUrl("http://localhost")).toBe(false); // Wrong protocol
      expect(validateMqttBrokerUrl("mqtt://")).toBe(false); // No host
      expect(validateMqttBrokerUrl("mqtt://@:1883")).toBe(false); // Invalid format
    });
  });

  describe("validateCommand", () => {
    test("should accept valid commands", () => {
      expect(
        validateCommand({
          type: CommandType.SLEEP,
          timestamp: Date.now(),
        }),
      ).toBe(true);

      expect(
        validateCommand({
          type: CommandType.SET_REPORTING,
          payload: { interval: 60 },
          timestamp: Date.now(),
        }),
      ).toBe(true);
    });

    test("should reject invalid commands", () => {
      // Invalid type
      expect(
        validateCommand({
          // @ts-ignore - Intentionally testing with invalid type
          type: "invalid_command",
          timestamp: Date.now(),
        }),
      ).toBe(false);

      // No timestamp
      expect(
        validateCommand({
          type: CommandType.SLEEP,
          // @ts-ignore - Testing without timestamp
          timestamp: undefined,
        }),
      ).toBe(false);

      // SET_REPORTING without proper payload
      expect(
        validateCommand({
          type: CommandType.SET_REPORTING,
          timestamp: Date.now(),
        }),
      ).toBe(false);

      expect(
        validateCommand({
          type: CommandType.SET_REPORTING,
          payload: {}, // No interval
          timestamp: Date.now(),
        }),
      ).toBe(false);

      expect(
        validateCommand({
          type: CommandType.SET_REPORTING,
          payload: { interval: "invalid" }, // Non-numeric interval
          timestamp: Date.now(),
        }),
      ).toBe(false);
    });
  });

  describe("validateDeviceConfig", () => {
    test("should accept valid configurations", () => {
      expect(validateDeviceConfig({})).toBe(true);
      expect(validateDeviceConfig({ reportingInterval: 60 })).toBe(true);
      expect(validateDeviceConfig({ sleepThreshold: 15 })).toBe(true);
      expect(validateDeviceConfig({ securityLevel: 3 })).toBe(true);
    });

    test("should reject invalid configurations", () => {
      expect(validateDeviceConfig({ reportingInterval: 0 })).toBe(false);
      expect(validateDeviceConfig({ reportingInterval: -1 })).toBe(false);
      expect(validateDeviceConfig({ reportingInterval: 86401 })).toBe(false);

      expect(validateDeviceConfig({ sleepThreshold: -1 })).toBe(false);
      expect(validateDeviceConfig({ sleepThreshold: 101 })).toBe(false);

      expect(validateDeviceConfig({ securityLevel: 0 })).toBe(false);
      expect(validateDeviceConfig({ securityLevel: 6 })).toBe(false);
    });
  });

  describe("validateCommandDetailed", () => {
    test("should provide detailed validation results for valid commands", () => {
      const result: ValidationResult = validateCommandDetailed({
        type: CommandType.SLEEP,
        timestamp: Date.now(),
      }, true);

      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    test("should provide detailed validation results for invalid commands", () => {
      // Invalid type
      let result: ValidationResult = validateCommandDetailed({
        // @ts-ignore - Intentionally testing with invalid type
        type: "invalid_command",
        timestamp: Date.now(),
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Invalid command type");

      // No timestamp
      result = validateCommandDetailed({
        type: CommandType.SLEEP,
        // @ts-ignore - Testing without timestamp
        timestamp: undefined,
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Missing or invalid timestamp");

      // SET_REPORTING without proper payload
      result = validateCommandDetailed({
        type: CommandType.SET_REPORTING,
        timestamp: Date.now(),
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("SET_REPORTING command requires payload");
    });
  });

  describe("validateDeviceConfigDetailed", () => {
    test("should provide detailed validation results for valid configurations", () => {
      let result: ValidationResult = validateDeviceConfigDetailed({
        reportingInterval: 60,
        sleepThreshold: 15,
        securityLevel: 3
      }, true);

      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    test("should provide detailed validation results for invalid configurations", () => {
      // Invalid reporting interval
      let result: ValidationResult = validateDeviceConfigDetailed({
        reportingInterval: 0  // Invalid
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Invalid reportingInterval");

      // Invalid sleep threshold
      result = validateDeviceConfigDetailed({
        sleepThreshold: 101  // Invalid
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Invalid sleepThreshold");

      // Invalid security level
      result = validateDeviceConfigDetailed({
        securityLevel: 0  // Invalid
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Invalid securityLevel");
    });
  });
});
