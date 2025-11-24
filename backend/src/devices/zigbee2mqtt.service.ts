import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoggerService } from '../logger/logger.service';
import { MqttService } from '../mqtt/mqtt.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { Device, DeviceType, DeviceStatus } from './entities/device.entity';

interface ZigbeeDevice {
  ieee_address: string;
  friendly_name: string;
  type?: string;
  definition?: {
    description?: string;
    model?: string;
    vendor?: string;
    exposes?: any[];
  };
  power_source?: string;
  supported?: boolean;
  disabled?: boolean;
}

interface ZigbeeState {
  state?: string;
  brightness?: number;
  color?: { x?: number; y?: number };
  color_temp?: number;
  linkquality?: number;
  battery?: number;
  voltage?: number;
  [key: string]: any;
}

@Injectable()
export class Zigbee2MqttService implements OnModuleInit {
  constructor(
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
    private readonly logger: LoggerService,
    private readonly mqttService: MqttService,
    private readonly websocketGateway: WebsocketGateway,
  ) {}

  async onModuleInit() {
    // Écouter les messages MQTT
    this.mqttService.message$.subscribe((message) => {
      this.handleMqttMessage(message);
    });

    // Demander la liste des appareils au démarrage
    this.requestDevicesList();
  }

  private async handleMqttMessage(message: {
    topic: string;
    payload: any;
    timestamp: Date;
  }) {
    try {
      if (message.topic === 'zigbee2mqtt/bridge/devices') {
        await this.handleDevicesList(message.payload);
      } else if (message.topic.startsWith('zigbee2mqtt/') && message.topic.endsWith('/state')) {
        const friendlyName = message.topic.split('/')[1];
        await this.handleDeviceState(friendlyName, message.payload);
      } else if (message.topic === 'zigbee2mqtt/bridge/event') {
        await this.handleBridgeEvent(message.payload);
      }
    } catch (error) {
      this.logger.error(
        `Erreur traitement message MQTT: ${error.message}`,
        error.stack,
        'Zigbee2MqttService',
      );
    }
  }

  private async handleDevicesList(devices: ZigbeeDevice[]) {
    if (!Array.isArray(devices)) {
      return;
    }

    this.logger.log(
      `Réception de ${devices.length} appareils depuis Zigbee2MQTT`,
      'Zigbee2MqttService',
    );

    for (const zigbeeDevice of devices) {
      await this.processDevice(zigbeeDevice);
    }

    // Diffuser la mise à jour via WebSocket
    const allDevices = await this.deviceRepository.find();
    this.websocketGateway.broadcast('devices:updated', { devices: allDevices });
  }

  private async processDevice(zigbeeDevice: ZigbeeDevice): Promise<void> {
    const deviceType = this.normalizeDeviceType(zigbeeDevice);
    const isSupported = this.isDeviceSupported(zigbeeDevice);
    const unsupportedReason = isSupported
      ? null
      : this.getUnsupportedReason(zigbeeDevice);

    const existingDevice = await this.deviceRepository.findOne({
      where: { ieeeAddress: zigbeeDevice.ieee_address },
    });

    const deviceData: Partial<Device> = {
      ieeeAddress: zigbeeDevice.ieee_address,
      friendlyName: zigbeeDevice.friendly_name,
      type: deviceType,
      manufacturer: zigbeeDevice.definition?.vendor || undefined,
      model: zigbeeDevice.definition?.model || undefined,
      description: zigbeeDevice.definition?.description || undefined,
      isSupported: isSupported,
      unsupportedReason: unsupportedReason || undefined,
      status: DeviceStatus.ONLINE,
      meta: {
        powerSource: zigbeeDevice.power_source,
        disabled: zigbeeDevice.disabled,
        exposes: zigbeeDevice.definition?.exposes || [],
      },
    };

    if (existingDevice) {
      // Mettre à jour l'appareil existant
      Object.assign(existingDevice, deviceData);
      await this.deviceRepository.save(existingDevice);

      // Si c'est un nouvel appareil (nouveau friendly_name), notifier
      if (existingDevice.friendlyName !== zigbeeDevice.friendly_name) {
        this.logger.log(
          `Appareil mis à jour: ${zigbeeDevice.friendly_name}`,
          'Zigbee2MqttService',
        );
        this.websocketGateway.broadcast('device:updated', {
          device: existingDevice,
          message: `L'appareil ${zigbeeDevice.friendly_name} a été mis à jour`,
        });
      }
    } else {
      // Nouvel appareil
      const newDevice = this.deviceRepository.create(deviceData);
      await this.deviceRepository.save(newDevice);

      this.logger.log(
        `Nouvel appareil détecté: ${zigbeeDevice.friendly_name} (${deviceType})`,
        'Zigbee2MqttService',
      );

      // Notifier via WebSocket avec un message user-friendly
      const notificationMessage = isSupported
        ? `Un nouvel appareil a été détecté : ${zigbeeDevice.friendly_name}. Comment souhaitez-vous le nommer ?`
        : `Un appareil a été détecté mais n'est pas encore entièrement supporté : ${zigbeeDevice.friendly_name}. ${unsupportedReason}`;

      this.websocketGateway.broadcast('device:discovered', {
        device: newDevice,
        message: notificationMessage,
      });
    }
  }

