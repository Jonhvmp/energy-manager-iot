import { EventEmitter } from 'events';
import { MqttHandler, MqttHandlerOptions } from './mqtt-handler';
import { DeviceRegistry } from './device-registry';
import { Device, DeviceType, DeviceConfig } from '../types/device';
import { DeviceCommand, CommandType } from '../types/command';
import { DeviceStatus, PowerMode, ConnectionStatus, GroupStatistics } from '../types/status';
import { EnergyManagerError, ErrorType } from '../utils/error-handler';
import Logger from '../utils/logger';

/**
 * Configuration options for the Energy Manager
 */
export interface EnergyManagerOptions {
  /** Prefix for MQTT topics, defaults to 'device/' */
  topicPrefix?: string;

  /** MQTT client configuration options */
  mqttOptions?: MqttHandlerOptions;

  /** Enable automatic reconnection, defaults to true */
  autoReconnect?: boolean;

  /** Interval for status checking in milliseconds, defaults to 60000 (1 minute) */
  statusInterval?: number;
}

/**
 * Main class that manages IoT devices energy via MQTT
 *
 * This class serves as the central entry point for the library, providing
 * device management, command control, and status monitoring functionality.
 *
 * @remarks
 * EnergyManager extends EventEmitter to provide event-based notifications
 * for important system events like status updates or connection changes.
 *
 * @example
 * ```ts
 * const manager = new EnergyManager({
 *   topicPrefix: 'home/devices/',
 *   statusInterval: 30000
 * });
 *
 * await manager.connect('mqtt://broker.example.com');
 * manager.registerDevice('temp01', 'Temperature Sensor', DeviceType.SENSOR);
 * ```
 */
export class EnergyManager extends EventEmitter {
  private mqtt: MqttHandler;
  private registry: DeviceRegistry;
  private topicPrefix: string;
  private statusCheckInterval?: NodeJS.Timeout;
  private autoReconnect: boolean;
  private statusUpdateInterval: number;
  private logger = Logger.child('EnergyManager');

  /**
   * Creates a new Energy Manager instance
   *
   * @param options - Configuration options for the manager
   */
  constructor(options: EnergyManagerOptions = {}) {
    super();

    // Default settings
    this.topicPrefix = options.topicPrefix || 'device/';
    this.autoReconnect = options.autoReconnect !== false;
    this.statusUpdateInterval = options.statusInterval || 60000; // 1 minute

    // Initialize components
    this.mqtt = new MqttHandler(options.mqttOptions);
    this.registry = new DeviceRegistry();

    // Set up MQTT event listeners
    this.setupMqttEventListeners();
  }

  /**
   * Connects to the MQTT broker
   *
   * @param brokerUrl - URL of the MQTT broker to connect to
   * @param options - Additional MQTT connection options
   * @throws {EnergyManagerError} If connection fails
   */  public async connect(brokerUrl: string, options?: MqttHandlerOptions): Promise<void> {
    const connectionId = `conn_${Date.now()}`;
    const connLogger = this.logger.withCorrelationId(connectionId);

    try {
      connLogger.info('Connecting to MQTT broker', { brokerUrl, options });
      await this.mqtt.connect(brokerUrl, options);
      connLogger.info('Successfully connected to MQTT broker');

      // Subscribe to status topics for existing devices
      await this.subscribeToAllDeviceStatuses();

      // Start periodic status check
      this.startStatusCheck();

      this.emit('connected');
    } catch (error) {
      connLogger.error('Failed to connect to MQTT broker', error);
      throw error;
    }
  }

  /**
   * Disconnects from the MQTT broker
   *
   * @throws {EnergyManagerError} If disconnection fails
   */  public async disconnect(): Promise<void> {
    // Stop status checking
    this.stopStatusCheck();

    try {
      this.logger.info('Disconnecting from MQTT broker');
      await this.mqtt.disconnect();
      this.logger.info('Successfully disconnected from MQTT broker');
      this.emit('disconnected');
    } catch (error) {
      this.logger.error('Failed to disconnect from MQTT broker', error);
      throw error;
    }
  }

