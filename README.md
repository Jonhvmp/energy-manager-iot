# Energy Manager IoT

Uma biblioteca Node.js para gerenciamento eficiente de energia em dispositivos IoT através do protocolo MQTT.

## Características

- Conectividade MQTT robusta com suporte a reconexão automática
- Gerenciamento de dispositivos com IDs únicos e agrupamento flexível
- Envio de comandos para dispositivos individuais ou grupos (ex.: "dormir", "acordar")
- Recebimento e armazenamento de status dos dispositivos (ex.: nível de bateria, modo de energia)
- Análises de grupo, como média de nível de bateria e distribuição de modos de energia
- Suporte completo a TypeScript com tipagem forte
- Tratamento de erros robusto e logging detalhado

## Instalação

```bash
npm install energy-manager-iot
```

## Guia de Utilização

### Configuração Inicial
1. Importe a biblioteca:
   ```typescript
   import { EnergyManager, DeviceType, CommandType } from 'energy-manager-iot';
   ```
2. Crie uma instância do gerenciador:
   ```typescript
   const manager = new EnergyManager({
     topicPrefix: 'home/devices/', // Prefixo para os tópicos MQTT
     mqttOptions: { clientId: 'minha-aplicacao' },
     statusInterval: 60000 // Verificação de status a cada 60 segundos
   });
   ```
3. Conecte-se ao broker MQTT:
   ```typescript
   await manager.connect('mqtt://localhost:1883', { username: 'user', password: 'senha' });
   ```

### Registro e Gerenciamento de Dispositivos
- Registrar dispositivos:
   ```typescript
   manager.registerDevice('sensor1', 'Sensor de Temperatura', DeviceType.SENSOR, {
     reportingInterval: 60, // Em segundos
     sleepThreshold: 20      // Bateria abaixo de 20% entra em sleep
   });
   ```
- Criar grupos e adicionar dispositivos:
   ```typescript
   manager.createGroup('living-room');
   manager.addDeviceToGroup('sensor1', 'living-room');
   ```
- Enviar comandos para um dispositivo ou grupo:
   ```typescript
   await manager.sendCommand('sensor1', CommandType.SET_REPORTING, { interval: 300 });
   await manager.sleepGroup('living-room', 3600); // Hibernar grupo por 1 hora
   ```

### Monitoramento e Eventos
A biblioteca emite eventos úteis para monitoramento:
   ```typescript
   // Ouvir eventos:
   manager.on('connected', () => console.log('Conectado ao broker MQTT'));
   manager.on('statusUpdate', (deviceId, status) => console.log(`Status do ${deviceId}:`, status));
   manager.on('deviceOffline', (deviceId) => console.log(`Dispositivo ${deviceId} ficou offline`));
   manager.on('commandSent', (deviceId, command) => console.log(`Comando enviado para ${deviceId}:`, command));
   ```
- Para finalizar, desconecte:
   ```typescript
   await manager.disconnect();
   ```

## Exemplos

Confira a pasta `/examples` para ver exemplos de uso detalhados:
- `basic-usage.ts`: Exemplo básico de utilização.
- `group-management.ts`: Gerenciamento avançado de grupos.
- `device-simulator.ts`: Simulador de dispositivos IoT.
- `advanced-usage.ts`: Exemplo avançado com monitoramento e comandos em grupo.

## API

### Classe Principal

#### `EnergyManager`

O ponto de entrada principal da biblioteca.

```typescript
// Criar instância
const manager = new EnergyManager(options);

// Opções disponíveis:
interface EnergyManagerOptions {
  topicPrefix?: string;        // Prefixo para tópicos MQTT (padrão: 'device/')
  mqttOptions?: MqttHandlerOptions; // Opções para o cliente MQTT
  autoReconnect?: boolean;     // Reconexão automática (padrão: true)
  statusInterval?: number;     // Intervalo de verificação (ms) (padrão: 60000)
}
```

### Métodos Principais

| Método | Descrição |
|--------|-----------|
| `connect(brokerUrl, options?)` | Conecta ao broker MQTT |
| `disconnect()` | Desconecta do broker MQTT |
| `registerDevice(id, name, type, config?, groups?)` | Registra um novo dispositivo |
| `sendCommand(deviceId, command, payload?)` | Envia comando para um dispositivo |
| `sendCommandToGroup(groupName, command, payload?)` | Envia comando para um grupo |
| `getDevice(id)` | Obtém informações de um dispositivo |
| `createGroup(name)` | Cria um grupo de dispositivos |
| `addDeviceToGroup(deviceId, groupName)` | Adiciona dispositivo a um grupo |
| `getGroupStatistics(groupName)` | Obtém estatísticas de um grupo |

### Métodos de Conveniência

| Método | Descrição |
|--------|-----------|
| `sleepDevice(deviceId, duration?)` | Coloca dispositivo em modo de economia |
| `wakeDevice(deviceId)` | Acorda dispositivo do modo de economia |
| `sleepGroup(groupName, duration?)` | Coloca grupo em modo de economia |
| `wakeGroup(groupName)` | Acorda grupo do modo de economia |

### Eventos

A classe `EnergyManager` estende `EventEmitter`, permitindo receber notificações:

```typescript
// Ouvir eventos
manager.on('connected', () => console.log('Conectado'));
manager.on('disconnected', () => console.log('Desconectado'));
manager.on('statusUpdate', (deviceId, status) => console.log(`Status: ${deviceId}`, status));
manager.on('deviceOffline', (deviceId) => console.log(`Dispositivo offline: ${deviceId}`));
manager.on('commandSent', (deviceId, command) => console.log(`Comando enviado: ${deviceId}`, command));
```

## Protocolos e Padrões

### Formato de Status

Os dispositivos devem publicar seu status no formato JSON:

```json
{
  "batteryLevel": 75,
  "powerMode": "normal",
  "connectionStatus": "online",
  "firmwareVersion": "1.2.3",
  "signalStrength": -67
}
```

### Formato de Comando

Os comandos são enviados no formato:

```json
{
  "type": "sleep",
  "payload": { "duration": 3600 },
  "timestamp": 1634567890123,
  "requestId": "req_1634567890123_abc123"
}
```

## Considerações de Segurança

- Utilize TLS/SSL (mqtts://) em ambientes de produção.
- Configure autenticação e controle de acesso no broker MQTT.
- Valide os payloads dos comandos para prevenir informações maliciosas.

## Desenvolvedor

[Jonh Alex Paz de Lima](https://www.linkedin.com/in/jonhvmp)
