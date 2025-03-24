/**
 * Exemplo básico de uso da biblioteca Energy Manager IoT
 */
import { EnergyManager, DeviceType, CommandType, PowerMode } from '../src';

async function basicExample() {
  console.log('Iniciando exemplo básico de Energy Manager IoT');

  // Criar instância do gerenciador
  const energyManager = new EnergyManager({
    topicPrefix: 'home/devices/',
    mqttOptions: {
      clientId: 'energy-manager-example',
      clean: true
    }
  });

  // Configurar listeners de eventos
  energyManager.on('connected', () => {
    console.log('Conectado ao broker MQTT');
  });

  energyManager.on('statusUpdate', (deviceId, status) => {
    console.log(`Status atualizado para ${deviceId}:`, status);
  });

  // Conectar ao broker MQTT (ex. Mosquitto local)
  try {
    await energyManager.connect('mqtt://localhost:1883');

    // Registrar alguns dispositivos
    energyManager.registerDevice('temp-sensor-01', 'Sensor de Temperatura Sala', DeviceType.SENSOR, {
      reportingInterval: 60, // a cada 60 segundos
      sleepThreshold: 15     // dormir quando bateria < 15%
    });

    energyManager.registerDevice('motion-sensor-01', 'Sensor de Movimento Entrada', DeviceType.SENSOR);
    energyManager.registerDevice('camera-01', 'Câmera Externa', DeviceType.CAMERA);

    // Criar um grupo
    energyManager.createGroup('living-room');

    // Adicionar dispositivos ao grupo
    energyManager.addDeviceToGroup('temp-sensor-01', 'living-room');
    energyManager.addDeviceToGroup('motion-sensor-01', 'living-room');

    // Enviar comando para um dispositivo
    await energyManager.sendCommand('camera-01', CommandType.SET_REPORTING, { interval: 300 });

    // Colocar todos os dispositivos da sala em modo de economia
    await energyManager.sleepGroup('living-room', 3600); // hibernar por 1 hora

    // Acordar um dispositivo específico
    await energyManager.wakeDevice('temp-sensor-01');

    // Obter estatísticas do grupo
    const stats = energyManager.getGroupStatistics('living-room');
    console.log('Estatísticas do grupo living-room:', stats);

    // Manter a aplicação rodando por um tempo
    await new Promise(resolve => setTimeout(resolve, 60000));

    // Desconectar ao finalizar
    await energyManager.disconnect();
    console.log('Exemplo finalizado');

  } catch (error) {
    console.error('Erro no exemplo:', error);
  }
}

// Executar o exemplo
basicExample();