  /**
   * Registers a new device in the system
   *
   * @param id - Unique identifier for the device
   * @param name - Human-readable device name
   * @param type - Type of device from the DeviceType enum
   * @param config - Optional device configuration parameters
   * @param groups - Optional initial groups to assign the device to
   * @returns The newly registered device object
   * @throws {EnergyManagerError} If device ID is invalid or already exists
   */  public registerDevice(
    id: string,
    name: string,
    type: DeviceType,
    config: DeviceConfig = {},
    groups: string[] = []
  ): Device {
    // Create device-specific logger with correlation ID
    const deviceLogger = this.logger.withCorrelationId(id);
    deviceLogger.info('Registering new device', { id, name, type, groupCount: groups.length });

    const device = this.registry.registerDevice(id, name, type, config, groups);

    // Subscribe to status topic if connected
    if (this.mqtt.isClientConnected()) {
      this.subscribeToDeviceStatus(id).catch(err => {
        deviceLogger.error('Failed to subscribe to device status topic', err);
      });
    }

    this.emit('deviceRegistered', device);
    return device;
  }

  /**
   * Updates an existing device's properties
   *
   * @param id - ID of the device to update
   * @param updates - Object containing properties to update
   * @returns The updated device object
   * @throws {EnergyManagerError} If device not found or configuration is invalid
   */
  public updateDevice(id: string, updates: Partial<Omit<Device, 'id' | 'createdAt'>>): Device {
    const device = this.registry.updateDevice(id, updates);
    this.emit('deviceUpdated', device);
    return device;
  }

  /**
   * Removes a device from the system
   *
   * @param id - ID of the device to remove
   * @returns True if device was successfully removed
   */  public removeDevice(id: string): boolean {
    const deviceLogger = this.logger.withCorrelationId(id);
    deviceLogger.info('Removing device', { deviceId: id });

    // Unsubscribe from status topic
    if (this.mqtt.isClientConnected()) {
      const statusTopic = this.getStatusTopic(id);
      deviceLogger.debug('Unsubscribing from device status topic', { topic: statusTopic });

      this.mqtt.unsubscribe(statusTopic).catch(err => {
        deviceLogger.error('Failed to unsubscribe from status topic', err);
      });
    }

    const result = this.registry.removeDevice(id);
    if (result) {
      this.emit('deviceRemoved', id);
      deviceLogger.info('Device successfully removed');
    } else {
      deviceLogger.warn('Device removal failed - device may not exist');
    }

    return result;
  }

  /**
   * Retrieves a device by its ID
   *
   * @param id - ID of the device to retrieve
   * @returns The device object
   * @throws {EnergyManagerError} If device not found
   */
  public getDevice(id: string): Device {
    return this.registry.getDevice(id);
  }

  /**
   * Sends a command to a specific device
   *
   * @param deviceId - ID of the destination device
   * @param command - Type of command to send
   * @param payload - Optional data to include with the command
   * @throws {EnergyManagerError} If device not found or not connected to MQTT
   */  public async sendCommand(deviceId: string, command: CommandType, payload?: any): Promise<void> {
    // Generate request ID for tracking the command through the system
    const requestId = this.generateRequestId();
    const cmdLogger = this.logger.withCorrelationId(requestId);

    cmdLogger.info('Sending command to device', {
      deviceId,
      commandType: command,
      hasPayload: payload !== undefined,
      requestId
    });

    if (!this.registry.hasDevice(deviceId)) {
      cmdLogger.warn('Command failed - device not found', { deviceId });
      throw new EnergyManagerError(
        `Device not found: ${deviceId}`,
        ErrorType.DEVICE_NOT_FOUND
      );
    }

    if (!this.mqtt.isClientConnected()) {
      cmdLogger.error('Command failed - not connected to MQTT broker');
      throw new EnergyManagerError(
        'Not connected to MQTT broker',
        ErrorType.CONNECTION
      );
    }

    const commandTopic = this.getCommandTopic(deviceId);
    const commandObject: DeviceCommand = {
      type: command,
      payload,
      timestamp: Date.now(),
      requestId
    };

    try {
      await this.mqtt.publish(commandTopic, commandObject, { qos: 1 });
      cmdLogger.info('Command successfully sent', {
        deviceId,
        topic: commandTopic,
        timestamp: commandObject.timestamp
      });
      this.emit('commandSent', deviceId, commandObject);
    } catch (error) {
      cmdLogger.error('Failed to send command', error);
      throw error;
    }
  }

