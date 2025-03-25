/**
 * IoT Device Simulator for testing
 *
 * This example simulates IoT devices that communicate
 * with the Energy Manager using the MQTT protocol.
 * It can be used to test the library without real hardware.
 */
import * as mqtt from 'mqtt';
import { DeviceStatus, PowerMode, ConnectionStatus } from '../src/types/status';
import { DeviceCommand, CommandType, CommandResponse } from '../src/types/command';

interface DeviceConfig {
  id: string;
  name: string;
  batteryLevel: number;
  batteryDrainRate: number;
  reportingInterval: number;
  broker: string;
  topicPrefix: string;
  username?: string;
  password?: string;
}

class IoTDeviceSimulator {
  private client: mqtt.MqttClient | null = null;
  private config: DeviceConfig;
  private powerMode: PowerMode = PowerMode.NORMAL;
  private status: DeviceStatus;
  private reportTimer?: NodeJS.Timeout;
  private batteryTimer?: NodeJS.Timeout;

  constructor(config: DeviceConfig) {
    this.config = {
      ...{
        batteryDrainRate: 0.1,
        reportingInterval: 10000,
        topicPrefix: 'device/'
      },
      ...config
    };

    this.status = {
      deviceId: this.config.id,
      batteryLevel: this.config.batteryLevel,
      powerMode: PowerMode.NORMAL,
      connectionStatus: ConnectionStatus.OFFLINE,
      lastSeen: Date.now(),
      firmwareVersion: '1.0.0',
      signalStrength: -70,
      errors: []
    };
  }

  /**
   * Connect the simulated device to the MQTT broker
   */
  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log(`Device ${this.config.name} (${this.config.id}) connecting...`);
        this.client = mqtt.connect(this.config.broker, {
          clientId: `device-${this.config.id}-${Math.random().toString(16).substring(2, 8)}`,
          username: this.config.username,
          password: this.config.password,
          clean: true,
          reconnectPeriod: 5000
        });

        this.client.on('connect', () => {
          console.log(`Device ${this.config.id} connected to broker ${this.config.broker}`);
          this.status.connectionStatus = ConnectionStatus.ONLINE;

          // Subscribe to command topic
          const commandTopic = `${this.config.topicPrefix}${this.config.id}/command`;
          this.client?.subscribe(commandTopic, { qos: 1 }, (err) => {
            if (err) {
              console.error(`Error subscribing to command topic:`, err);
            } else {
              console.log(`Subscribed to command topic: ${commandTopic}`);
            }
          });

          // Start simulation
          this.startSimulation();
          resolve();
        });

        this.client.on('message', (topic, message) => {
          this.handleCommand(topic, message);
        });