  private async handleDeviceState(friendlyName: string, state: ZigbeeState) {
    const device = await this.deviceRepository.findOne({
      where: { friendlyName },
    });

    if (!device) {
      return;
    }

    // Mettre à jour l'état
    device.state = state;
    device.status = DeviceStatus.ONLINE;
    device.updatedAt = new Date();

    await this.deviceRepository.save(device);

    // Diffuser la mise à jour via WebSocket
    this.websocketGateway.broadcast('device:state', {
      ieeeAddress: device.ieeeAddress,
      friendlyName: device.friendlyName,
      state: state,
    });
  }

  private async handleBridgeEvent(event: any) {
    if (event.type === 'device_joined') {
      this.logger.log(
        `Nouvel appareil rejoint: ${event.data?.friendly_name}`,
        'Zigbee2MqttService',
      );
      // Redemander la liste des appareils
      setTimeout(() => this.requestDevicesList(), 2000);
    } else if (event.type === 'device_leave') {
      this.logger.log(
        `Appareil déconnecté: ${event.data?.ieee_address}`,
        'Zigbee2MqttService',
      );
      // Marquer l'appareil comme offline
      if (event.data?.ieee_address) {
        const device = await this.deviceRepository.findOne({
          where: { ieeeAddress: event.data.ieee_address },
        });
        if (device) {
          device.status = DeviceStatus.OFFLINE;
          await this.deviceRepository.save(device);
          this.websocketGateway.broadcast('device:offline', { device });
        }
      }
    }
  }

  private normalizeDeviceType(device: ZigbeeDevice): DeviceType {
    const friendlyName = device.friendly_name.toLowerCase();
    const type = device.type?.toLowerCase() || '';

    // Détection par type Zigbee2MQTT
    if (type.includes('light') || friendlyName.includes('light') || friendlyName.includes('ampoule')) {
      return DeviceType.LIGHT;
    }
    if (type.includes('switch') || friendlyName.includes('switch') || friendlyName.includes('interrupteur')) {
      return DeviceType.SWITCH;
    }
    if (type.includes('sensor') || friendlyName.includes('sensor') || friendlyName.includes('capteur')) {
      if (friendlyName.includes('motion') || friendlyName.includes('mouvement')) {
        return DeviceType.MOTION;
      }
      if (friendlyName.includes('temperature') || friendlyName.includes('température')) {
        return DeviceType.TEMPERATURE;
      }
      if (friendlyName.includes('door') || friendlyName.includes('porte')) {
        return DeviceType.DOOR;
      }
      if (friendlyName.includes('window') || friendlyName.includes('fenêtre')) {
        return DeviceType.WINDOW;
      }
      return DeviceType.SENSOR;
    }
    if (type.includes('plug') || friendlyName.includes('plug') || friendlyName.includes('prise')) {
      return DeviceType.PLUG;
    }
    if (type.includes('button') || friendlyName.includes('button') || friendlyName.includes('bouton')) {
      return DeviceType.BUTTON;
    }

    // Détection par exposes
    if (device.definition?.exposes) {
      const exposes = device.definition.exposes;
      if (exposes.some((e: any) => e.type === 'light' || e.features?.some((f: any) => f.type === 'light'))) {
        return DeviceType.LIGHT;
      }
      if (exposes.some((e: any) => e.type === 'switch')) {
        return DeviceType.SWITCH;
      }
    }

    return DeviceType.UNKNOWN;
  }

