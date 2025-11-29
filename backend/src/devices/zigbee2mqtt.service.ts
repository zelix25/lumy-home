import { Injectable, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { readFileSync } from 'fs';
import { join } from 'path';
import { LoggerService } from '../logger/logger.service';
import { MqttService } from '../mqtt/mqtt.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { Device, DeviceType, DeviceStatus } from './entities/device.entity';
import { HistoryService } from '../history/history.service';
import { AutomationsService } from '../automations/automations.service';

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
  private deviceTypeMapping: Array<{
    model: string;
    vendor?: string;
    type: DeviceType;
  }> = [];

  constructor(
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
    private readonly logger: LoggerService,
    private readonly mqttService: MqttService,
    private readonly websocketGateway: WebsocketGateway,
    @Inject(forwardRef(() => HistoryService))
    private readonly historyService?: HistoryService,
    @Inject(forwardRef(() => AutomationsService))
    private readonly automationsService?: AutomationsService,
  ) {
    this.loadDeviceTypeMapping();
  }

  private loadDeviceTypeMapping(): void {
    try {
      // Essayer d'abord depuis __dirname (après compilation dans dist/)
      let mappingPath = join(__dirname, 'device-type-mapping.json');
      
      // Si le fichier n'existe pas, essayer depuis le répertoire source (en développement)
      try {
        readFileSync(mappingPath, 'utf-8');
      } catch {
        mappingPath = join(process.cwd(), 'src', 'devices', 'device-type-mapping.json');
      }
      
      const mappingFile = readFileSync(mappingPath, 'utf-8');
      const mappings = JSON.parse(mappingFile);

      // Convertir les types string en DeviceType enum
      this.deviceTypeMapping = mappings.map((m: any) => ({
        model: m.model,
        vendor: m.vendor,
        type: DeviceType[m.type.toUpperCase() as keyof typeof DeviceType] || DeviceType.UNKNOWN,
      }));

      this.logger.log(
        `✅ ${this.deviceTypeMapping.length} mappings de types d'appareils chargés depuis ${mappingPath}`,
        'Zigbee2MqttService',
      );
    } catch (error) {
      this.logger.error(
        `Erreur lors du chargement du fichier de mapping: ${error.message}`,
        error.stack,
        'Zigbee2MqttService',
      );
      // Utiliser un tableau vide en cas d'erreur
      this.deviceTypeMapping = [];
    }
  }

  getMqttStatus() {
    return this.mqttService.getStatus();
  }

  async reconnectMqtt(): Promise<void> {
    this.mqttService.reconnect();
  }

  async onModuleInit() {
    // Écouter les messages MQTT
    this.mqttService.message$.subscribe((message) => {
      this.handleMqttMessage(message);
    });

    // Demander la liste des appareils au démarrage
    this.requestDevicesList();

    // Démarrer le polling périodique pour forcer la récupération des états
    this.startPeriodicPolling();
  }

  private startPeriodicPolling() {
    // Polling toutes les 30 secondes pour forcer la récupération des états
    setInterval(async () => {
      if (this.mqttService.isConnected()) {
        // Demander la liste des appareils (qui peut déclencher des mises à jour)
        this.requestDevicesList();
        
        // Demander l'état du bridge (la réponse arrive sur zigbee2mqtt/bridge/state)
        // Pas besoin de publier, le bridge publie automatiquement
        
        this.logger.debug('Polling périodique : demande de la liste des appareils', 'Zigbee2MqttService');
      }
    }, 30000); // 30 secondes
  }

  private async handleMqttMessage(message: {
    topic: string;
    payload: any;
    timestamp: Date;
  }) {
    try {
      // Gérer la liste des appareils depuis différents topics
      if (message.topic === 'zigbee2mqtt/bridge/devices') {
        // Publication automatique de la liste des appareils
        await this.handleDevicesList(message.payload);
      } else if (message.topic === 'zigbee2mqtt/bridge/config/devices') {
        // Réponse à la requête devices/get
        this.logger.debug(
          `Réponse devices/get reçue: ${JSON.stringify(message.payload).substring(0, 200)}`,
          'Zigbee2MqttService',
        );
        if (Array.isArray(message.payload)) {
          await this.handleDevicesList(message.payload);
        } else if (message.payload && Array.isArray(message.payload.devices)) {
          await this.handleDevicesList(message.payload.devices);
        }
      } else if (message.topic.startsWith('zigbee2mqtt/') && message.topic.endsWith('/state')) {
        const friendlyName = message.topic.split('/')[1];
        this.logger.debug(
          `État reçu pour ${friendlyName}: ${JSON.stringify(message.payload)}`,
          'Zigbee2MqttService',
        );
        await this.handleDeviceState(friendlyName, message.payload);
      } else if (message.topic.startsWith('zigbee2mqtt/') && message.topic.endsWith('/availability')) {
        // Gérer la disponibilité des appareils
        const friendlyName = message.topic.split('/')[1];
        await this.handleDeviceAvailability(friendlyName, message.payload);
      } else if (message.topic.startsWith('zigbee2mqtt/') && 
                 !message.topic.startsWith('zigbee2mqtt/bridge/') &&
                 !message.topic.endsWith('/state') &&
                 !message.topic.endsWith('/availability') &&
                 !message.topic.endsWith('/set') &&
                 message.topic.split('/').length === 2) {
        // Format: zigbee2mqtt/{ieeeAddress} - données directes de l'appareil (format principal)
        const ieeeAddress = message.topic.split('/')[1];
        if (ieeeAddress && ieeeAddress.length > 0) {
          // Vérifier que le payload n'est pas vide et est un objet
          if (message.payload && typeof message.payload === 'object' && Object.keys(message.payload).length > 0) {
            this.logger.log(
              `📊 Données appareil [${ieeeAddress}]: ${JSON.stringify(message.payload).substring(0, 200)}`,
              'Zigbee2MqttService',
            );
            await this.handleDeviceStateByIeeeAddress(ieeeAddress, message.payload);
          } else {
            this.logger.debug(
              `📊 Données appareil [${ieeeAddress}]: payload vide ou invalide - ${JSON.stringify(message.payload)}`,
              'Zigbee2MqttService',
            );
          }
        }
      } else if (message.topic.startsWith('zigbee2mqtt/bridge/') && message.topic !== 'zigbee2mqtt/bridge/devices' && 
                 message.topic !== 'zigbee2mqtt/bridge/config' && 
                 message.topic !== 'zigbee2mqtt/bridge/event' &&
                 message.topic !== 'zigbee2mqtt/bridge/log' &&
                 message.topic !== 'zigbee2mqtt/bridge/state' &&
                 !message.topic.startsWith('zigbee2mqtt/bridge/config/')) {
        // Format alternatif: zigbee2mqtt/bridge/{ieeeAddress} - données directes de l'appareil
        const ieeeAddress = message.topic.split('/')[2];
        if (ieeeAddress && ieeeAddress.length > 0) {
          this.logger.log(
            `📊 Données appareil [${ieeeAddress}] (bridge): ${JSON.stringify(message.payload).substring(0, 200)}`,
            'Zigbee2MqttService',
          );
          await this.handleDeviceStateByIeeeAddress(ieeeAddress, message.payload);
        }
      } else if (message.topic === 'zigbee2mqtt/bridge/event') {
        await this.handleBridgeEvent(message.payload);
      } else if (message.topic === 'zigbee2mqtt/bridge/config') {
        // Configuration du bridge (réponse aux commandes)
        this.logger.debug(
          `Configuration bridge Zigbee2MQTT: ${JSON.stringify(message.payload).substring(0, 200)}`,
          'Zigbee2MqttService',
        );
        // Si c'est une réponse à devices/get, traiter comme une liste d'appareils
        if (message.payload?.devices && Array.isArray(message.payload.devices)) {
          await this.handleDevicesList(message.payload.devices);
        }
      } else if (message.topic.startsWith('zigbee2mqtt/bridge/config/')) {
        // Autres topics de configuration (pour déboguer)
        // Ignorer les payloads vides
        if (message.payload === '' || message.payload === null || message.payload === undefined) {
          this.logger.debug(
            `Topic config reçu [${message.topic}]: (payload vide - ignoré)`,
            'Zigbee2MqttService',
          );
          return;
        }
        
        try {
          this.logger.debug(
            `Topic config reçu [${message.topic}]: ${JSON.stringify(message.payload).substring(0, 200)}`,
            'Zigbee2MqttService',
          );
          // Si c'est une réponse devices/get sur le même topic (certaines versions de Zigbee2MQTT)
          if (message.topic === 'zigbee2mqtt/bridge/config/devices/get' && Array.isArray(message.payload)) {
            await this.handleDevicesList(message.payload);
          }
        } catch (error) {
          this.logger.error(
            `Erreur traitement topic config [${message.topic}]: ${error.message}`,
            error.stack,
            'Zigbee2MqttService',
          );
        }
      } else if (message.topic === 'zigbee2mqtt/bridge/log') {
        // Logger les logs du bridge pour déboguer
        this.logger.debug(
          `Log Zigbee2MQTT: ${JSON.stringify(message.payload)}`,
          'Zigbee2MqttService',
        );
      } else if (message.topic === 'zigbee2mqtt/bridge/state') {
        // État du bridge
        this.logger.debug(
          `État bridge Zigbee2MQTT: ${JSON.stringify(message.payload)}`,
          'Zigbee2MqttService',
        );
      } else {
        // Logger les autres topics pour déboguer
        this.logger.debug(
          `Message MQTT non traité [${message.topic}]: ${JSON.stringify(message.payload).substring(0, 100)}`,
          'Zigbee2MqttService',
        );
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
        originalType: zigbeeDevice.type, // Stocker le type original de Zigbee2MQTT
      },
    };

    if (existingDevice) {
      // Mettre à jour les métadonnées pour inclure le type original si manquant
      const existingMeta = existingDevice.meta || {};
      deviceData.meta = {
        ...existingMeta,
        powerSource: zigbeeDevice.power_source,
        disabled: zigbeeDevice.disabled,
        exposes: zigbeeDevice.definition?.exposes || existingMeta.exposes || [],
        originalType: existingMeta.originalType || zigbeeDevice.type, // Préserver ou ajouter le type original
      };
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

      // Enregistrer la découverte dans l'historique
      if (this.historyService) {
        try {
          await this.historyService.logDeviceDiscovered(
            newDevice.ieeeAddress,
            newDevice.friendlyName || newDevice.ieeeAddress,
            deviceType,
            newDevice.room,
          );
        } catch (error) {
          this.logger.error(
            `Erreur lors de l'enregistrement de la découverte: ${error.message}`,
            error.stack,
            'Zigbee2MqttService',
          );
        }
      }

      // Notifier via WebSocket avec un message user-friendly
      const notificationMessage = isSupported
        ? `Un nouvel appareil a été détecté : ${zigbeeDevice.friendly_name}.`
        : `Un appareil a été détecté mais n'est pas encore entièrement supporté : ${zigbeeDevice.friendly_name}. ${unsupportedReason}`;

      this.websocketGateway.broadcast('device:discovered', {
        device: newDevice,
        message: notificationMessage,
      });
    }
  }

  private async handleDeviceStateByIeeeAddress(ieeeAddress: string, state: any) {
    this.logger.debug(
      `🔍 Recherche appareil avec IEEE: ${ieeeAddress}`,
      'Zigbee2MqttService',
    );
    
    // Essayer de trouver l'appareil avec l'IEEE address exact
    let device = await this.deviceRepository.findOne({
      where: { ieeeAddress },
    });

    // Si pas trouvé, essayer avec différentes variantes (minuscules/majuscules)
    if (!device) {
      const allDevices = await this.deviceRepository.find();
      const foundDevice = allDevices.find(
        (d) => d.ieeeAddress.toLowerCase() === ieeeAddress.toLowerCase(),
      );
      if (foundDevice) {
        device = foundDevice;
        this.logger.debug(
          `✅ Appareil trouvé par comparaison insensible à la casse: ${device.friendlyName}`,
          'Zigbee2MqttService',
        );
      }
    }
    
    // Si toujours pas trouvé, essayer de chercher par friendlyName (pour les cas où le topic utilise le nom au lieu de l'IEEE)
    if (!device) {
      const allDevices = await this.deviceRepository.find();
      const foundDevice = allDevices.find(
        (d) => d.friendlyName && d.friendlyName.toLowerCase() === ieeeAddress.toLowerCase(),
      );
      if (foundDevice) {
        device = foundDevice;
        this.logger.debug(
          `✅ Appareil trouvé par friendlyName: ${device.friendlyName} (IEEE: ${device.ieeeAddress})`,
          'Zigbee2MqttService',
        );
      }
    }

    if (!device) {
      // Si l'appareil n'existe pas encore, essayer de le créer depuis la liste des appareils
      this.logger.warn(
        `⚠️ Données reçues pour appareil inconnu (IEEE: ${ieeeAddress}), demande de la liste des appareils`,
        'Zigbee2MqttService',
      );
      this.requestDevicesList();
      return;
    }

    this.logger.debug(
      `✅ Appareil trouvé: ${device.friendlyName} (${device.type}) - IEEE: ${device.ieeeAddress}`,
      'Zigbee2MqttService',
    );

    // Sauvegarder l'ancien état pour détecter les changements
    const oldState = device.state ? JSON.parse(JSON.stringify(device.state)) : {};

    // Mettre à jour l'état avec toutes les données reçues
    // Fusionner intelligemment : garder les valeurs existantes si nouvelles valeurs sont undefined/null
    const mergedState = { ...(device.state || {}) };
    Object.keys(state).forEach((key) => {
      if (state[key] !== undefined && state[key] !== null) {
        mergedState[key] = state[key];
      }
    });
    
    this.logger.debug(
      `📝 État avant fusion [${device.friendlyName}]: ${JSON.stringify(device.state || {})}`,
      'Zigbee2MqttService',
    );
    this.logger.debug(
      `📝 Nouvelles données reçues: ${JSON.stringify(state)}`,
      'Zigbee2MqttService',
    );
    this.logger.debug(
      `📝 État après fusion: ${JSON.stringify(mergedState)}`,
      'Zigbee2MqttService',
    );
    
    device.state = mergedState;
    device.status = DeviceStatus.ONLINE;
    device.updatedAt = new Date();
    
    const savedDevice = await this.deviceRepository.save(device);

    // Enregistrer les événements dans l'historique
    if (this.historyService) {
      try {
        // Détecter les changements significatifs et les enregistrer
        await this.logSignificantEvents(savedDevice, oldState, mergedState);
      } catch (error) {
        this.logger.error(
          `Erreur lors de l'enregistrement de l'historique: ${error.message}`,
          error.stack,
          'Zigbee2MqttService',
        );
      }
    }
    
    this.logger.log(
      `✅ État mis à jour [${savedDevice.friendlyName || ieeeAddress}]: ${Object.keys(mergedState).length} propriétés`,
      'Zigbee2MqttService',
    );
    this.logger.debug(
      `✅ État sauvegardé dans DB: ${JSON.stringify(savedDevice.state)}`,
      'Zigbee2MqttService',
    );

    // S'assurer que l'état est bien sérialisé (TypeORM peut retourner un objet complexe)
    const deviceToSend = {
      ...savedDevice,
      state: savedDevice.state ? JSON.parse(JSON.stringify(savedDevice.state)) : null,
    };
    
    this.logger.debug(
      `📡 Préparation WebSocket pour [${deviceToSend.friendlyName}]: state = ${JSON.stringify(deviceToSend.state)}`,
      'Zigbee2MqttService',
    );
    
    // Diffuser la mise à jour via WebSocket avec l'appareil complet sauvegardé
    this.websocketGateway.broadcast('device:updated', { 
      device: deviceToSend,
      message: `Données mises à jour pour ${deviceToSend.friendlyName || ieeeAddress}`,
    });
    
    this.logger.debug(
      `📡 WebSocket broadcast envoyé pour [${deviceToSend.friendlyName}]`,
      'Zigbee2MqttService',
    );
    
    // Également envoyer l'événement device:state pour compatibilité
    this.websocketGateway.broadcast('device:state', {
      ieeeAddress: deviceToSend.ieeeAddress,
      friendlyName: deviceToSend.friendlyName,
      state: deviceToSend.state,
    });

    // Déclencher les automatisations si un service d'automatisations est disponible
    if (this.automationsService) {
      try {
        await this.triggerAutomations(deviceToSend, oldState, mergedState);
      } catch (error) {
        this.logger.error(
          `Erreur lors du déclenchement des automatisations: ${error.message}`,
          error.stack,
          'Zigbee2MqttService',
        );
      }
    }
  }

  /**
   * Déclenche les automatisations basées sur les événements Zigbee
   */
  private async triggerAutomations(device: Device, oldState: any, newState: any) {
    if (!this.automationsService) return;

    // Détecter le type d'événement
    let eventType: string | null = null;

    // Détection de mouvement
    if (
      (newState.occupancy === true || newState.occupancy === 'true') &&
      (oldState.occupancy !== true && oldState.occupancy !== 'true')
    ) {
      eventType = 'motion';
      await this.automationsService.handleZigbeeEvent(device.ieeeAddress, eventType, newState);
    }

    // Détection de contact (porte/fenêtre)
    if (newState.contact !== undefined && oldState.contact !== newState.contact) {
      eventType = 'contact';
      await this.automationsService.handleZigbeeEvent(device.ieeeAddress, eventType, {
        ...newState,
        contactChanged: true,
        isOpen: !newState.contact, // contact: true = fermé, false = ouvert
      });
    }

    // Détection de température
    if (
      newState.temperature !== undefined &&
      oldState.temperature !== undefined &&
      Math.abs(newState.temperature - oldState.temperature) > 0.5
    ) {
      eventType = 'temperature';
      await this.automationsService.handleZigbeeEvent(device.ieeeAddress, eventType, newState);
    }

    // Détection de bouton pressé
    if (newState.action !== undefined && oldState.action !== newState.action) {
      eventType = 'button';
      await this.automationsService.handleZigbeeEvent(device.ieeeAddress, eventType, {
        ...newState,
        action: newState.action,
      });
    }
  }

  private async handleDeviceState(friendlyName: string, state: ZigbeeState) {
    const device = await this.deviceRepository.findOne({
      where: { friendlyName },
    });

    if (!device) {
      // Si l'appareil n'existe pas encore, essayer de le créer depuis la liste des appareils
      this.logger.debug(
        `État reçu pour appareil inconnu: ${friendlyName}, demande de la liste des appareils`,
        'Zigbee2MqttService',
      );
      this.requestDevicesList();
      return;
    }

    // Mettre à jour l'état avec toutes les données reçues
    // Fusionner intelligemment : garder les valeurs existantes si nouvelles valeurs sont undefined/null
    const mergedState = { ...(device.state || {}) };
    Object.keys(state).forEach((key) => {
      if (state[key] !== undefined && state[key] !== null) {
        mergedState[key] = state[key];
      }
    });
    
    device.state = mergedState;
    device.status = DeviceStatus.ONLINE;
    device.updatedAt = new Date();

    await this.deviceRepository.save(device);

    this.logger.debug(
      `État mis à jour pour ${friendlyName}: ${JSON.stringify(state)}`,
      'Zigbee2MqttService',
    );

    // Diffuser la mise à jour via WebSocket
    this.websocketGateway.broadcast('device:state', {
      ieeeAddress: device.ieeeAddress,
      friendlyName: device.friendlyName,
      state: device.state,
    });
  }

  private async handleDeviceAvailability(friendlyName: string, availability: any) {
    const device = await this.deviceRepository.findOne({
      where: { friendlyName },
    });

    if (!device) {
      return;
    }

    // Sauvegarder l'ancien statut pour détecter les changements
    const oldStatus = device.status;

    // Mettre à jour le statut selon la disponibilité
    const isAvailable = availability?.state === 'online' || availability === 'online';
    device.status = isAvailable ? DeviceStatus.ONLINE : DeviceStatus.OFFLINE;
    device.updatedAt = new Date();

    await this.deviceRepository.save(device);

    this.logger.debug(
      `Disponibilité mise à jour pour ${friendlyName}: ${isAvailable ? 'en ligne' : 'hors ligne'}`,
      'Zigbee2MqttService',
    );

    // Enregistrer le changement de statut dans l'historique
    if (this.historyService && oldStatus !== device.status) {
      try {
        if (device.status === DeviceStatus.ONLINE) {
          await this.historyService.logDeviceOnline(
            device.ieeeAddress,
            device.friendlyName || device.ieeeAddress,
            device.room,
          );
        } else {
          await this.historyService.logDeviceOffline(
            device.ieeeAddress,
            device.friendlyName || device.ieeeAddress,
            device.room,
          );
        }
      } catch (error) {
        this.logger.error(
          `Erreur lors de l'enregistrement du changement de statut: ${error.message}`,
          error.stack,
          'Zigbee2MqttService',
        );
      }
    }

    // Diffuser la mise à jour via WebSocket
    this.websocketGateway.broadcast('device:availability', {
      ieeeAddress: device.ieeeAddress,
      friendlyName: device.friendlyName,
      status: device.status,
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
          const oldStatus = device.status;
          device.status = DeviceStatus.OFFLINE;
          await this.deviceRepository.save(device);
          
          // Enregistrer l'événement offline dans l'historique
          if (this.historyService && oldStatus !== DeviceStatus.OFFLINE) {
            try {
              await this.historyService.logDeviceOffline(
                device.ieeeAddress,
                device.friendlyName || device.ieeeAddress,
                device.room,
              );
            } catch (error) {
              this.logger.error(
                `Erreur lors de l'enregistrement de l'événement offline: ${error.message}`,
                error.stack,
                'Zigbee2MqttService',
              );
            }
          }
          
          this.websocketGateway.broadcast('device:offline', { device });
        }
      }
    }
  }


  private normalizeDeviceType(device: ZigbeeDevice): DeviceType {
    const friendlyName = device.friendly_name.toLowerCase();
    const type = device.type?.toLowerCase() || '';
    const model = device.definition?.model?.toLowerCase() || '';
    const vendor = device.definition?.vendor?.toLowerCase() || '';

    // 1. Vérifier le tableau de correspondance par modèle/vendor
    for (const mapping of this.deviceTypeMapping) {
      const mappingModel = mapping.model.toLowerCase();
      const mappingVendor = mapping.vendor?.toLowerCase();
      
      if (model.includes(mappingModel) || model === mappingModel) {
        // Si un vendor est spécifié, vérifier qu'il correspond aussi
        if (mappingVendor) {
          if (vendor.includes(mappingVendor) || vendor === mappingVendor) {
            this.logger.debug(
              `Type détecté par mapping: ${mapping.model} (${mapping.vendor}) -> ${mapping.type}`,
              'Zigbee2MqttService',
            );
            return mapping.type;
          }
        } else {
          // Pas de vendor spécifié, accepter n'importe quel vendor
          this.logger.debug(
            `Type détecté par mapping: ${mapping.model} -> ${mapping.type}`,
            'Zigbee2MqttService',
          );
          return mapping.type;
        }
      }
    }

    // 2. Détection par type Zigbee2MQTT
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

    // 3. Détection par exposes
    if (device.definition?.exposes) {
      const exposes = device.definition.exposes;
      if (exposes.some((e: any) => e.type === 'light' || e.features?.some((f: any) => f.type === 'light'))) {
        return DeviceType.LIGHT;
      }
      if (exposes.some((e: any) => e.type === 'switch')) {
        return DeviceType.SWITCH;
      }
    }

    // 4. Détection par exposes (vérification plus approfondie)
    if (device.definition?.exposes) {
      const exposes = device.definition.exposes;
      const exposesStr = JSON.stringify(exposes).toLowerCase();
      
      // Vérifier la présence de features spécifiques
      if (exposesStr.includes('presence') || exposesStr.includes('occupancy')) {
        return DeviceType.MOTION;
      }
      if (exposesStr.includes('temperature') && exposesStr.includes('humidity')) {
        return DeviceType.TEMPERATURE;
      }
      if (exposesStr.includes('contact')) {
        return DeviceType.DOOR;
      }
      if (exposesStr.includes('illuminance')) {
        return DeviceType.SENSOR;
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
    // Zigbee2MQTT accepte une chaîne vide pour demander la liste des appareils
    // La réponse arrive sur zigbee2mqtt/bridge/config/devices (sans /get)
    this.mqttService.publish('zigbee2mqtt/bridge/config/devices/get', '');
    this.logger.debug(
      'Requête liste des appareils envoyée sur zigbee2mqtt/bridge/config/devices/get',
      'Zigbee2MqttService',
    );
    // this.mqttService.publish('zigbee2mqtt/bridge/config/devices/get', {});
  }

  public async requestDeviceStates() {
    // Demander les états de tous les appareils
    this.logger.log('Demande des états de tous les appareils', 'Zigbee2MqttService');
    
    // Récupérer tous les appareils et forcer une lecture pour chacun
    const devices = await this.deviceRepository.find();
    
    for (const device of devices) {
      if (device.status === DeviceStatus.ONLINE) {
        // Pour certains types d'appareils, on peut forcer une lecture
        // En publiant une commande de lecture (si supporté par l'appareil)
        // Mais généralement, on attend que Zigbee2MQTT publie automatiquement
        this.logger.debug(
          `Appareil ${device.friendlyName} en ligne, attente de publication d'état`,
          'Zigbee2MqttService',
        );
      }
    }
    
    // Demander aussi la liste des appareils qui peut déclencher des mises à jour
    this.requestDevicesList();
  }

  public async forceReadDeviceState(friendlyName: string) {
    // Forcer la lecture d'un appareil spécifique
    // Certains appareils Zigbee supportent la commande "read"
    const topic = `zigbee2mqtt/${friendlyName}/get`;
    const payload = { state: '' }; // Commande vide pour forcer la lecture
    
    this.mqttService.publish(topic, payload);
    this.logger.log(
      `Lecture forcée demandée pour ${friendlyName}`,
      'Zigbee2MqttService',
    );
  }

  public async sendCommand(friendlyName: string, command: Record<string, any>): Promise<void> {
    const topic = `zigbee2mqtt/${friendlyName}/set`;
    this.mqttService.publish(topic, command);
    this.logger.log(
      `🎮 Commande envoyée [${friendlyName}]: ${JSON.stringify(command)}`,
      'Zigbee2MqttService',
    );
  }

  public async sendMqttMessage(topic: string, payload: any): Promise<void> {
    this.mqttService.publish(topic, payload);
    this.logger.log(
      `📨 Message MQTT envoyé [${topic}]: ${JSON.stringify(payload)}`,
      'Zigbee2MqttService',
    );
  }

  public async removeDevice(friendlyName: string, ieeeAddress?: string): Promise<void> {
    // Supprimer un appareil de Zigbee2MQTT
    // Utiliser le topic bridge/request/device/remove avec le friendly_name ou ieee_address
    // Documentation: https://www.zigbee2mqtt.io/guide/usage/mqtt_topics_and_messages.html#zigbee2mqtt-bridge-request-device-remove
    const topic = 'zigbee2mqtt/bridge/request/device/remove';
    // Payload peut être {"id": "deviceID"} ou deviceID (string)
    // On utilise l'ieee_address si disponible, sinon le friendly_name
    // Toujours mettre "force": true pour forcer la suppression
    const deviceId = ieeeAddress || friendlyName;
    const payload = {
      id: deviceId,
      force: true,
    };
    
    this.mqttService.publish(topic, payload);
    this.logger.log(
      `🗑️ Suppression forcée de l'appareil demandée [${friendlyName}] (${ieeeAddress || 'N/A'}) via ${topic}`,
      'Zigbee2MqttService',
    );
  }

  public renameDevice(oldFriendlyName: string, newFriendlyName: string): void {
    // Topic correct pour renommer un appareil dans Zigbee2MQTT
    const topic = 'zigbee2mqtt/bridge/request/device/rename';
    const payload = {
      from: oldFriendlyName,
      to: newFriendlyName,
    };
    
    this.mqttService.publish(topic, payload);
    this.logger.log(
      `🔄 Renommage de ${oldFriendlyName} vers ${newFriendlyName} via MQTT`,
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
      `🔍 Détection d'appareils activée: ${actualDuration}s (${Math.round(actualDuration / 60)} min)`,
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

  /**
   * Enregistre les événements significatifs dans l'historique
   */
  private async logSignificantEvents(
    device: Device,
    oldState: Record<string, any>,
    newState: Record<string, any>,
  ): Promise<void> {
    if (!this.historyService) return;

    // Détection de mouvement
    if (
      newState.presence === true ||
      newState.occupancy === true ||
      (newState.motion !== undefined && newState.motion === true)
    ) {
      const hadMotion = oldState.presence === true || oldState.occupancy === true || oldState.motion === true;
      if (!hadMotion) {
        await this.historyService.logMotionDetected(
          device.ieeeAddress,
          device.friendlyName || device.ieeeAddress,
          device.room,
          { presence: newState.presence, occupancy: newState.occupancy, motion: newState.motion },
        );
      }
    }

    // Changement de contact (porte/fenêtre)
    if (newState.contact !== undefined && oldState.contact !== newState.contact) {
      await this.historyService.logContactChanged(
        device.ieeeAddress,
        device.friendlyName || device.ieeeAddress,
        !newState.contact, // contact: true = fermé, false = ouvert
        device.room,
      );
    }

    // Changement de température significatif (> 0.5°C)
    if (
      newState.temperature !== undefined &&
      oldState.temperature !== undefined &&
      Math.abs(newState.temperature - oldState.temperature) > 0.5
    ) {
      await this.historyService.logTemperatureChanged(
        device.ieeeAddress,
        device.friendlyName || device.ieeeAddress,
        newState.temperature,
        device.room,
      );
    }

    // Changement d'état (ON/OFF, brightness, etc.)
    const stateChanged =
      oldState.state !== newState.state ||
      (oldState.brightness !== newState.brightness && newState.brightness !== undefined) ||
      (oldState.color_temp !== newState.color_temp && newState.color_temp !== undefined);

    if (stateChanged) {
      await this.historyService.logStateChanged(
        device.ieeeAddress,
        device.friendlyName || device.ieeeAddress,
        oldState,
        newState,
        device.room,
      );
    }
  }
}