  /**
   * Sends a command to a group of devices
   *
   * @param groupName - Name of the target device group
   * @param command - Type of command to send
   * @param payload - Optional data to include with the command
   * @throws {EnergyManagerError} If group not found or command delivery fails
   */  public async sendCommandToGroup(groupName: string, command: CommandType, payload?: any): Promise<void> {
    // Generate a group operation ID for the entire command
    const groupOpId = `group_cmd_${Date.now()}`;
    const groupLogger = this.logger.withCorrelationId(groupOpId);

    groupLogger.info('Sending command to device group', {
      groupName,
      commandType: command,
      hasPayload: payload !== undefined
    });

    const deviceIds = this.registry.getDeviceIdsInGroup(groupName);

    if (deviceIds.length === 0) {
      groupLogger.warn('Group command skipped - group has no devices', { groupName });
      return;
    }

    groupLogger.debug('Preparing to send command to devices in group', {
      groupName,
      deviceCount: deviceIds.length,
      deviceIds
    });

    const promises: Promise<void>[] = [];
    for (const deviceId of deviceIds) {
      promises.push(this.sendCommand(deviceId, command, payload));
    }

    try {
      await Promise.all(promises);
      groupLogger.info('Command successfully sent to all devices in group', {
        groupName,
        commandType: command,
        deviceCount: deviceIds.length
      });
    } catch (error) {
      groupLogger.error('Failed to send command to all devices in group', {
        groupName,
        error,
        commandType: command
      });
      throw new EnergyManagerError(
        `Failed to send command to group ${groupName}`,
        ErrorType.COMMAND_FAILED,
        error
      );
    }
  }

  /**
   * Creates a new device group
   *
   * @param name - Name for the new group
   * @returns True if group was created, false if it already exists
   * @throws {EnergyManagerError} If group name is invalid
   */
  public createGroup(name: string): boolean {
    return this.registry.createGroup(name);
  }

  /**
   * Adds a device to a group
   *
   * @param deviceId - ID of the device to add
   * @param groupName - Name of the group to add the device to
   * @returns True if the device was added to the group
   * @throws {EnergyManagerError} If group name is invalid or device not found
   */
  public addDeviceToGroup(deviceId: string, groupName: string): boolean {
    return this.registry.addDeviceToGroup(deviceId, groupName);
  }

  /**
   * Removes a device from a group
   *
   * @param deviceId - ID of the device to remove
   * @param groupName - Name of the group to remove the device from
   * @returns True if the device was removed from the group
   * @throws {EnergyManagerError} If group not found
   */
  public removeDeviceFromGroup(deviceId: string, groupName: string): boolean {
    return this.registry.removeDeviceFromGroup(deviceId, groupName);
  }

  /**
   * Removes a group and disassociates all devices from it
   *
   * @param name - Name of the group to remove
   * @returns True if group was found and removed
   */
  public removeGroup(name: string): boolean {
    return this.registry.removeGroup(name);
  }

  /**
   * Retrieves all devices in a group
   *
   * @param groupName - Name of the group to query
   * @returns Array of devices in the group
   * @throws {EnergyManagerError} If group not found
   */
  public getDevicesInGroup(groupName: string): Device[] {
    return this.registry.getDevicesInGroup(groupName);
  }

  /**
   * Calculates statistics for a group of devices
   *
   * @param groupName - Name of the group to analyze
   * @returns Statistical analysis of the group's devices
   * @throws {EnergyManagerError} If group not found
   */
  public getGroupStatistics(groupName: string): GroupStatistics {
    const devices = this.registry.getDevicesInGroup(groupName);

    // Initialize statistics
    const statistics: GroupStatistics = {
      averageBatteryLevel: 0,
      powerModeDistribution: {
        [PowerMode.NORMAL]: 0,
        [PowerMode.LOW_POWER]: 0,
        [PowerMode.SLEEP]: 0,
        [PowerMode.CRITICAL]: 0
      },
      onlineCount: 0,
      offlineCount: 0,
      totalDevices: devices.length
    };

    // If no devices, return empty statistics
    if (devices.length === 0) {
      return statistics;
    }

    // Calculate statistics
    let batterySum = 0;
    let batteryCount = 0;

    for (const device of devices) {
      // Count online/offline devices
      if (device.status) {
        if (device.status.connectionStatus === ConnectionStatus.ONLINE) {
          statistics.onlineCount++;
        } else {
          statistics.offlineCount++;
        }

        // Add to power mode
        if (device.status.powerMode) {
          statistics.powerModeDistribution[device.status.powerMode]++;
        }

        // Add to battery average calculation
        if (typeof device.status.batteryLevel === 'number') {
          batterySum += device.status.batteryLevel;
          batteryCount++;
        }
      } else {
        statistics.offlineCount++;
      }
    }

    // Calculate battery average
    statistics.averageBatteryLevel = batteryCount > 0 ? batterySum / batteryCount : 0;

    return statistics;
  }

