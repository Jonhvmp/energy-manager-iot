import * as mqtt from 'mqtt';
import { EventEmitter } from 'events';
import Logger from '../utils/logger';
import { validateMqttBrokerUrl } from '../utils/validators';
import { EnergyManagerError, ErrorType } from '../utils/error-handler';

/**
 * Configuration options for the MQTT handler
 */
export interface MqttHandlerOptions {
  /** Optional client ID for MQTT connection */
  clientId?: string;

  /** Whether to create a clean session, defaults to true */
  clean?: boolean;

  /** Keepalive interval in seconds, defaults to 60 */
  keepalive?: number;

  /** Reconnection period in milliseconds, defaults to 5000 */
  reconnectPeriod?: number;

  /** Connection timeout in milliseconds, defaults to 30000 */
  connectTimeout?: number;

  /** Username for MQTT authentication */
  username?: string;

  /** Password for MQTT authentication */
  password?: string;

  /** Whether to use SSL connection, defaults to false */
  ssl?: boolean;

  /** Last Will and Testament message configuration */
  will?: {
    topic: string;
    payload: string;
    qos?: 0 | 1 | 2;
    retain?: boolean;
  };
}

/**
 * Handles MQTT connections and message routing
 *
 * This class provides a wrapper around the MQTT client library with
 * additional features for connection management, topic subscription,
 * and message handling.
 *
 * @remarks
 * MqttHandler extends EventEmitter to provide notification of connection
 * state changes and received messages.
 */
export class MqttHandler extends EventEmitter {
  private client: mqtt.MqttClient | null = null;
  private options: MqttHandlerOptions;
  private brokerUrl: string = '';
  private isConnected: boolean = false;
  private topicSubscriptions: Map<string, (topic: string, payload: Buffer) => void>;

  /**
   * Creates a new MQTT handler instance
   *
   * @param options - Configuration options for the MQTT connection
   */
  constructor(options: MqttHandlerOptions = {}) {
    super();

    // Default options
    this.options = {
      clientId: `energy-manager-${Math.random().toString(16).substring(2, 10)}`,
      clean: true,
      keepalive: 60,
      reconnectPeriod: 5000,
      connectTimeout: 30000,
      ...options
    };

    this.topicSubscriptions = new Map();
  }

  /**
   * Connects to the MQTT broker
   *
   * @param brokerUrl - URL of the MQTT broker
   * @param options - Additional connection options to override defaults
   * @returns Promise that resolves when connected or rejects on error
   * @throws {EnergyManagerError} If broker URL is invalid or connection fails
   */
  public connect(brokerUrl: string, options?: MqttHandlerOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!validateMqttBrokerUrl(brokerUrl)) {
        reject(new EnergyManagerError('Invalid MQTT broker URL', ErrorType.VALIDATION));
        return;
      }

      this.brokerUrl = brokerUrl;

      // Merge options
      const mqttOptions = { ...this.options, ...options };

