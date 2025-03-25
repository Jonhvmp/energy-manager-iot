# Getting Started

This guide explains how to set up Mosquitto and run the examples from the Energy Manager IoT library.

## 1. Installing Mosquitto

### Windows
- Download the Mosquitto installer from [https://mosquitto.org/download/](https://mosquitto.org/download/).
- Follow the installer instructions and, if necessary, add Mosquitto to the system PATH.
- To start the broker, open the command prompt and run:
  ```bash
  mosquitto -v
  ```

### Linux (Debian/Ubuntu)
- Install with the commands:
  ```bash
  sudo apt update
  sudo apt install mosquitto mosquitto-clients
  ```
- Start the broker:
  ```bash
  sudo systemctl start mosquitto
  ```
- To check the status:
  ```bash
  sudo systemctl status mosquitto
  ```

### macOS
- Install via Homebrew:
  ```bash
  brew install mosquitto
  ```
- Start the broker:
  ```bash
  brew services start mosquitto
  ```

## 2. Configuring Mosquitto

The default configuration files generally work well for testing. If you need customizations, edit the configuration file (e.g., /etc/mosquitto/mosquitto.conf on Linux).

## 3. Running the Examples

After configuring Mosquitto, you can test the library:

1. Build the project (if you haven't already):
   ```bash
   npm run build
   ```

2. Run an example, for instance:
   ```bash
   npm run example:basic
   ```
   Or for group management:
   ```bash
   npm run example:group
   ```

3. Check the logs and status messages in the console to confirm communication with the MQTT broker.

## 4. Continue Exploring

For more details, see the [README.md](./README.md) file and the library documentation.