  /**
   * Sets the topic prefix for MQTT communications
   *
   * @param prefix - New prefix to use for all MQTT topics
   * @remarks This will resubscribe to all device status topics if prefix changes
   */  public setTopicPrefix(prefix: string): void {
    this.logger.info('Updating topic prefix', {
      oldPrefix: this.topicPrefix,
      newPrefix: prefix
    });

    // Ensure prefix ends with /
    if (!prefix.endsWith('/')) {
      prefix = prefix + '/';
    }

    // If prefix changed and connected, resubscribe to all topics
    const resubscribe = prefix !== this.topicPrefix && this.mqtt.isClientConnected();

    this.topicPrefix = prefix;
    this.logger.info('Topic prefix updated', { prefix: this.topicPrefix });

    if (resubscribe) {
      this.logger.info('Resubscribing to status topics with new prefix');
      this.subscribeToAllDeviceStatuses().catch(err => {
        this.logger.error('Failed to resubscribe to status topics with new prefix', err);
      });
    }
  }

  /**
   * Checks if connected to the MQTT broker
   *
   * @returns True if connected to MQTT broker
   */
  public isConnected(): boolean {
    return this.mqtt.isClientConnected();
  }

  /**
   * Retrieves all registered devices
   *
   * @returns Array of all devices
   */
  public getAllDevices(): Device[] {
    return this.registry.getAllDevices();
  }

  /**
   * Retrieves all defined groups
   *
   * @returns Array of all group names
   */
  public getAllGroups(): string[] {
    return this.registry.getAllGroups();
  }

  /**
   * Puts a device into sleep mode to conserve energy
   *
   * @param deviceId - ID of the device to put to sleep
   * @param duration - Optional sleep duration in seconds
   * @throws {EnergyManagerError} If device not found or command fails
   */
  public async sleepDevice(deviceId: string, duration?: number): Promise<void> {
    await this.sendCommand(deviceId, CommandType.SLEEP, { duration });
  }

  /**
   * Wakes a device from sleep mode
   *
   * @param deviceId - ID of the device to wake
   * @throws {EnergyManagerError} If device not found or command fails
   */
  public async wakeDevice(deviceId: string): Promise<void> {
    await this.sendCommand(deviceId, CommandType.WAKE);
  }

  /**
   * Puts an entire group of devices into sleep mode
   *
   * @param groupName - Name of the group to put to sleep
   * @param duration - Optional sleep duration in seconds
   * @throws {EnergyManagerError} If group not found or command fails
   */
  public async sleepGroup(groupName: string, duration?: number): Promise<void> {
    await this.sendCommandToGroup(groupName, CommandType.SLEEP, { duration });
  }

  /**
   * Wakes an entire group of devices from sleep mode
   *
   * @param groupName - Name of the group to wake
   * @throws {EnergyManagerError} If group not found or command fails
   */
  public async wakeGroup(groupName: string): Promise<void> {
    await this.sendCommandToGroup(groupName, CommandType.WAKE);
  }

  /**
   * Sets up MQTT event listeners
   * @private
   */
  private setupMqttEventListeners(): void {
    this.mqtt.on('message', (topic: string, message: Buffer) => {
      this.handleIncomingMessage(topic, message);
    });

    this.mqtt.on('reconnect', () => {
      this.emit('reconnecting');
    });

    this.mqtt.on('offline', () => {
      this.emit('disconnected');
    });

    this.mqtt.on('error', (error: Error) => {
      this.emit('error', error);
    });
  }

  /**
   * Processes incoming MQTT messages
   * @private
   */  private handleIncomingMessage(topic: string, message: Buffer): void {
    // Check if it's a status topic
    const deviceId = this.extractDeviceIdFromStatusTopic(topic);
    if (!deviceId) {
      this.logger.trace('Ignoring non-status message', { topic });
      return;
    }

    // Create device-specific logger
    const deviceLogger = this.logger.withCorrelationId(deviceId);

    try {
      // Parse message as JSON
      const messageStr = message.toString();
      deviceLogger.trace('Status message received', {
        topic,
        messageSize: messageStr.length
      });

      const statusData = JSON.parse(messageStr);

      // Check if it's a registered device
      if (this.registry.hasDevice(deviceId)) {
        const timestamp = Date.now();
        // Update device status
        const device = this.registry.updateDeviceStatus(deviceId, {
          deviceId,
          ...statusData,
          lastSeen: timestamp
        });

        // Emit status update event
        this.emit('statusUpdate', deviceId, device.status);

        deviceLogger.debug('Device status updated', {
          connectionStatus: device.status?.connectionStatus,
          powerMode: device.status?.powerMode,
          timestamp
        });
      } else {
        deviceLogger.debug('Status received for unregistered device', {
          suggestedAction: 'Register the device to process its status updates'
        });
      }
    } catch (err) {
      deviceLogger.error('Failed to process device status message', err);
    }
  }