  private isDeviceSupported(device: ZigbeeDevice): boolean {
    // Un appareil est supporté s'il a une définition
    return !!device.definition && device.supported !== false;
  }

  private getUnsupportedReason(device: ZigbeeDevice): string {
    if (!device.definition) {
      return "Cet appareil n'a pas encore de définition dans Zigbee2MQTT. Il sera peut-être supporté dans une future mise à jour.";
    }
    if (device.supported === false) {
      return "Cet appareil est marqué comme non supporté par Zigbee2MQTT.";
    }
    return "Cet appareil nécessite une configuration supplémentaire.";
  }

  private requestDevicesList() {
    this.mqttService.publish('zigbee2mqtt/bridge/config/devices/get', {});
  }

  public async sendCommand(friendlyName: string, command: Record<string, any>): Promise<void> {
    const topic = `zigbee2mqtt/${friendlyName}/set`;
    this.mqttService.publish(topic, command);
    this.logger.log(
      `Commande envoyée à ${friendlyName}: ${JSON.stringify(command)}`,
      'Zigbee2MqttService',
    );
  }

  public renameDevice(oldFriendlyName: string, newFriendlyName: string): void {
    const topic = 'zigbee2mqtt/bridge/config/devices/rename';
    this.mqttService.publish(topic, {
      from: oldFriendlyName,
      to: newFriendlyName,
    });
    this.logger.log(
      `Renommage de ${oldFriendlyName} vers ${newFriendlyName}`,
      'Zigbee2MqttService',
    );
  }

  public permitJoin(duration: number = 254): void {
    // duration en secondes, 254 = maximum Zigbee2MQTT (environ 4 minutes)
    // Zigbee2MQTT utilise le topic bridge/request/permit_join
    const topic = 'zigbee2mqtt/bridge/request/permit_join';
    
    // Format selon la documentation Zigbee2MQTT:
    // {"value": true, "time": duration} où time est en secondes (max 254)
    // Si duration > 254, on limite à 254 secondes (limite Zigbee2MQTT)
    const actualDuration = duration > 254 ? 254 : duration;
    const payload = { value: true, time: actualDuration };
    
    this.logger.log(
      `Publication sur ${topic} avec payload: ${JSON.stringify(payload)}`,
      'Zigbee2MqttService',
    );
    
    this.mqttService.publish(topic, payload);
    
    this.logger.log(
      `Détection d'appareils activée pour ${actualDuration} secondes (${Math.round(actualDuration / 60)} minutes)`,
      'Zigbee2MqttService',
    );
  }

  public stopPermitJoin(): void {
    // Arrêter la détection en publiant value: false
    // Zigbee2MQTT accepte soit bridge/request/permit_join soit bridge/config/permit_join
    const topic = 'zigbee2mqtt/bridge/request/permit_join';
    
    // Vérifier que MQTT est connecté
    if (!this.mqttService.isConnected()) {
      this.logger.error(
        'Impossible d\'arrêter la détection : MQTT n\'est pas connecté',
        '',
        'Zigbee2MqttService',
      );
      return;
    }
    
    // Essayer avec l'objet JSON d'abord
    const payload = { value: false };
    this.logger.log(
      `Arrêt de la détection - Publication sur ${topic} avec payload: ${JSON.stringify(payload)}`,
      'Zigbee2MqttService',
    );
    this.mqttService.publish(topic, payload);
    
    // Essayer aussi avec juste "false" comme string (certaines versions de Zigbee2MQTT)
    this.mqttService.publish(topic, 'false');
    this.logger.log(
      `Publication également avec valeur string "false" sur ${topic}`,
      'Zigbee2MqttService',
    );
    
    // Essayer aussi sur le topic config
    const configTopic = 'zigbee2mqtt/bridge/config/permit_join';
    this.mqttService.publish(configTopic, payload);
    this.mqttService.publish(configTopic, 'false');
    this.logger.log(
      `Publication également sur ${configTopic}`,
      'Zigbee2MqttService',
    );
    
    this.logger.log(
      'Détection d\'appareils désactivée',
      'Zigbee2MqttService',
    );
  }
}

