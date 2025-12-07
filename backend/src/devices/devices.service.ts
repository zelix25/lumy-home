import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from './entities/device.entity';
import { Zigbee2MqttService } from './zigbee2mqtt.service';

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
    private zigbee2MqttService: Zigbee2MqttService,
  ) {}

  async findAll(): Promise<Device[]> {
    return this.deviceRepository.find({
      order: { friendlyName: 'ASC' },
    });
  }

  async findOne(ieeeAddress: string): Promise<Device> {
    const device = await this.deviceRepository.findOne({
      where: { ieeeAddress },
    });

    if (!device) {
      throw new NotFoundException(`Appareil avec l'adresse ${ieeeAddress} non trouvé`);
    }

    return device;
  }

  async findByType(type: string): Promise<Device[]> {
    return this.deviceRepository.find({
      where: { type: type as any },
      order: { friendlyName: 'ASC' },
    });
  }

  async updateFriendlyName(
    ieeeAddress: string,
    friendlyName: string,
  ): Promise<Device> {
    const device = await this.findOne(ieeeAddress);
    const oldFriendlyName = device.friendlyName;

    // Si le nom change, vérifier qu'il n'existe pas déjà
    if (friendlyName !== oldFriendlyName) {
      const existingDevice = await this.deviceRepository.findOne({
        where: { friendlyName },
      });

      if (existingDevice && existingDevice.ieeeAddress !== ieeeAddress) {
        throw new ConflictException(
          `Un appareil avec le nom "${friendlyName}" existe déjà`,
        );
      }
    }

    device.friendlyName = friendlyName;
    await this.deviceRepository.save(device);

    // Renommer dans Zigbee2MQTT via le bridge
    this.zigbee2MqttService.renameDevice(oldFriendlyName, friendlyName);

    return device;
  }

  async updateRoom(ieeeAddress: string, room?: string): Promise<Device> {
    const device = await this.findOne(ieeeAddress);

    device.room = room || 'Non défini';
    await this.deviceRepository.save(device);

    return device;
  }

  async sendCommand(
    ieeeAddress: string,
    command: Record<string, any>,
  ): Promise<void> {
    const device = await this.findOne(ieeeAddress);
    await this.zigbee2MqttService.sendCommand(device.friendlyName, command);
  }

  async getDeviceStats(): Promise<{
    total: number;
    byType: Record<string, number>;
    online: number;
    offline: number;
    supported: number;
    unsupported: number;
  }> {
    const devices = await this.findAll();

    // Filtrer le coordinateur (ne pas le compter dans les statistiques)
    const devicesWithoutCoordinator = devices.filter((device) => {
      const typeStr = String(device.type).toLowerCase();
      const friendlyNameLower = device.friendlyName ? device.friendlyName.toLowerCase() : '';
      const ieeeAddressLower = device.ieeeAddress ? device.ieeeAddress.toLowerCase() : '';
      
      // Vérifier dans les métadonnées le type original de Zigbee2MQTT
      const originalType = device.meta?.originalType?.toLowerCase() || '';
      
      // Identifier le coordinateur par plusieurs critères
      const isCoordinator = 
        typeStr === 'coordinator' || 
        originalType === 'coordinator' ||
        friendlyNameLower === 'coordinator' ||
        friendlyNameLower.includes('coordinator') ||
        // Le coordinateur Zigbee a généralement une adresse IEEE spécifique (0x0000000000000000)
        (ieeeAddressLower === '0x0000000000000000' || ieeeAddressLower === '0000000000000000');
      
      return !isCoordinator;
    });

    const stats = {
      total: devicesWithoutCoordinator.length,
      byType: {} as Record<string, number>,
      online: 0,
      offline: 0,
      supported: 0,
      unsupported: 0,
    };

    devicesWithoutCoordinator.forEach((device) => {
      stats.byType[device.type] = (stats.byType[device.type] || 0) + 1;

      if (device.status === 'online') {
        stats.online++;
      } else {
        stats.offline++;
      }

      if (device.isSupported) {
        stats.supported++;
      } else {
        stats.unsupported++;
      }
    });

    return stats;
  }

  async startDeviceDiscovery(duration: number = 254): Promise<void> {
    // duration en secondes, par défaut 254 secondes (maximum Zigbee2MQTT)
    await this.zigbee2MqttService.permitJoin(duration);
  }

  async stopDeviceDiscovery(): Promise<void> {
    await this.zigbee2MqttService.stopPermitJoin();
  }

  async getDiscoveryStatus(): Promise<{ active: boolean; timeRemaining?: number }> {
    return this.zigbee2MqttService.getPermitJoinStatus();
  }

  async refreshDeviceStates(): Promise<void> {
    // Forcer la récupération des états actuels
    await this.zigbee2MqttService.requestDeviceStates();
  }

  async forceReadDeviceState(ieeeAddress: string): Promise<void> {
    const device = await this.findOne(ieeeAddress);
    await this.zigbee2MqttService.forceReadDeviceState(device.friendlyName);
  }

  async forceReadAllDeviceStates(): Promise<void> {
    const devices = await this.findAll();
    for (const device of devices) {
      if (device.status === 'online') {
        await this.zigbee2MqttService.forceReadDeviceState(device.friendlyName);
        // Petit délai pour éviter de surcharger
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }

  async sendMqttMessage(topic: string, payload: any): Promise<void> {
    await this.zigbee2MqttService.sendMqttMessage(topic, payload);
  }

  getMqttStatus() {
    return this.zigbee2MqttService.getMqttStatus();
  }

  async reconnectMqtt(): Promise<void> {
    await this.zigbee2MqttService.reconnectMqtt();
  }

  async remove(ieeeAddress: string): Promise<void> {
    const device = await this.findOne(ieeeAddress);
    
    // Supprimer l'appareil de Zigbee2MQTT avant de le supprimer de la DB
    if (device.friendlyName) {
      await this.zigbee2MqttService.removeDevice(device.friendlyName, device.ieeeAddress);
    }
    
    // Supprimer l'appareil de la base de données
    await this.deviceRepository.remove(device);
  }
}

