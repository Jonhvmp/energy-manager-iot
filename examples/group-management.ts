/**
 * Exemplo de gerenciamento de grupos de dispositivos
 */
import { EnergyManager, DeviceType, CommandType } from '../src';

async function groupManagementExample() {
  console.log('Iniciando exemplo de gerenciamento de grupos');

  // Criar instância do gerenciador
  const energyManager = new EnergyManager();

  try {
    // Conectar ao broker
    await energyManager.connect('mqtt://localhost:1883', {
      username: 'user',
      password: 'password',
      reconnectPeriod: 3000
    });

    // Criar grupos para diferentes ambientes
    energyManager.createGroup('kitchen');
    energyManager.createGroup('bedroom');
    energyManager.createGroup('outdoor');

    console.log('Grupos criados:', energyManager.getAllGroups());

    // Registrar dispositivos
    console.log('Registrando dispositivos...');

    // Dispositivos da cozinha
    energyManager.registerDevice('temp-kitchen', 'Sensor Temp Cozinha', DeviceType.SENSOR, {}, ['kitchen']);
    energyManager.registerDevice('light-kitchen', 'Luz Cozinha', DeviceType.ACTUATOR, {}, ['kitchen']);

    // Dispositivos do quarto
    energyManager.registerDevice('temp-bedroom', 'Sensor Temp Quarto', DeviceType.SENSOR, {}, ['bedroom']);
    energyManager.registerDevice('humidity-bedroom', 'Sensor Umidade Quarto', DeviceType.SENSOR, {}, ['bedroom']);

    // Dispositivos externos
    energyManager.registerDevice('camera-front', 'Câmera Frontal', DeviceType.CAMERA, {}, ['outdoor']);
    energyManager.registerDevice('camera-back', 'Câmera Traseira', DeviceType.CAMERA, {}, ['outdoor']);

    // Criar um grupo para todos os sensores
    energyManager.createGroup('all-sensors');

    // Adicionar todos os sensores ao grupo de sensores
    energyManager.addDeviceToGroup('temp-kitchen', 'all-sensors');
    energyManager.addDeviceToGroup('temp-bedroom', 'all-sensors');
    energyManager.addDeviceToGroup('humidity-bedroom', 'all-sensors');

    // Verificar dispositivos em cada grupo
    console.log('\nDispositivos por grupo:');
    for (const group of energyManager.getAllGroups()) {
      const devices = energyManager.getDevicesInGroup(group);
      console.log(`Grupo "${group}": ${devices.length} dispositivos`);
      devices.forEach(device => {
        console.log(`  - ${device.name} (${device.id})`);
      });
    }

    // Enviar comandos para grupos específicos
    console.log('\nEnviando comandos para grupos...');

    // Reduzir intervalo de relatórios para câmeras externas
    await energyManager.sendCommandToGroup('outdoor', CommandType.SET_REPORTING, { interval: 30 });
    console.log('Comando SET_REPORTING enviado para grupo "outdoor"');

    // Colocar todos os sensores em modo de economia durante a noite
    await energyManager.sleepGroup('all-sensors', 28800); // 8 horas
    console.log('Comando SLEEP enviado para grupo "all-sensors"');

    // Remover um dispositivo de um grupo
    energyManager.removeDeviceFromGroup('temp-kitchen', 'all-sensors');
    console.log('\nDispositivo temp-kitchen removido do grupo all-sensors');

    // Verificar grupos de um dispositivo específico
    const cameraFront = energyManager.getDevice('camera-front');
    console.log(`\nGrupos do dispositivo ${cameraFront.name}:`, cameraFront.groups);

    // Remover um grupo
    energyManager.removeGroup('bedroom');
    console.log('\nGrupo "bedroom" removido');
    console.log('Grupos restantes:', energyManager.getAllGroups());

    // Desconectar
    await energyManager.disconnect();
    console.log('\nExemplo finalizado');

  } catch (error) {
    console.error('Erro no exemplo:', error);
  }
}

// Executar o exemplo
groupManagementExample();
