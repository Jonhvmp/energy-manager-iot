import { Device, DeviceConfig, DeviceType } from '../types/device';
import { DeviceStatus, PowerMode, ConnectionStatus } from '../types/status';
import { validateDeviceId, validateGroupName, validateDeviceConfig } from '../utils/validators';
import { EnergyManagerError, ErrorType } from '../utils/error-handler';
import Logger from '../utils/logger';

/**
 * Manages IoT device registration and grouping
 *
 * This class provides a centralized registry for all IoT devices,
 * with features for device management, grouping, and status updates.
 * It enforces validation rules for device IDs and configurations.
 *
 * @remarks
 * The registry maintains device-group relationships in both directions
 * for efficient querying and management.
 */
export class DeviceRegistry {
  private devices: Map<string, Device>;
  private groups: Map<string, Set<string>>;
  private logger = Logger.child('DeviceRegistry');

  constructor() {
    this.devices = new Map<string, Device>();
    this.groups = new Map<string, Set<string>>();
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
   *
   * @example
   * ```ts
   * registry.registerDevice('temp01', 'Kitchen Temperature', DeviceType.SENSOR);
   * ```
   */
  public registerDevice(
    id: string,
    name: string,
    type: DeviceType,
    config: DeviceConfig = {},
    groups: string[] = []
  ): Device {
    // Validate ID
    if (!validateDeviceId(id)) {
      throw new EnergyManagerError(
        `Invalid device ID: ${id}`,
        ErrorType.VALIDATION
      );
    }

    // Check if device already exists
    if (this.devices.has(id)) {
      throw new EnergyManagerError(
        `Device with ID ${id} already exists`,
        ErrorType.VALIDATION
      );
    }

    // Validate configuration
    if (!validateDeviceConfig(config)) {
      throw new EnergyManagerError(
        `Invalid configuration for device ${id}`,
        ErrorType.VALIDATION
      );
    }

    // Create device
    const now = Date.now();
    const device: Device = {
      id,
      name,
      type,
      groups: [],
      config,
      createdAt: now,
      updatedAt: now
    };

    // Add to specified groups
    if (groups.length > 0) {
      for (const groupName of groups) {
        this.addDeviceToGroup(id, groupName, device);
      }
    }    // Store device
    this.devices.set(id, device);
    this.logger.info(`Device registered successfully`, {
      deviceId: id,
      deviceName: name,
      deviceType: type,
      groupCount: groups.length
    });

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
    const device = this.getDevice(id);

    // Update properties
    if (updates.name) {
      device.name = updates.name;
    }

    if (updates.type) {
      device.type = updates.type;
    }

    if (updates.config) {
      // Validate new configuration
      if (!validateDeviceConfig(updates.config)) {
        throw new EnergyManagerError(
          `Invalid configuration for device ${id}`,
          ErrorType.VALIDATION
        );
      }
      device.config = { ...device.config, ...updates.config };
    }

    // Update timestamp
    device.updatedAt = Date.now();    // Update in map
    this.devices.set(id, device);
    this.logger.info(`Device updated`, {
      deviceId: id,
      updatedFields: Object.keys(updates),
      timestamp: device.updatedAt
    });

    return device;
  }

  /**
   * Updates a device's status information
   *
   * @param id - ID of the device to update
   * @param status - New status information
   * @returns The updated device object
   * @throws {EnergyManagerError} If device not found
   */
  public updateDeviceStatus(id: string, status: DeviceStatus): Device {
    const device = this.getDevice(id);

    // Update status and timestamp
    device.status = status;
    device.updatedAt = Date.now();    // Update in map
    this.devices.set(id, device);
    this.logger.debug(`Device status updated`, {
      deviceId: id,
      connectionStatus: status.connectionStatus,
      timestamp: device.updatedAt
    });

    return device;
  }

  /**
   * Removes a device from the registry and all its groups
   *
   * @param id - ID of the device to remove
   * @returns True if device was found and removed, false otherwise
   */
  public removeDevice(id: string): boolean {
    if (!this.devices.has(id)) {
      return false;
    }

    // Get device's groups
    const device = this.devices.get(id)!;

    // Remove from all groups
    for (const groupName of device.groups) {
      const group = this.groups.get(groupName);
      if (group) {
        group.delete(id);
      }
    }    // Remove from registry
    this.devices.delete(id);
    this.logger.info(`Device removed from registry`, {
      deviceId: id,
      deviceName: device.name,
      removedFromGroups: device.groups
    });

    return true;
  }

  /**
   * Retrieves a device by its ID
   *
   * @param id - ID of the device to retrieve
   * @returns The device object
   * @throws {EnergyManagerError} If device not found
   */  public getDevice(id: string): Device {
    const device = this.devices.get(id);
    if (!device) {
      this.logger.warn(`Device lookup failed - device not found`, { deviceId: id });
      throw new EnergyManagerError(
        `Device not found: ${id}`,
        ErrorType.DEVICE_NOT_FOUND
      );
    }

    // Add trace log for device retrieval
    this.logger.trace(`Device retrieved`, { deviceId: id });
    return device;
  }

  /**
   * Checks if a device exists in the registry
   *
   * @param id - ID of the device to check
   * @returns True if device exists, false otherwise
   */
  public hasDevice(id: string): boolean {
    return this.devices.has(id);
  }

  /**
   * Creates a new device group
   *
   * @param name - Name for the new group
   * @returns True if group was created, false if it already exists
   * @throws {EnergyManagerError} If group name is invalid
   */
  public createGroup(name: string): boolean {
    // Validate group name
    if (!validateGroupName(name)) {
      throw new EnergyManagerError(
        `Invalid group name: ${name}`,
        ErrorType.VALIDATION
      );
    }

    // Check if group already exists
    if (this.groups.has(name)) {
      return false;
    }    // Create empty group
    this.groups.set(name, new Set<string>());
    this.logger.info(`Group created`, {
      groupName: name,
      timestamp: Date.now()
    });

    return true;
  }

  /**
   * Adds a device to a group
   *
   * @param deviceId - ID of the device to add
   * @param groupName - Name of the group to add the device to
   * @param device - Optional device object (to avoid lookup if already available)
   * @returns True if the device was added to the group
   * @throws {EnergyManagerError} If group name is invalid or device not found
   */
  public addDeviceToGroup(deviceId: string, groupName: string, device?: Device): boolean {
    // Validate group name
    if (!validateGroupName(groupName)) {
      throw new EnergyManagerError(
        `Invalid group name: ${groupName}`,
        ErrorType.VALIDATION
      );
    }

    // Get or create the group
    if (!this.groups.has(groupName)) {
      this.createGroup(groupName);
    }

    // Device reference
    const deviceRef = device || this.getDevice(deviceId);

    // Add to group
    const group = this.groups.get(groupName)!;
    group.add(deviceId);

    // Add group to device if not already there
    if (!deviceRef.groups.includes(groupName)) {
      deviceRef.groups.push(groupName);
      deviceRef.updatedAt = Date.now();
      this.devices.set(deviceId, deviceRef);
    }    // Log with device correlation ID
    this.logger.withCorrelationId(deviceId).debug(`Device added to group`, {
      deviceId,
      groupName,
      deviceGroups: deviceRef.groups,
      groupSize: group.size
    });
    return true;
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
    // Check if group exists
    if (!this.groups.has(groupName)) {
      throw new EnergyManagerError(
        `Group not found: ${groupName}`,
        ErrorType.GROUP_NOT_FOUND
      );
    }

    // Remove from group
    const group = this.groups.get(groupName)!;
    const removed = group.delete(deviceId);

    if (removed) {
      // Remove group from device's group list
      const device = this.devices.get(deviceId);
      if (device) {        device.groups = device.groups.filter(g => g !== groupName);
        device.updatedAt = Date.now();
        this.devices.set(deviceId, device);
        this.logger.withCorrelationId(deviceId).debug(`Device removed from group`, {
          deviceId,
          groupName,
          remainingGroups: device.groups.length
        });
      }
    }

    return removed;
  }

  /**
   * Removes a group and disassociates all devices from it
   *
   * @param name - Name of the group to remove
   * @returns True if group was found and removed
   */
  public removeGroup(name: string): boolean {
    // Check if group exists
    if (!this.groups.has(name)) {
      return false;
    }

    // Get devices in group
    const group = this.groups.get(name)!;

    // Remove group from each device
    for (const deviceId of group) {
      const device = this.devices.get(deviceId);
      if (device) {
        device.groups = device.groups.filter(g => g !== name);
        device.updatedAt = Date.now();
        this.devices.set(deviceId, device);
      }
    }    // Remove the group
    this.groups.delete(name);
    this.logger.info(`Group removed`, {
      groupName: name,
      deviceCount: group.size,
      timestamp: Date.now()
    });

    return true;
  }

  /**
   * Retrieves all devices in a group
   *
   * @param groupName - Name of the group to query
   * @returns Array of devices in the group
   * @throws {EnergyManagerError} If group not found
   */  public getDevicesInGroup(groupName: string): Device[] {
    // Check if group exists
    if (!this.groups.has(groupName)) {
      this.logger.warn(`Group lookup failed - group not found`, { groupName });
      throw new EnergyManagerError(
        `Group not found: ${groupName}`,
        ErrorType.GROUP_NOT_FOUND
      );
    }

    const group = this.groups.get(groupName)!;
    const devices: Device[] = [];    // Collect all devices in the group
    for (const deviceId of group) {
      const device = this.devices.get(deviceId);
      if (device) {
        devices.push(device);
      } else {
        // Log inconsistency in data
        this.logger.warn(`Data inconsistency detected: Device in group not found in registry`, {
          groupName,
          deviceId,
          timestamp: Date.now()
        });
      }
    }

    this.logger.debug(`Retrieved devices in group`, {
      groupName,
      deviceCount: devices.length,
      totalMembersInGroup: group.size
    });
    return devices;
  }

  /**
   * Retrieves IDs of all devices in a group
   *
   * @param groupName - Name of the group to query
   * @returns Array of device IDs in the group
   * @throws {EnergyManagerError} If group not found
   */  public getDeviceIdsInGroup(groupName: string): string[] {
    // Check if group exists
    if (!this.groups.has(groupName)) {
      this.logger.warn(`Group lookup failed - group not found`, { groupName });
      throw new EnergyManagerError(
        `Group not found: ${groupName}`,
        ErrorType.GROUP_NOT_FOUND
      );
    }

    const deviceIds = Array.from(this.groups.get(groupName)!);
    this.logger.trace(`Retrieved device IDs from group`, {
      groupName,
      deviceCount: deviceIds.length
    });
    return deviceIds;
  }

  /**
   * Retrieves all existing group names
   *
   * @returns Array of group names
   */  public getAllGroups(): string[] {
    const groups = Array.from(this.groups.keys());
    this.logger.trace(`Retrieved all groups`, { groupCount: groups.length });
    return groups;
  }

  /**
   * Retrieves all devices in the registry
   *
   * @returns Array of all devices
   */  public getAllDevices(): Device[] {
    const devices = Array.from(this.devices.values());
    this.logger.trace(`Retrieved all devices`, { deviceCount: devices.length });
    return devices;
  }

  /**
   * Retrieves all device IDs in the registry
   *
   * @returns Array of all device IDs
   */
  public getAllDeviceIds(): string[] {
    return Array.from(this.devices.keys());
  }
}
