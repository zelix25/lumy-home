import { Injectable, NotFoundException, ConflictException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Device, DeviceStatus } from './entities/device.entity';
import { Zigbee2MqttService } from './zigbee2mqtt.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class DevicesService implements OnModuleInit {
  private readonly OFFLINE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours en millisecondes

  constructor(
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
    private zigbee2MqttService: Zigbee2MqttService,
    private websocketGateway: WebsocketGateway,
    private logger: LoggerService,
  ) {}

  onModuleInit() {
    this.logger.log('DevicesService initialisé - Vérification périodique des appareils hors ligne activée', 'DevicesService');
  }

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

  /**
   * Vérifie périodiquement les appareils et les passe en OFFLINE s'ils n'ont pas donné signe de vie depuis 7 jours
   * Exécuté toutes les minutes
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkOfflineDevices(): Promise<void> {
    try {
      const now = new Date();
      const thresholdDate = new Date(now.getTime() - this.OFFLINE_THRESHOLD_MS);

      // Trouver tous les appareils en ligne qui n'ont pas été mis à jour depuis 7 jours
      const devicesToMarkOffline = await this.deviceRepository.find({
        where: {
          status: DeviceStatus.ONLINE,
          updatedAt: LessThan(thresholdDate),
        },
      });

      if (devicesToMarkOffline.length > 0) {
        this.logger.log(
          `Vérification appareils hors ligne: ${devicesToMarkOffline.length} appareil(s) à passer en OFFLINE`,
          'DevicesService',
        );

        for (const device of devicesToMarkOffline) {
          const oldStatus = device.status;
          device.status = DeviceStatus.OFFLINE;
          await this.deviceRepository.save(device);

          this.logger.log(
            `Appareil ${device.friendlyName || device.ieeeAddress} passé en OFFLINE (dernière mise à jour: ${device.updatedAt.toISOString()})`,
            'DevicesService',
          );

          // Diffuser la mise à jour via WebSocket
          this.websocketGateway.broadcast('device:updated', {
            device,
            message: `L'appareil ${device.friendlyName || device.ieeeAddress} est maintenant hors ligne`,
          });

          // Enregistrer l'événement dans l'historique si disponible
          // Note: On ne peut pas injecter HistoryTimelineService ici car cela créerait une dépendance circulaire
          // Cette fonctionnalité est déjà gérée dans zigbee2mqtt.service.ts
        }
      }
    } catch (error) {
      this.logger.error(
        `Erreur lors de la vérification des appareils hors ligne: ${error.message}`,
        error.stack,
        'DevicesService',
      );
    }
  }
}

