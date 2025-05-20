import { MqttHandler } from "../lib/mqtt-handler";
import * as mqtt from "mqtt";
import { EnergyManagerError } from "../utils/error-handler";

/**
 * Main tests for the MqttHandler class
 *
 * This test suite covers the core functionality of the MQTT handler,
 * including connection management, message publication and subscription.
 */

// Use global MQTT mock, without trying to redefine
jest.mock("mqtt");

describe("MqttHandler", () => {
  let mqttHandler: MqttHandler;
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
    mockClient.subscribe.mockImplementation(
      (topic: string, opts: any, cb: Function) => {
        cb(null);
        return mockClient;
      },
    );

    (mqtt.connect as jest.Mock).mockReturnValue(mockClient);

    // Configure client to use our handlers
    mockClient.on.mockImplementation((event: string, callback: Function) => {
      mockHandlers[event] = callback;
      return mockClient;
    });

    mqttHandler = new MqttHandler({
      clientId: "test-client",
      // Settings to avoid timeouts
      connectTimeout: 1,
      reconnectPeriod: 0,
    });
  });

  afterEach(() => {
    if (mqttHandler) {
      mqttHandler.removeAllListeners();
    }
    jest.clearAllMocks();
  });

  describe("Connection", () => {
    test("should throw error with invalid URL", async () => {
      await expect(mqttHandler.connect("invalid-url")).rejects.toThrow(
        EnergyManagerError,
      );
    });

    test("should connect successfully and emit event", async () => {
      const connectPromise = mqttHandler.connect("mqtt://localhost:1883");

      // Simulate connection event
      const connectListener = jest.fn();
      mqttHandler.on("connect", connectListener);

      // Trigger connect callback
      mockHandlers.connect();

      await connectPromise;
      expect(connectListener).toHaveBeenCalled();
      expect(mqttHandler.isClientConnected()).toBe(true);
    });

    test("should emit error event on connection error", async () => {
      const connectPromise = mqttHandler.connect("mqtt://localhost:1883");

      const errorListener = jest.fn();
      mqttHandler.on("error", errorListener);

      // Simulate error
      const error = new Error("Connection refused");
      mockHandlers.error(error);

      await expect(connectPromise).rejects.toThrow(EnergyManagerError);
      expect(errorListener).toHaveBeenCalledWith(error);
    });
  });

  describe("Publication and Subscription", () => {
    test("should fail to publish when disconnected", async () => {
      await expect(
        mqttHandler.publish("test/topic", "message"),
      ).rejects.toThrow(EnergyManagerError);
    });

    test("should process received messages", async () => {
      // Connect first
      const connectPromise = mqttHandler.connect("mqtt://localhost:1883");
      mockHandlers.connect();
      await connectPromise;

      // Set up listener for messages
      const messageListener = jest.fn();
      mqttHandler.on("message", messageListener);

      // Subscribe to topic with callback
      const topicCallback = jest.fn();
      await mqttHandler.subscribe("test/topic", topicCallback);

      // Simulate message reception
      const message = Buffer.from("test message");
      mockHandlers.message("test/topic", message);

      // Verify both callbacks were called
      expect(messageListener).toHaveBeenCalledWith("test/topic", message);
      expect(topicCallback).toHaveBeenCalledWith("test/topic", message);
    });
  });

  describe("Disconnection and Reconnection", () => {
    test("should handle disconnection", async () => {
      // Connect
      const connectPromise = mqttHandler.connect("mqtt://localhost:1883");
      mockHandlers.connect();
      await connectPromise;

      // Set up listener for offline
      const offlineListener = jest.fn();
      mqttHandler.on("offline", offlineListener);

      // Simulate offline
      mockHandlers.offline();

      expect(offlineListener).toHaveBeenCalled();
      expect(mqttHandler.isClientConnected()).toBe(false);
    });

    test("should emit event on reconnection", async () => {
      // Connect
      const connectPromise = mqttHandler.connect("mqtt://localhost:1883");
      mockHandlers.connect();
      await connectPromise;

      // Set up listener for reconnection
      const reconnectListener = jest.fn();
      mqttHandler.on("reconnect", reconnectListener);

      // Simulate reconnection
      mockHandlers.reconnect();

      expect(reconnectListener).toHaveBeenCalled();
    });
  });
});
