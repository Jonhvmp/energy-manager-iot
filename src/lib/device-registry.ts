import { Device, DeviceConfig, DeviceType } from '../types/device';
import { DeviceStatus, PowerMode, ConnectionStatus } from '../types/status';
import { validateDeviceId, validateGroupName, validateDeviceConfig } from '../utils/validators';
import { EnergyManagerError, ErrorType } from '../utils/error-handler';
import Logger from '../utils/logger';

/**
 * Gerencia registro e agrupamento de dispositivos IoT
 */
export class DeviceRegistry {
  private devices: Map<string, Device>;
  private groups: Map<string, Set<string>>;

  constructor() {
    this.devices = new Map<string, Device>();
    this.groups = new Map<string, Set<string>>();
  }

  /**
   * Registra um novo dispositivo
   */
  public registerDevice(
    id: string,
    name: string,
    type: DeviceType,
    config: DeviceConfig = {},
    groups: string[] = []
  ): Device {
    // Validar ID
    if (!validateDeviceId(id)) {
      throw new EnergyManagerError(
        `ID de dispositivo inválido: ${id}`,
        ErrorType.VALIDATION
      );
    }

    // Verificar se o dispositivo já existe
    if (this.devices.has(id)) {
      throw new EnergyManagerError(
        `Dispositivo com ID ${id} já existe`,
        ErrorType.VALIDATION
      );
    }

    // Validar configuração
    if (!validateDeviceConfig(config)) {
      throw new EnergyManagerError(
        `Configuração inválida para dispositivo ${id}`,
        ErrorType.VALIDATION
      );
    }

    // Criar dispositivo
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

    // Adicionar aos grupos especificados
    if (groups.length > 0) {
      for (const groupName of groups) {
        this.addDeviceToGroup(id, groupName, device);
      }
    }

    // Armazenar dispositivo
    this.devices.set(id, device);
    Logger.info(`Dispositivo registrado: ${id} (${name})`);

    return device;
  }

  /**
   * Atualiza um dispositivo existente
   */
  public updateDevice(id: string, updates: Partial<Omit<Device, 'id' | 'createdAt'>>): Device {
    const device = this.getDevice(id);

    // Atualizar propriedades
    if (updates.name) {
      device.name = updates.name;
    }

    if (updates.type) {
      device.type = updates.type;
    }

    if (updates.config) {
      // Validar nova configuração
      if (!validateDeviceConfig(updates.config)) {
        throw new EnergyManagerError(
          `Configuração inválida para dispositivo ${id}`,
          ErrorType.VALIDATION
        );
      }
      device.config = { ...device.config, ...updates.config };
    }

    // Atualizar timestamp
    device.updatedAt = Date.now();

    // Atualizar no mapa
    this.devices.set(id, device);
    Logger.info(`Dispositivo atualizado: ${id}`);

    return device;
  }

  /**
   * Atualiza o status de um dispositivo
   */
  public updateDeviceStatus(id: string, status: DeviceStatus): Device {
    const device = this.getDevice(id);

    // Atualizar status e timestamp
    device.status = status;
    device.updatedAt = Date.now();

    // Atualizar no mapa
    this.devices.set(id, device);
    Logger.debug(`Status atualizado para dispositivo ${id}`);

    return device;
  }

  /**
   * Remove um dispositivo
   */
  public removeDevice(id: string): boolean {
    if (!this.devices.has(id)) {
      return false;
    }

    // Obter grupos do dispositivo
    const device = this.devices.get(id)!;

    // Remover de todos os grupos
    for (const groupName of device.groups) {
      const group = this.groups.get(groupName);
      if (group) {
        group.delete(id);
      }
    }

    // Remover do registro
    this.devices.delete(id);
    Logger.info(`Dispositivo removido: ${id}`);

    return true;
  }

  /**
   * Obtém um dispositivo por ID
   */
  public getDevice(id: string): Device {
    const device = this.devices.get(id);
    if (!device) {
      throw new EnergyManagerError(
        `Dispositivo não encontrado: ${id}`,
        ErrorType.DEVICE_NOT_FOUND
      );
    }
    return device;
  }

  /**
   * Verifica se um dispositivo existe
   */
  public hasDevice(id: string): boolean {
    return this.devices.has(id);
  }

