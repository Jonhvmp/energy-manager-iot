import { EnergyManager, DeviceType, CommandType } from '../src';

async function advancedExample() {
  console.log('Iniciando exemplo avançado de Energy Manager IoT');

  // Criar instância com reconexão automática e verificação de status a cada 30 segundos
  const manager = new EnergyManager({
    topicPrefix: 'advanced/devices/',
    mqttOptions: { clientId: 'advanced-manager' },
    statusInterval: 30000
  });

  // Configurar ouvintes para eventos relevantes
  manager.on('connected', () => console.log('Conectado ao broker MQTT'));
  manager.on('disconnected', () => console.log('Desconectado do broker MQTT'));
  manager.on('statusUpdate', (deviceId, status) =>
    console.log(`Status atualizado para ${deviceId}:`, status)
  );
  manager.on('deviceOffline', (deviceId) =>
    console.log(`Dispositivo ${deviceId} marcado como offline`)
  );
  manager.on('commandSent', (deviceId, command) =>
    console.log(`Comando enviado para ${deviceId}:`, command)
  );

  try {
    // Conectar ao broker local
    await manager.connect('mqtt://localhost:1883');

    // Registrar dispositivos avançados
    manager.registerDevice('sensor-advanced-01', 'Sensor Avançado 01', DeviceType.SENSOR, {
      reportingInterval: 30,
      sleepThreshold: 20
    });
    manager.registerDevice('camera-advanced-01', 'Câmera Avançada 01', DeviceType.CAMERA, {
      reportingInterval: 60
    });

    // Criar grupos e associar dispositivos
    manager.createGroup('advanced-group');
    manager.addDeviceToGroup('sensor-advanced-01', 'advanced-group');
    manager.addDeviceToGroup('camera-advanced-01', 'advanced-group');

    // Enviar comando para atualizar intervalo de relatório de um dispositivo
    await manager.sendCommand('camera-advanced-01', CommandType.SET_REPORTING, { interval: 45 });

    // Enviar comando para colocar todos os dispositivos do grupo em modo sleep
    await manager.sleepGroup('advanced-group', 3600);

    // Manter a aplicação rodando por 1 minuto para observar atualizações
    await new Promise(resolve => setTimeout(resolve, 60000));

    // Desconectar ao final
    await manager.disconnect();
    console.log('Exemplo avançado finalizado');
  } catch (error) {
    console.error('Erro no exemplo avançado:', error);
  }
}

// Executar o exemplo
advancedExample();
