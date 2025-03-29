<!-- Badges -->
![Test Coverage](https://img.shields.io/badge/coverage-85.15%25-brightgreen)
![npm version](https://img.shields.io/npm/v/energy-manager-iot)
![NPM Downloads](https://img.shields.io/npm/dw/energy-manager-iot)

# Energy Manager IoT

A Node.js library for efficient energy management in IoT devices through MQTT protocol.

**[📚 Full Documentation](https://energy-manager-iot.vercel.app/en)**

## Features

- Robust MQTT connectivity with automatic reconnection support
- Device management with unique IDs and flexible grouping
- Send commands to individual devices or groups (e.g., "sleep", "wake")
- Receive and store device status (e.g., battery level, power mode)
- Group analytics, such as average battery level and power mode distribution
- Full TypeScript support with strong typing
- Robust error handling and detailed logging

## Installation

```bash
npm install energy-manager-iot
```

## Usage Guide

### Initial Setup
1. Import the library:
   ```typescript
   import { EnergyManager, DeviceType, CommandType } from 'energy-manager-iot';
   ```
2. Create a manager instance:
   ```typescript
   const manager = new EnergyManager({
     topicPrefix: 'home/devices/', // Prefix for MQTT topics
     mqttOptions: { clientId: 'my-application' },
     statusInterval: 60000 // Status check every 60 seconds
   });
   ```
3. Connect to the MQTT broker:
   ```typescript
   await manager.connect('mqtt://localhost:1883', { username: 'user', password: 'password' });
   ```

### Device Registration and Management
- Register devices:
   ```typescript
   manager.registerDevice('sensor1', 'Temperature Sensor', DeviceType.SENSOR, {
     reportingInterval: 60, // In seconds
     sleepThreshold: 20     // Enter sleep mode when battery below 20%
   });
   ```
- Create groups and add devices:
   ```typescript
   manager.createGroup('living-room');
   manager.addDeviceToGroup('sensor1', 'living-room');
   ```
- Send commands to a device or group:
   ```typescript
   await manager.sendCommand('sensor1', CommandType.SET_REPORTING, { interval: 300 });
   await manager.sleepGroup('living-room', 3600); // Hibernate the group for 1 hour
   ```

### Monitoring and Events
The library emits useful events for monitoring:
   ```typescript
   // Listen to events:
   manager.on('connected', () => console.log('Connected to MQTT broker'));
   manager.on('statusUpdate', (deviceId, status) => console.log(`Status for ${deviceId}:`, status));
   manager.on('deviceOffline', (deviceId) => console.log(`Device ${deviceId} went offline`));
   manager.on('commandSent', (deviceId, command) => console.log(`Command sent to ${deviceId}:`, command));
   ```
- To finalize, disconnect:
   ```typescript
   await manager.disconnect();
   ```

## Examples

Check the `/examples` folder for detailed usage examples:
- `basic-usage.ts`: Basic usage example.
- `group-management.ts`: Advanced group management.
- `device-simulator.ts`: IoT device simulator.
- `advanced-usage.ts`: Advanced example with monitoring and group commands.

**Additional Examples**
- Run `npm run example:simulator` to simulate devices and see EnergyManager in action.

## API

### Main Class

#### `EnergyManager`

The main entry point of the library.

```typescript
// Create instance
const manager = new EnergyManager(options);

// Available options:
interface EnergyManagerOptions {
  topicPrefix?: string;        // MQTT topic prefix (default: 'device/')
  mqttOptions?: MqttHandlerOptions; // MQTT client options
  autoReconnect?: boolean;     // Auto reconnection (default: true)
  statusInterval?: number;     // Status check interval (ms) (default: 60000)
}
```

### Main Methods

| Method | Description |
|--------|-------------|
| `connect(brokerUrl, options?)` | Connect to the MQTT broker |
| `disconnect()` | Disconnect from the MQTT broker |
| `registerDevice(id, name, type, config?, groups?)` | Register a new device |
| `sendCommand(deviceId, command, payload?)` | Send command to a device |
| `sendCommandToGroup(groupName, command, payload?)` | Send command to a group |
| `getDevice(id)` | Get information about a device |
| `createGroup(name)` | Create a device group |
| `addDeviceToGroup(deviceId, groupName)` | Add a device to a group |
| `getGroupStatistics(groupName)` | Get group statistics |

### Convenience Methods

| Method | Description |
|--------|-------------|
| `sleepDevice(deviceId, duration?)` | Put device in energy saving mode |
| `wakeDevice(deviceId)` | Wake device from energy saving mode |
| `sleepGroup(groupName, duration?)` | Put group in energy saving mode |
| `wakeGroup(groupName)` | Wake group from energy saving mode |

### Events

The `EnergyManager` class extends `EventEmitter`, allowing you to receive notifications:

```typescript
// Listen to events
manager.on('connected', () => console.log('Connected'));
manager.on('disconnected', () => console.log('Disconnected'));
manager.on('statusUpdate', (deviceId, status) => console.log(`Status: ${deviceId}`, status));
manager.on('deviceOffline', (deviceId) => console.log(`Device offline: ${deviceId}`));
manager.on('commandSent', (deviceId, command) => console.log(`Command sent: ${deviceId}`, command));
```

## Protocols and Standards

### Status Format

Devices should publish their status in JSON format:

```json
{
  "batteryLevel": 75,
  "powerMode": "normal",
  "connectionStatus": "online",
  "firmwareVersion": "1.2.3",
  "signalStrength": -67
}
```

### Command Format

Commands are sent in the format:

```json
{
  "type": "sleep",
  "payload": { "duration": 3600 },
  "timestamp": 1634567890123,
  "requestId": "req_1634567890123_abc123"
}
```

## Security Considerations

- Use TLS/SSL (mqtts://) in production environments.
- Configure authentication and access control in the MQTT broker.
- Validate command payloads to prevent malicious information.

## Developer

[Jonh Alex Paz de Lima](https://www.linkedin.com/in/jonhvmp)