        this.client.on('error', (err) => {
          console.error(`Connection error: ${err.message}`);
          reject(err);
        });

      } catch (err) {
        console.error('Error connecting:', err);
        reject(err);
      }
    });
  }

  /**
   * Disconnect the simulated device from the MQTT broker
   */
  public disconnect(): Promise<void> {
    return new Promise((resolve) => {
      this.stopSimulation();

      if (this.client) {
        this.client.end(false, {}, () => {
          console.log(`Device ${this.config.id} disconnected`);
          this.status.connectionStatus = ConnectionStatus.OFFLINE;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Start periodic status reporting and battery simulation
   * @private
   */
  private startSimulation(): void {
    // Start periodic status reporting
    this.reportTimer = setInterval(() => {
      this.reportStatus();
    }, this.config.reportingInterval);

    // Start battery drain simulation
    this.batteryTimer = setInterval(() => {
      this.drainBattery();
    }, 5000);

    // Send initial status
    this.reportStatus();
  }

  /**
   * Stop all simulation timers
   * @private
   */
  private stopSimulation(): void {
    if (this.reportTimer) {
      clearInterval(this.reportTimer);
    }
    if (this.batteryTimer) {
      clearInterval(this.batteryTimer);
    }
  }

  /**
   * Report device status to the MQTT broker
   * @private
   */
  private reportStatus(): void {
    if (!this.client || this.status.connectionStatus !== ConnectionStatus.ONLINE) {
      return;
    }

    const statusTopic = `${this.config.topicPrefix}${this.config.id}/status`;

    // Update timestamp and format batteryLevel with two decimal places
    this.status.lastSeen = Date.now();
    const formattedStatus = {
      ...this.status,
      batteryLevel: Number(this.status.batteryLevel.toFixed(2))
    };

    this.client.publish(statusTopic, JSON.stringify(formattedStatus), { qos: 1 }, (err) => {
      if (err) {
        console.error(`Error publishing status:`, err);
      } else {
        console.log(`Status published to ${statusTopic}: ${JSON.stringify(formattedStatus)}`);
      }
    });
  }

  /**
   * Simulate battery drain based on power mode
   * @private
   */
  private drainBattery(): void {
    // Different battery drain rates based on power mode
    let drainMultiplier = 1.0;

    switch (this.powerMode) {
      case PowerMode.LOW_POWER:
        drainMultiplier = 0.5;
        break;
      case PowerMode.SLEEP:
        drainMultiplier = 0.1;
        break;
      case PowerMode.NORMAL:
      default:
        drainMultiplier = 1.0;
    }

    // Reduce battery level
    this.status.batteryLevel = Math.max(
      0,
      this.status.batteryLevel - (this.config.batteryDrainRate * drainMultiplier)
    );

    // If battery is critically low, change to critical power mode
    if (this.status.batteryLevel < 10 && this.powerMode !== PowerMode.CRITICAL) {
      this.powerMode = PowerMode.CRITICAL;
      this.status.powerMode = PowerMode.CRITICAL;
      console.log(`${this.config.id}: Critical battery! Level: ${this.status.batteryLevel.toFixed(1)}%`);
      this.reportStatus();
    }
  }

  /**
   * Handle incoming commands from the MQTT broker
   * @param _topic The MQTT topic the command was received on
   * @param message The command message
   * @private
   */
  private handleCommand(_topic: string, message: Buffer): void {
    try {
      const command = JSON.parse(message.toString()) as DeviceCommand;
      console.log(`${this.config.id}: Command received:`, command);

      // Process command
      switch (command.type) {
        case CommandType.SLEEP:
          this.powerMode = PowerMode.SLEEP;
          this.status.powerMode = PowerMode.SLEEP;
          console.log(`${this.config.id}: Entering sleep mode`);

          // If duration provided, schedule wake up
          if (command.payload && command.payload.duration) {
            const duration = command.payload.duration * 1000; // convert to ms
            setTimeout(() => {
              this.powerMode = PowerMode.NORMAL;
              this.status.powerMode = PowerMode.NORMAL;
              console.log(`${this.config.id}: Exiting sleep mode`);
              this.reportStatus();
            }, duration);
          }
          break;

        case CommandType.WAKE:
          this.powerMode = PowerMode.NORMAL;
          this.status.powerMode = PowerMode.NORMAL;
          console.log(`${this.config.id}: Waking to normal mode`);
          break;

        case CommandType.SET_REPORTING:
          if (command.payload && command.payload.interval) {
            const newInterval = command.payload.interval * 1000; // convert to ms
            this.config.reportingInterval = newInterval;

            // Restart timer with new interval
            if (this.reportTimer) {
              clearInterval(this.reportTimer);
            }
            this.reportTimer = setInterval(() => {
              this.reportStatus();
            }, this.config.reportingInterval);

            console.log(`${this.config.id}: Reporting interval changed to ${command.payload.interval}s`);
          }
          break;

        case CommandType.GET_STATUS:
          // Reply immediately with current status
          this.reportStatus();
          break;

        default:
          console.log(`${this.config.id}: Unrecognized command: ${command.type}`);
      }

      // Send command response if requestId is present
      if (command.requestId) {
        this.sendCommandResponse(command, true);
      }

      // Update status after any command
      this.reportStatus();

    } catch (err) {
      console.error(`${this.config.id}: Error processing command:`, err);
    }
  }

  /**
   * Send response to a command
   * @param command The original command
   * @param success Whether the command was successful
   * @private
   */
  private sendCommandResponse(command: DeviceCommand, success: boolean): void {
    if (!this.client) return;

    const responseTopic = `${this.config.topicPrefix}${this.config.id}/response`;

    const response: CommandResponse = {
      success,
      requestId: command.requestId,
      message: success ? 'Command executed successfully' : 'Failed to execute command',
      timestamp: Date.now()
    };

    this.client.publish(responseTopic, JSON.stringify(response), { qos: 1 }, (err) => {
      if (err) {
        console.error(`${this.config.id}: Error sending command response:`, err);
      }
    });
  }
}

/**
 * Run the device simulator with multiple devices
 */
async function runSimulator() {
  // Create simulated devices
  const devices = [
    new IoTDeviceSimulator({
      id: 'temp-sensor-01',
      name: 'Living Room Temperature Sensor',
      batteryLevel: 90,
      batteryDrainRate: 0.05,
      reportingInterval: 5000,
      broker: 'mqtt://localhost:1883',
      topicPrefix: 'home/devices/'
    }),
    new IoTDeviceSimulator({
      id: 'motion-sensor-01',
      name: 'Entrance Motion Sensor',
      batteryLevel: 75,
      batteryDrainRate: 0.1,
      reportingInterval: 8000,
      broker: 'mqtt://localhost:1883',
      topicPrefix: 'home/devices/'
    }),
    new IoTDeviceSimulator({
      id: 'camera-01',
      name: 'External Camera',
      batteryLevel: 60,
      batteryDrainRate: 0.3,
      reportingInterval: 10000,
      broker: 'mqtt://localhost:1883',
      topicPrefix: 'home/devices/'
    })
  ];

  // Connect all devices
  for (const device of devices) {
    try {
      await device.connect();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay between connections
    } catch (err) {
      console.error('Failed to connect device:', err);
    }
  }

  // Keep devices running until process is terminated
  console.log('Device simulator running. Press Ctrl+C to exit.');

  // Handle termination
  process.on('SIGINT', async () => {
    console.log('\nDisconnecting devices...');
    for (const device of devices) {
      await device.disconnect();
    }
    process.exit(0);
  });
}

// Start simulation
runSimulator();
