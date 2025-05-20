import {
  EnergyManager,
  DeviceType,
  PowerMode,
  ConnectionStatus,
  CommandType,
} from "../../index";
import * as mqtt from "mqtt";

/**
 * Integration tests for MQTT communication
 *
 * These tests require a local MQTT broker running on port 1883.
 * Tests will be skipped if the broker is not available.
 *
 * @group integration
 */

// This test requires a local MQTT broker running on port 1883
// Skip if not available
const localBrokerAvailable = async (): Promise<boolean> => {
  let client: mqtt.MqttClient | undefined = undefined;
  let timeoutHandle: NodeJS.Timeout | null = null;

  try {
    return new Promise<boolean>((resolve) => {
      // Create timeout to avoid test hanging waiting for connection
      timeoutHandle = setTimeout(() => {
        if (client) {
          client.removeAllListeners();
          client.end(true, {}, () => resolve(false));
        } else {
          resolve(false);
        }
      }, 1000);

      // Try to connect
      client = mqtt.connect("mqtt://localhost:1883", {
        connectTimeout: 1000,
        reconnectPeriod: 0,
      });

      client.on("connect", () => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        client?.end(true, {}, () => resolve(true));
      });

      client.on("error", () => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        client?.removeAllListeners();
        client?.end(true, {}, () => resolve(false));
      });
    });
  } catch (e) {
    if (timeoutHandle) clearTimeout(timeoutHandle);

    // Fix type error using explicit type check
    // and a non-null assertion to ensure TypeScript recognizes client
    if (client!) {
      const mqttClient = client as mqtt.MqttClient;
      mqttClient.removeAllListeners();
      mqttClient.end(true, {});
    }

    return false;
  }
};

describe("MQTT Integration", () => {
  let energyManager: EnergyManager;
  let testClient: mqtt.MqttClient;
  let brokerAvailable = false;

  // Check if broker is available before tests
  beforeAll(async () => {
    try {
      brokerAvailable = await localBrokerAvailable();
      if (!brokerAvailable) {
        console.warn(
          "Local MQTT broker not available. Integration tests will be skipped.",
        );
      }
    } catch (error) {
      console.error("Error checking broker availability:", error);
      brokerAvailable = false;
    }
  });

  beforeEach(async () => {
    if (!brokerAvailable) {
      return;
    }
    // Create manager instance
    energyManager = new EnergyManager({
      topicPrefix: "test/devices/",
    });

    // Connect to broker
    await energyManager.connect("mqtt://localhost:1883");

    // Test client to simulate devices
    testClient = mqtt.connect("mqtt://localhost:1883", {
      clientId: `test-client-${Date.now()}`,
    });

    // Wait for test client to connect
    await new Promise<void>((resolve) => {
      testClient.on("connect", () => resolve());
    });
  });

  afterEach(async () => {
    if (!brokerAvailable) {
      return;
    }
    // Clean up resources
    if (energyManager) {
      await energyManager.disconnect();
    }
    if (testClient) {
      await new Promise<void>((resolve) => {
        testClient.end(false, {}, () => resolve());
      });
    }
  });

  test("should update status when receiving message from device", async () => {
    if (!brokerAvailable) {
      return;
    }

    // Register device
    energyManager.registerDevice("sensor1", "Test Sensor", DeviceType.SENSOR);

    // Set up status listener
    const statusUpdatePromise = new Promise<void>((resolve) => {
      energyManager.on("statusUpdate", (deviceId, status) => {
        if (deviceId === "sensor1" && status.batteryLevel === 85) {
          resolve();
        }
      });
    });

    // Publish status message simulating the device
    testClient.publish(
      "test/devices/sensor1/status",
      JSON.stringify({
        batteryLevel: 85,
        powerMode: PowerMode.NORMAL,
        connectionStatus: ConnectionStatus.ONLINE,
      }),
    );

    // Wait for status update
    await statusUpdatePromise;

    // Verify status was updated
    const device = energyManager.getDevice("sensor1");
    expect(device.status).toBeDefined();
    expect(device.status?.batteryLevel).toBe(85);
    expect(device.status?.powerMode).toBe(PowerMode.NORMAL);
  }, 5000); // 5 second timeout

  test("should send command to device", async () => {
    if (!brokerAvailable) {
      return;
    }

    // Register device
    energyManager.registerDevice("sensor1", "Test Sensor", DeviceType.SENSOR);

    // Promise to verify command reception
    const commandReceivedPromise = new Promise<any>((resolve) => {
      testClient.subscribe("test/devices/sensor1/command", (err) => {
        if (err) {
          console.error("Error subscribing to command topic:", err);
        }
      });

      testClient.on("message", (topic, message) => {
        if (topic === "test/devices/sensor1/command") {
          try {
            const command = JSON.parse(message.toString());
            resolve(command);
          } catch (e) {
            console.error("Error parsing command:", e);
          }
        }
      });
    });

    // Fixed: Using CommandType enum instead of string literal
    await energyManager.sendCommand("sensor1", CommandType.SLEEP, {
      duration: 300,
    });

    // Wait for command reception
    const command = await commandReceivedPromise;

    // Verify command
    expect(command).toBeDefined();
    expect(command.type).toBe(CommandType.SLEEP);
    expect(command.payload).toEqual({ duration: 300 });
    expect(command.requestId).toBeDefined();
  }, 5000); // 5 second timeout
});