  /**
   * Extracts device ID from a status topic
   * @private
   */
  private extractDeviceIdFromStatusTopic(topic: string): string | null {
    const prefix = this.topicPrefix;
    const suffix = '/status';

    if (topic.startsWith(prefix) && topic.endsWith(suffix)) {
      return topic.substring(prefix.length, topic.length - suffix.length);
    }

    return null;
  }

  /**
   * Gets the status topic for a device
   * @private
   */
  private getStatusTopic(deviceId: string): string {
    return `${this.topicPrefix}${deviceId}/status`;
  }

  /**
   * Gets the command topic for a device
   * @private
   */
  private getCommandTopic(deviceId: string): string {
    return `${this.topicPrefix}${deviceId}/command`;
  }

  /**
   * Subscribes to a device's status topic
   * @private
   */
  private async subscribeToDeviceStatus(deviceId: string): Promise<void> {
    const statusTopic = this.getStatusTopic(deviceId);
    await this.mqtt.subscribe(statusTopic);
  }

  /**
   * Subscribes to all device status topics
   * @private
   */  private async subscribeToAllDeviceStatuses(): Promise<void> {
    if (!this.mqtt.isClientConnected()) {
      this.logger.debug('Skipping subscription to device statuses - not connected to MQTT broker');
      return;
    }

    const deviceIds = this.registry.getAllDeviceIds();

    this.logger.info('Subscribing to device status topics', {
      deviceCount: deviceIds.length,
      topicPrefix: this.topicPrefix
    });

    const promises: Promise<void>[] = [];

    for (const deviceId of deviceIds) {
      promises.push(this.subscribeToDeviceStatus(deviceId));
    }

    await Promise.all(promises);
    this.logger.info('Successfully subscribed to device status topics', {
      deviceCount: deviceIds.length,
      topics: deviceIds.map(id => this.getStatusTopic(id))
    });
  }

  /**
   * Starts periodic status checking
   * @private
   */  private startStatusCheck(): void {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
    }

    this.statusCheckInterval = setInterval(() => {
      this.checkDevicesStatus();
    }, this.statusUpdateInterval);

    this.logger.debug('Status checking started', {
      intervalMs: this.statusUpdateInterval,
      nextCheckAt: new Date(Date.now() + this.statusUpdateInterval).toISOString()
    });
  }

  /**
   * Stops periodic status checking
   * @private
   */
  private stopStatusCheck(): void {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = undefined;
      this.logger.debug('Status checking stopped');
    }
  }

  /**
   * Checks status of all devices and marks them offline if not responsive
   * @private
   */  private checkDevicesStatus(): void {
    this.logger.trace('Running periodic device status check');

    const devices = this.registry.getAllDevices();
    const now = Date.now();
    const threshold = 2 * this.statusUpdateInterval;

    // Keep statistics for logging
    let checkedCount = 0;
    let offlineCount = 0;
    let markedOfflineCount = 0;

    for (const device of devices) {
      checkedCount++;
      const deviceLogger = this.logger.withCorrelationId(device.id);

      // Check if we have status
      if (device.status) {
        const lastSeenDiff = now - device.status.lastSeen;

        // Check if status is outdated (2x status interval)
        if (lastSeenDiff > threshold) {
          // Mark as offline if was online
          if (device.status.connectionStatus === ConnectionStatus.ONLINE) {
            deviceLogger.info('Device connection lost - marking as offline', {
              deviceId: device.id,
              deviceName: device.name,
              lastSeen: new Date(device.status.lastSeen).toISOString(),
              timeSinceLastSeenMs: lastSeenDiff
            });

            const updatedStatus = {
              ...device.status,
              connectionStatus: ConnectionStatus.OFFLINE,
              lastSeen: device.status.lastSeen // keep last timestamp
            };

            // Update status
            this.registry.updateDeviceStatus(device.id, updatedStatus);
            this.emit('deviceOffline', device.id);
            markedOfflineCount++;
          } else {
            offlineCount++;
          }
        }
      }
    }

    this.logger.debug('Device status check completed', {
      devicesChecked: checkedCount,
      alreadyOffline: offlineCount,
      newlyMarkedOffline: markedOfflineCount,
      nextCheckAt: new Date(now + this.statusUpdateInterval).toISOString()
    });
  }

  /**
   * Generates a unique request ID
   * @private
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