      try {
        this.client = mqtt.connect(brokerUrl, mqttOptions);

        this.client.on('connect', () => {
          Logger.info(`Connected to MQTT broker: ${brokerUrl}`);
          this.isConnected = true;
          this.emit('connect');
          resolve();
        });

        this.client.on('message', (topic, payload) => {
          this.handleMessage(topic, payload);
        });

        this.client.on('reconnect', () => {
          Logger.warn('Attempting to reconnect to MQTT broker...');
          this.emit('reconnect');
        });

        this.client.on('error', (err) => {
          Logger.error(`MQTT connection error: ${err.message}`);
          this.emit('error', err);
          reject(new EnergyManagerError(`MQTT connection failed: ${err.message}`, ErrorType.CONNECTION, err));
        });

        this.client.on('offline', () => {
          Logger.warn('MQTT client disconnected');
          this.isConnected = false;
          this.emit('offline');
        });

      } catch (err: any) {
        Logger.error(`Exception connecting to MQTT: ${err.message}`);
        reject(new EnergyManagerError(`MQTT connection exception: ${err.message}`, ErrorType.CONNECTION, err));
      }
    });
  }

  /**
   * Disconnects from the MQTT broker
   *
   * @returns Promise that resolves when disconnected or rejects on error
   * @throws {EnergyManagerError} If disconnection fails
   */
  public disconnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        resolve();
        return;
      }

      this.client.end(false, {}, (err) => {
        if (err) {
          reject(new EnergyManagerError(`Disconnect error: ${err.message}`, ErrorType.CONNECTION, err));
        } else {
          Logger.info('Disconnected from MQTT broker');
          this.isConnected = false;
          this.client = null;
          resolve();
        }
      });
    });
  }

  /**
   * Publishes a message to an MQTT topic
   *
   * @param topic - MQTT topic to publish to
   * @param message - Message content (string or object that will be JSON stringified)
   * @param options - Publish options like QoS level and retain flag
   * @returns Promise that resolves when published or rejects on error
   * @throws {EnergyManagerError} If not connected or publish fails
   */
  public publish(topic: string, message: string | object, options?: mqtt.IClientPublishOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.isConnected) {
        reject(new EnergyManagerError('Not connected to MQTT broker', ErrorType.CONNECTION));
        return;
      }

      const payload = typeof message === 'string' ? message : JSON.stringify(message);

      const defaultOptions: mqtt.IClientPublishOptions = {
        qos: 1,
        retain: false
      };

      const publishOptions = { ...defaultOptions, ...options };

      this.client.publish(topic, payload, publishOptions, (err) => {
        if (err) {
          Logger.error(`Error publishing to ${topic}: ${err.message}`);
          reject(new EnergyManagerError(`Failed to publish message: ${err.message}`, ErrorType.COMMAND_FAILED, err));
        } else {
          Logger.debug(`Message published to ${topic}: ${payload}`);
          resolve();
        }
      });
    });
  }

  /**
   * Subscribes to an MQTT topic
   *
   * @param topic - MQTT topic to subscribe to
   * @param callback - Optional callback function for this specific topic
   * @returns Promise that resolves when subscribed or rejects on error
   * @throws {EnergyManagerError} If not connected or subscribe fails
   */
  public subscribe(topic: string, callback?: (topic: string, payload: Buffer) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.isConnected) {
        reject(new EnergyManagerError('Not connected to MQTT broker', ErrorType.CONNECTION));
        return;
      }

      // Register callback if provided
      if (callback) {
        this.topicSubscriptions.set(topic, callback);
      }

      this.client.subscribe(topic, { qos: 1 }, (err) => {
        if (err) {
          Logger.error(`Error subscribing to topic ${topic}: ${err.message}`);
          reject(new EnergyManagerError(`Failed to subscribe to topic: ${err.message}`, ErrorType.COMMAND_FAILED, err));
        } else {
          Logger.info(`Subscribed to topic: ${topic}`);
          resolve();
        }
      });
    });
  }

  /**
   * Unsubscribes from an MQTT topic
   *
   * @param topic - MQTT topic to unsubscribe from
   * @returns Promise that resolves when unsubscribed or rejects on error
   * @throws {EnergyManagerError} If not connected or unsubscribe fails
   */
  public unsubscribe(topic: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.isConnected) {
        reject(new EnergyManagerError('Not connected to MQTT broker', ErrorType.CONNECTION));
        return;
      }

      // Remove registered callback
      this.topicSubscriptions.delete(topic);

      this.client.unsubscribe(topic, (err) => {
        if (err) {
          Logger.error(`Error unsubscribing from topic ${topic}: ${err.message}`);
          reject(new EnergyManagerError(`Failed to unsubscribe from topic: ${err.message}`, ErrorType.COMMAND_FAILED, err));
        } else {
          Logger.info(`Unsubscribed from topic: ${topic}`);
          resolve();
        }
      });
    });
  }

  /**
   * Checks if connected to the MQTT broker
   *
   * @returns True if connected to the broker
   */
  public isClientConnected(): boolean {
    return this.isConnected && !!this.client;
  }

  /**
   * Handles incoming MQTT messages
   * @private
   */
  private handleMessage(topic: string, payload: Buffer): void {
    Logger.debug(`Message received on topic ${topic}`);

    // Emit event for all listeners
    this.emit('message', topic, payload);

    // Call specific callback if registered
    const callback = this.topicSubscriptions.get(topic);
    if (callback) {
      try {
        callback(topic, payload);
      } catch (err: any) {
        Logger.error(`Error in callback for topic ${topic}: ${err.message}`);
      }
    }
  }
}
