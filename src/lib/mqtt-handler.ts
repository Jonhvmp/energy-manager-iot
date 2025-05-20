import * as mqtt from "mqtt";
import { EventEmitter } from "events";
import Logger from "../utils/logger";
import { validateMqttBrokerUrl } from "../utils/validators";
import { EnergyManagerError, ErrorType } from "../utils/error-handler";

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
  private brokerUrl: string = "";
  private isConnected: boolean = false;
  private topicSubscriptions: Map<
    string,
    (topic: string, payload: Buffer) => void
  >;
  private logger = Logger.child("MqttHandler");

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
      ...options,
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
   */ public connect(
    brokerUrl: string,
    options?: MqttHandlerOptions,
  ): Promise<void> {
    // Create a connection-specific logger with unique correlation ID
    const connectionId = `mqtt_${Date.now()}`;
    const connLogger = this.logger.withCorrelationId(connectionId);

    return new Promise((resolve, reject) => {
      connLogger.info("Connecting to MQTT broker", {
        brokerUrl,
        clientId: this.options.clientId,
      });

      if (!validateMqttBrokerUrl(brokerUrl)) {
        connLogger.error("Connection failed - Invalid MQTT broker URL", {
          brokerUrl,
        });
        reject(
          new EnergyManagerError(
            "Invalid MQTT broker URL",
            ErrorType.VALIDATION,
          ),
        );
        return;
      }

      this.brokerUrl = brokerUrl;

      // Merge options
      const mqttOptions = { ...this.options, ...options };

      try {
        connLogger.debug("Initializing MQTT client connection", {
          options: {
            ...mqttOptions,
            // Hide password for security
            password: mqttOptions.password ? "********" : undefined,
          },
        });

        this.client = mqtt.connect(brokerUrl, mqttOptions);

        this.client.on("connect", () => {
          connLogger.info("Successfully connected to MQTT broker", {
            broker: brokerUrl,
            clientId: mqttOptions.clientId,
          });
          this.isConnected = true;
          this.emit("connect");
          resolve();
        });

        this.client.on("message", (topic, payload) => {
          this.handleMessage(topic, payload);
        });

        this.client.on("reconnect", () => {
          connLogger.warn("Attempting to reconnect to MQTT broker", {
            broker: this.brokerUrl,
            reconnectPeriod: mqttOptions.reconnectPeriod,
          });
          this.emit("reconnect");
        });
        this.client.on("error", (err) => {
          connLogger.error("MQTT connection error", {
            broker: this.brokerUrl,
            errorMessage: err.message,
            errorStack: err.stack,
          });
          this.emit("error", err);
          reject(
            new EnergyManagerError(
              `MQTT connection failed: ${err.message}`,
              ErrorType.CONNECTION,
              err,
            ),
          );
        });

        this.client.on("offline", () => {
          connLogger.warn("MQTT client disconnected", {
            broker: this.brokerUrl,
            previouslyConnected: this.isConnected,
          });
          this.isConnected = false;
          this.emit("offline");
        });
      } catch (err: any) {
        connLogger.error("Exception connecting to MQTT broker", {
          errorMessage: err.message,
          errorStack: err.stack,
          broker: brokerUrl,
        });
        reject(
          new EnergyManagerError(
            `MQTT connection exception: ${err.message}`,
            ErrorType.CONNECTION,
            err,
          ),
        );
      }
    });
  }

  /**
   * Disconnects from the MQTT broker
   *
   * @returns Promise that resolves when disconnected or rejects on error
   * @throws {EnergyManagerError} If disconnection fails
   */ public disconnect(): Promise<void> {
    const disconnectLogger = this.logger.withCorrelationId(
      `disconnect_${Date.now()}`,
    );

    return new Promise((resolve, reject) => {
      if (!this.client) {
        disconnectLogger.debug(
          "Disconnect called but client is not initialized",
        );
        resolve();
        return;
      }

      disconnectLogger.info("Disconnecting from MQTT broker", {
        broker: this.brokerUrl,
        clientId: this.options.clientId,
      });

      this.client.end(false, {}, (err) => {
        if (err) {
          disconnectLogger.error("Error disconnecting from MQTT broker", {
            errorMessage: err.message,
            errorStack: err.stack,
          });
          reject(
            new EnergyManagerError(
              `Disconnect error: ${err.message}`,
              ErrorType.CONNECTION,
              err,
            ),
          );
        } else {
          disconnectLogger.info("Successfully disconnected from MQTT broker", {
            broker: this.brokerUrl,
          });
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
   */ public publish(
    topic: string,
    message: string | object,
    options?: mqtt.IClientPublishOptions,
  ): Promise<void> {
    const publishId = `pub_${Date.now()}`;
    const pubLogger = this.logger.withCorrelationId(publishId);

    return new Promise((resolve, reject) => {
      if (!this.client || !this.isConnected) {
        pubLogger.error("Publish failed - not connected to MQTT broker", {
          topic,
        });
        reject(
          new EnergyManagerError(
            "Not connected to MQTT broker",
            ErrorType.CONNECTION,
          ),
        );
        return;
      }

      const payload =
        typeof message === "string" ? message : JSON.stringify(message);

      pubLogger.debug("Publishing message to MQTT broker", {
        topic,
        payloadSize: payload.length,
        messageType: typeof message,
      });

      const defaultOptions: mqtt.IClientPublishOptions = {
        qos: 1,
        retain: false,
      };

      const publishOptions = { ...defaultOptions, ...options };

      this.client.publish(topic, payload, publishOptions, (err) => {
        if (err) {
          pubLogger.error("Failed to publish message", {
            topic,
            errorMessage: err.message,
            errorStack: err.stack,
          });
          reject(
            new EnergyManagerError(
              `Failed to publish message: ${err.message}`,
              ErrorType.COMMAND_FAILED,
              err,
            ),
          );
        } else {
          pubLogger.debug("Message successfully published", {
            topic,
            qos: publishOptions.qos,
            retain: publishOptions.retain,
          });
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
   */ public subscribe(
    topic: string,
    callback?: (topic: string, payload: Buffer) => void,
  ): Promise<void> {
    const subscriptionId = `sub_${Date.now()}`;
    const subLogger = this.logger.withCorrelationId(subscriptionId);

    return new Promise((resolve, reject) => {
      if (!this.client || !this.isConnected) {
        subLogger.error("Subscribe failed - not connected to MQTT broker", {
          topic,
        });
        reject(
          new EnergyManagerError(
            "Not connected to MQTT broker",
            ErrorType.CONNECTION,
          ),
        );
        return;
      }

      subLogger.debug("Subscribing to MQTT topic", {
        topic,
        hasCallback: !!callback,
      });

      // Register callback if provided
      if (callback) {
        this.topicSubscriptions.set(topic, callback);
        subLogger.trace("Registered callback for topic", { topic });
      }

      this.client.subscribe(topic, { qos: 1 }, (err) => {
        if (err) {
          subLogger.error("Failed to subscribe to topic", {
            topic,
            errorMessage: err.message,
            errorStack: err.stack,
          });
          reject(
            new EnergyManagerError(
              `Failed to subscribe to topic: ${err.message}`,
              ErrorType.COMMAND_FAILED,
              err,
            ),
          );
        } else {
          subLogger.info("Successfully subscribed to topic", { topic });
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
   */ public unsubscribe(topic: string): Promise<void> {
    const unsubscribeId = `unsub_${Date.now()}`;
    const unsubLogger = this.logger.withCorrelationId(unsubscribeId);

    return new Promise((resolve, reject) => {
      if (!this.client || !this.isConnected) {
        unsubLogger.error("Unsubscribe failed - not connected to MQTT broker", {
          topic,
        });
        reject(
          new EnergyManagerError(
            "Not connected to MQTT broker",
            ErrorType.CONNECTION,
          ),
        );
        return;
      }

      unsubLogger.debug("Unsubscribing from MQTT topic", { topic });

      // Check if we have a callback registered
      const hadCallback = this.topicSubscriptions.has(topic);

      // Remove registered callback
      this.topicSubscriptions.delete(topic);

      this.client.unsubscribe(topic, (err) => {
        if (err) {
          unsubLogger.error("Failed to unsubscribe from topic", {
            topic,
            errorMessage: err.message,
            errorStack: err.stack,
          });
          reject(
            new EnergyManagerError(
              `Failed to unsubscribe from topic: ${err.message}`,
              ErrorType.COMMAND_FAILED,
              err,
            ),
          );
        } else {
          unsubLogger.info("Successfully unsubscribed from topic", {
            topic,
            hadCallback,
          });
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
   */ private handleMessage(topic: string, payload: Buffer): void {
    // Create a unique message ID for tracing
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    const msgLogger = this.logger.withCorrelationId(messageId);

    msgLogger.debug("Message received", {
      topic,
      payloadSize: payload.length,
    });

    // Emit event for all listeners
    this.emit("message", topic, payload);

    // Call specific callback if registered
    const callback = this.topicSubscriptions.get(topic);
    if (callback) {
      try {
        msgLogger.trace("Executing registered callback for topic", { topic });
        callback(topic, payload);
      } catch (err: any) {
        msgLogger.error("Error in message callback handler", {
          topic,
          errorMessage: err.message,
          errorStack: err.stack,
        });
      }
    }
  }
}