  /**
   * Cria um novo grupo
   */
  public createGroup(name: string): boolean {
    // Validar nome do grupo
    if (!validateGroupName(name)) {
      throw new EnergyManagerError(
        `Nome de grupo inválido: ${name}`,
        ErrorType.VALIDATION
      );
    }

    // Verificar se o grupo já existe
    if (this.groups.has(name)) {
      return false;
    }

    // Criar grupo vazio
    this.groups.set(name, new Set<string>());
    Logger.info(`Grupo criado: ${name}`);

    return true;
  }

  /**
   * Adiciona um dispositivo a um grupo
   */
  public addDeviceToGroup(deviceId: string, groupName: string, device?: Device): boolean {
    // Validar nome do grupo
    if (!validateGroupName(groupName)) {
      throw new EnergyManagerError(
        `Nome de grupo inválido: ${groupName}`,
        ErrorType.VALIDATION
      );
    }

    // Obter ou criar o grupo
    if (!this.groups.has(groupName)) {
      this.createGroup(groupName);
    }

    // Referência ao dispositivo
    const deviceRef = device || this.getDevice(deviceId);

    // Adicionar ao grupo
    const group = this.groups.get(groupName)!;
    group.add(deviceId);

    // Adicionar grupo ao dispositivo se ainda não estiver lá
    if (!deviceRef.groups.includes(groupName)) {
      deviceRef.groups.push(groupName);
      deviceRef.updatedAt = Date.now();
      this.devices.set(deviceId, deviceRef);
    }

    Logger.debug(`Dispositivo ${deviceId} adicionado ao grupo ${groupName}`);
    return true;
  }

  /**
   * Remove um dispositivo de um grupo
   */
  public removeDeviceFromGroup(deviceId: string, groupName: string): boolean {
    // Verificar se o grupo existe
    if (!this.groups.has(groupName)) {
      throw new EnergyManagerError(
        `Grupo não encontrado: ${groupName}`,
        ErrorType.GROUP_NOT_FOUND
      );
    }

    // Remover do grupo
    const group = this.groups.get(groupName)!;
    const removed = group.delete(deviceId);

    if (removed) {
      // Remover grupo da lista de grupos do dispositivo
      const device = this.devices.get(deviceId);
      if (device) {
        device.groups = device.groups.filter(g => g !== groupName);
        device.updatedAt = Date.now();
        this.devices.set(deviceId, device);
        Logger.debug(`Dispositivo ${deviceId} removido do grupo ${groupName}`);
      }
    }

    return removed;
  }

  /**
   * Remove um grupo e desassocia todos os dispositivos
   */
  public removeGroup(name: string): boolean {
    // Verificar se o grupo existe
    if (!this.groups.has(name)) {
      return false;
    }

    // Obter dispositivos no grupo
    const group = this.groups.get(name)!;

    // Remover o grupo de cada dispositivo
    for (const deviceId of group) {
      const device = this.devices.get(deviceId);
      if (device) {
        device.groups = device.groups.filter(g => g !== name);
        device.updatedAt = Date.now();
        this.devices.set(deviceId, device);
      }
    }

    // Remover o grupo
    this.groups.delete(name);
    Logger.info(`Grupo removido: ${name}`);

    return true;
  }

  /**
   * Obtém todos os dispositivos de um grupo
   */
  public getDevicesInGroup(groupName: string): Device[] {
    // Verificar se o grupo existe
    if (!this.groups.has(groupName)) {
      throw new EnergyManagerError(
        `Grupo não encontrado: ${groupName}`,
        ErrorType.GROUP_NOT_FOUND
      );
    }

    const group = this.groups.get(groupName)!;
    const devices: Device[] = [];

    // Coletar todos os dispositivos do grupo
    for (const deviceId of group) {
      const device = this.devices.get(deviceId);
      if (device) {
        devices.push(device);
      }
    }

    return devices;
  }

  /**
   * Obtém IDs de todos os dispositivos de um grupo
   */
  public getDeviceIdsInGroup(groupName: string): string[] {
    // Verificar se o grupo existe
    if (!this.groups.has(groupName)) {
      throw new EnergyManagerError(
        `Grupo não encontrado: ${groupName}`,
        ErrorType.GROUP_NOT_FOUND
      );
    }

    return Array.from(this.groups.get(groupName)!);
  }

  /**
   * Obtém todos os grupos existentes
   */
  public getAllGroups(): string[] {
    return Array.from(this.groups.keys());
  }

  /**
   * Obtém todos os dispositivos
   */
  public getAllDevices(): Device[] {
    return Array.from(this.devices.values());
  }

  /**
   * Obtém todos os IDs de dispositivos
   */
  public getAllDeviceIds(): string[] {
    return Array.from(this.devices.keys());
  }
}
