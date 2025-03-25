import { MqttHandler, MqttHandlerOptions } from '../lib/mqtt-handler';
import * as mqtt from 'mqtt';
import { EnergyManagerError, ErrorType } from '../utils/error-handler';

// Use global mock, without redefining
jest.mock('mqtt');

/**
 * Advanced tests for the MqttHandler class
 *
 * These tests focus on edge cases and error handling in the MQTT handler,
 * particularly around publishing, subscribing, and connection failures.
 */
describe('MqttHandler - Advanced Tests', () => {
  let mqttHandler: MqttHandler;
  let mockClient: any;
  let callbacks: Record<string, Function> = {};

  beforeEach(() => {
    jest.clearAllMocks();
    callbacks = {};

    // Get the existing mock client from global mock
    const mockImplementation = (mqtt.connect as jest.Mock).getMockImplementation();
    mockClient = mockImplementation ? mockImplementation() : {};

    // Override mockClient.on implementation for this test
    mockClient.on.mockImplementation((event: string, callback: Function) => {
      callbacks[event] = callback;
      return mockClient;
    });

    mqttHandler = new MqttHandler({
      clientId: 'test-client',
      username: 'user',
      password: 'pass',
      clean: true
    });
  });

  afterEach(() => {
    if (mqttHandler) {
      mqttHandler.removeAllListeners();
    }
  });

  describe('Publication Errors', () => {
    test('should reject when publication fails', async () => {
      // Connect first
      const connectPromise = mqttHandler.connect('mqtt://localhost:1883');
      callbacks['connect'] && callbacks['connect'](); // Simulate connect event
      await connectPromise;

      // Mock publication error
      mockClient.publish.mockImplementationOnce((_topic: string, _message: string, _opts: object, cb?: Function) => {
        if (cb) cb(new Error('Publish failed'));
      });

      // Try to publish
      await expect(mqttHandler.publish('test/topic', 'message')).rejects.toThrow(EnergyManagerError);
    });

    test('should reject when subscription fails', async () => {
      // Connect first
      const connectPromise = mqttHandler.connect('mqtt://localhost:1883');
      callbacks['connect'] && callbacks['connect']();
      await connectPromise;

      // Mock subscription error
      mockClient.subscribe.mockImplementationOnce((_topic: string, _opts: object, cb?: Function) => {
        if (cb) cb(new Error('Subscribe failed'));
      });

      // Try to subscribe
      await expect(mqttHandler.subscribe('test/topic')).rejects.toThrow(EnergyManagerError);
    });

    test('should reject when unsubscription fails', async () => {
      // Connect first
      const connectPromise = mqttHandler.connect('mqtt://localhost:1883');
      callbacks['connect'] && callbacks['connect']();
      await connectPromise;

      // Mock unsubscription error
      mockClient.unsubscribe.mockImplementationOnce((_topic: string, cb?: Function) => {
        if (cb) cb(new Error('Unsubscribe failed'));
      });

      // Try to unsubscribe
      await expect(mqttHandler.unsubscribe('test/topic')).rejects.toThrow(EnergyManagerError);
    });
  });

  describe('Initialization Exceptions', () => {
    test('should handle exceptions when creating MQTT client', async () => {
      // Simulate exception error during connection
      jest.spyOn(mqtt, 'connect').mockImplementationOnce(() => {
        throw new Error('Connection setup failed');
      });

      // Try to connect
      await expect(mqttHandler.connect('mqtt://localhost:1883')).rejects.toThrow(EnergyManagerError);
    });

    test('should handle disconnection when client is already disconnected', async () => {
      // Client not initialized
      const result = await mqttHandler.disconnect();
      expect(result).toBeUndefined();
    });

    test('should reject when disconnection fails', async () => {
      // Connect first
      const connectPromise = mqttHandler.connect('mqtt://localhost:1883');
      callbacks['connect'] && callbacks['connect']();
      await connectPromise;

      // Mock disconnection error
      mockClient.end.mockImplementationOnce((force: boolean, opts: object, cb: Function) => {
        cb(new Error('Disconnect failed'));
      });

      // Try to disconnect
      await expect(mqttHandler.disconnect()).rejects.toThrow(EnergyManagerError);
    });
  });

  describe('Message Handling', () => {
    test('should handle errors in topic callbacks', async () => {
      // Connect first
      const connectPromise = mqttHandler.connect('mqtt://localhost:1883');
      callbacks['connect'] && callbacks['connect']();
      await connectPromise;

      // Register callback with error
      const errorCallback = jest.fn(() => {
        throw new Error('Callback error');
      });
      await mqttHandler.subscribe('test/error', errorCallback);

      // Should not throw error even with callback failure
      const message = Buffer.from('test');

      // Simulate message reception
      expect(() => {
        callbacks['message'] && callbacks['message']('test/error', message);
      }).not.toThrow();

      // Callback should have been called
      expect(errorCallback).toHaveBeenCalled();
    });
  });
});
