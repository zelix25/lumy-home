import { Injectable, NotFoundException } from '@nestjs/common';
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

    const stats = {
      total: devices.length,
      byType: {} as Record<string, number>,
      online: 0,
      offline: 0,
      supported: 0,
      unsupported: 0,
    };

    devices.forEach((device) => {
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
}

