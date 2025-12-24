import { Injectable, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { LoggerService } from '../logger/logger.service';
import { MqttService } from '../mqtt/mqtt.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { Device, DeviceType, DeviceStatus } from './entities/device.entity';
import { HistoryService as HistoryTimelineService } from '../history_timeline/history_timeline.service';
import { HistoryService } from '../history/history.service';
import { SensorType } from '../history/entities/history.entity';
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

interface DeviceTypeMappingEntry {
  model: string;
  vendor?: string;
  type: string;
  comment?: string;
}

@Injectable()
export class Zigbee2MqttService implements OnModuleInit {
  private deviceTypeMapping: DeviceTypeMappingEntry[] = [];
  private permitJoinActive: boolean = false;
  private permitJoinTimeRemaining: number = 0;
  private permitJoinStartTime: Date | null = null;
  private permitJoinDuration: number = 0;
  // Debounce pour les événements de bouton (éviter les déclenchements multiples)
  private lastButtonPressTime: Map<string, number> = new Map();
  private readonly BUTTON_DEBOUNCE_MS = 200; // 200ms de debounce

  constructor(
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
    private readonly logger: LoggerService,
    private readonly mqttService: MqttService,
    private readonly websocketGateway: WebsocketGateway,
    @Inject(forwardRef(() => HistoryTimelineService))
    private readonly historyTimelineService?: HistoryTimelineService,
    @Inject(forwardRef(() => HistoryService))
    private readonly historyService?: HistoryService,
    @Inject(forwardRef(() => AutomationsService))
    private readonly automationsService?: AutomationsService,
  ) {
    this.loadDeviceTypeMapping();
  }

  private loadDeviceTypeMapping(): void {
    try {
      // Chercher le fichier dans src/devices (développement) ou dist/devices (production)
      // __dirname pointe vers dist/devices en production ou src/devices en développement
      let mappingPath = path.join(__dirname, 'device-type-mapping.json');
      
      // Si le fichier n'existe pas à cet emplacement, essayer depuis la racine du projet
      if (!fs.existsSync(mappingPath)) {
        // Essayer depuis process.cwd() (racine du projet)
        const rootPath = path.join(process.cwd(), 'src', 'devices', 'device-type-mapping.json');
        if (fs.existsSync(rootPath)) {
          mappingPath = rootPath;
        } else {
          // Essayer dans dist si on est en production
          const distPath = path.join(process.cwd(), 'dist', 'devices', 'device-type-mapping.json');
          if (fs.existsSync(distPath)) {
            mappingPath = distPath;
          }
        }
      }

      if (!fs.existsSync(mappingPath)) {
        throw new Error(`Fichier de mapping introuvable: ${mappingPath}`);
      }

      const mappingContent = fs.readFileSync(mappingPath, 'utf-8');
      this.deviceTypeMapping = JSON.parse(mappingContent) as DeviceTypeMappingEntry[];
      
      // Vérifier que le fichier contient bien des données
      if (!Array.isArray(this.deviceTypeMapping)) {
        throw new Error('Le fichier de mapping ne contient pas un tableau valide');
      }
      
      // Compter les types "other" pour information
      const otherCount = this.deviceTypeMapping.filter(e => e.type?.toLowerCase() === 'other').length;
      
      this.logger.log(
        `✅ Fichier de mapping chargé: ${this.deviceTypeMapping.length} entrées depuis ${mappingPath} (${otherCount} de type "other")`,
        'Zigbee2MqttService',
      );
    } catch (error) {
      this.logger.error(
        `Erreur lors du chargement du fichier de mapping: ${error.message}`,
        error.stack,
        'Zigbee2MqttService',
      );
      this.deviceTypeMapping = [];
      this.logger.log(
        'Détection de type d\'appareil basée uniquement sur les données Zigbee2MQTT (exposes, type)',
        'Zigbee2MqttService',
      );
    }
  }

  /**
   * Convertit un type du fichier de mapping vers DeviceType
   */
  private mapJsonTypeToDeviceType(jsonType: string): DeviceType {
    const typeMap: Record<string, DeviceType> = {
      light: DeviceType.LIGHT,
      switch: DeviceType.SWITCH,
      sensor: DeviceType.SENSOR,
      plug: DeviceType.PLUG,
      door: DeviceType.DOOR,
      window: DeviceType.WINDOW,
      temperature: DeviceType.TEMPERATURE,
      humidity: DeviceType.HUMIDITY,
      motion: DeviceType.MOTION,
      button: DeviceType.BUTTON,
      cover: DeviceType.COVER, // Les covers sont traités comme des switches (contacteurs de volet)
      energy: DeviceType.ENERGY,
      other: DeviceType.OTHER,
      unknown: DeviceType.UNKNOWN,
    };

    return typeMap[jsonType?.toLowerCase()] || DeviceType.UNKNOWN;
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
        const bridgeState = message.payload as any;
        if (typeof bridgeState === 'object' && bridgeState !== null) {
          // Mettre à jour l'état de permit_join si présent
          if ('permit_join' in bridgeState) {
            const wasActive = this.permitJoinActive;
            this.permitJoinActive = bridgeState.permit_join === true;
            
            // Si permit_join devient inactif, réinitialiser l'état
            if (wasActive && !this.permitJoinActive) {
              this.permitJoinTimeRemaining = 0;
              this.permitJoinStartTime = null;
              this.permitJoinDuration = 0;
            }
            // Si permit_join devient actif mais qu'on n'a pas de timestamp de début,
            // on ne peut pas calculer le temps restant exactement
            // mais on marque comme actif (le frontend gérera l'affichage)
          }
        }
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

  /**
   * Génère un nom MQTT à partir d'un nom friendly
   * - Convertit en minuscules
   * - Supprime les accents
   * - Remplace les espaces par des tirets
   * - Supprime les caractères spéciaux (garde uniquement lettres, chiffres, tirets)
   */
  private generateMqttName(friendlyName: string): string {
    if (!friendlyName) return '';

    // Normaliser les caractères Unicode (supprimer les accents)
    let normalized = friendlyName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Supprimer les diacritiques
      .toLowerCase();

    // Remplacer les espaces et caractères spéciaux par des tirets
    normalized = normalized.replace(/[^a-z0-9]+/g, '-');

    // Supprimer les tirets en début et fin
    normalized = normalized.replace(/^-+|-+$/g, '');

    // Si le résultat est vide, utiliser un nom par défaut
    if (!normalized) {
      normalized = 'device';
    }

    return normalized;
  }

  private async processDevice(zigbeeDevice: ZigbeeDevice): Promise<void> {
    // Log pour déboguer les données de l'appareil
    this.logger.debug(
      `🔍 Traitement appareil: ${zigbeeDevice.friendly_name}, modèle: "${zigbeeDevice.definition?.model || 'N/A'}", vendor: "${zigbeeDevice.definition?.vendor || 'N/A'}", type Zigbee2MQTT: "${zigbeeDevice.type || 'N/A'}"`,
      'Zigbee2MqttService',
    );
    
    const deviceType = this.normalizeDeviceType(zigbeeDevice);
    const isSupported = this.isDeviceSupported(zigbeeDevice);
    const unsupportedReason = isSupported
      ? null
      : this.getUnsupportedReason(zigbeeDevice);

    const existingDevice = await this.deviceRepository.findOne({
      where: { ieeeAddress: zigbeeDevice.ieee_address },
    });

    // IMPORTANT: Zigbee2MQTT envoie le friendly_name qu'il utilise (qui est normalisé pour les topics)
    // Pour les nouveaux appareils, on utilise ce nom comme friendlyName initial
    // Pour les appareils existants, on préserve le friendlyName défini par l'utilisateur
    const zigbeeFriendlyName = zigbeeDevice.friendly_name;
    const mqttName = this.generateMqttName(zigbeeFriendlyName);

    const deviceData: Partial<Device> = {
      ieeeAddress: zigbeeDevice.ieee_address,
      mqttName: mqttName, // Nom normalisé utilisé par Zigbee2MQTT dans les topics
      friendlyName: zigbeeFriendlyName, // Pour les nouveaux appareils uniquement
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
        originalZigbeeName: mqttName, // Stocker le nom normalisé utilisé par Zigbee2MQTT dans les topics
      },
    };

    if (existingDevice) {
      // IMPORTANT: Ne pas écraser le friendlyName défini par l'utilisateur
      // Le friendlyName est uniquement utilisé côté backend/frontend pour l'affichage
      // Seul le mqttName doit être mis à jour avec le nom reçu de Zigbee2MQTT
      
      // Mettre à jour les métadonnées pour inclure le type original si manquant
      const existingMeta = existingDevice.meta || {};
      deviceData.meta = {
        ...existingMeta,
        powerSource: zigbeeDevice.power_source,
        disabled: zigbeeDevice.disabled,
        exposes: zigbeeDevice.definition?.exposes || existingMeta.exposes || [],
        originalType: existingMeta.originalType || zigbeeDevice.type, // Préserver ou ajouter le type original
        // Mettre à jour le nom normalisé utilisé par Zigbee2MQTT dans les topics
        originalZigbeeName: mqttName, // Toujours mettre à jour avec le nom normalisé actuel de Zigbee2MQTT
      };
      
      // Mettre à jour uniquement les champs techniques, pas le friendlyName utilisateur
      existingDevice.mqttName = mqttName; // Mettre à jour le mqttName avec le nom reçu de Zigbee2MQTT
      if (deviceData.type !== undefined) {
        existingDevice.type = deviceData.type;
      }
      if (deviceData.manufacturer !== undefined) {
        existingDevice.manufacturer = deviceData.manufacturer;
      }
      if (deviceData.model !== undefined) {
        existingDevice.model = deviceData.model;
      }
      if (deviceData.description !== undefined) {
        existingDevice.description = deviceData.description;
      }
      if (deviceData.isSupported !== undefined) {
        existingDevice.isSupported = deviceData.isSupported;
      }
      if (deviceData.unsupportedReason !== undefined) {
        existingDevice.unsupportedReason = deviceData.unsupportedReason;
      }
      if (deviceData.status !== undefined) {
        existingDevice.status = deviceData.status;
      }
      if (deviceData.meta !== undefined) {
        existingDevice.meta = deviceData.meta;
      }
      // Ne PAS mettre à jour existingDevice.friendlyName - il reste le nom défini par l'utilisateur
      
      await this.deviceRepository.save(existingDevice);

      // Vérifier si le mqttName a changé (indique un renommage dans Zigbee2MQTT)
      const oldMqttName = existingDevice.meta?.originalZigbeeName;
      if (oldMqttName && oldMqttName !== mqttName) {
        this.logger.log(
          `Appareil renommé dans Zigbee2MQTT: ${oldMqttName} -> ${mqttName}`,
          'Zigbee2MqttService',
        );
        this.websocketGateway.broadcast('device:updated', {
          device: existingDevice,
          message: `L'appareil a été renommé dans Zigbee2MQTT`,
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

      // Enregistrer la découverte dans l'historique (sauf pour les appareils "energy")
      if (this.historyTimelineService && deviceType !== DeviceType.ENERGY) {
        try {
          await this.historyTimelineService.logDeviceDiscovered(
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
    
    // Si toujours pas trouvé, essayer de chercher par mqttName (pour les cas où le topic utilise le nom MQTT)
    if (!device) {
      const allDevices = await this.deviceRepository.find();
      const foundDevice = allDevices.find(
        (d) => d.mqttName && d.mqttName.toLowerCase() === ieeeAddress.toLowerCase(),
      );
      if (foundDevice) {
        device = foundDevice;
        this.logger.debug(
          `✅ Appareil trouvé par mqttName: ${device.mqttName} (IEEE: ${device.ieeeAddress})`,
          'Zigbee2MqttService',
        );
      }
    }
    
    // Si toujours pas trouvé, essayer de chercher par friendlyName (pour compatibilité avec les anciens noms)
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

    // Enregistrer les événements dans l'historique timeline
    if (this.historyTimelineService) {
      try {
        // Détecter les changements significatifs et les enregistrer
        await this.logSignificantEvents(savedDevice, oldState, mergedState);
      } catch (error) {
        this.logger.error(
          `Erreur lors de l'enregistrement de l'historique timeline: ${error.message}`,
          error.stack,
          'Zigbee2MqttService',
        );
      }
    }

    // Enregistrer les données de capteurs dans l'historique
    if (this.historyService) {
      try {
        await this.logSensorData(savedDevice.ieeeAddress, savedDevice.type, oldState, mergedState);
      } catch (error) {
        this.logger.error(
          `Erreur lors de l'enregistrement des données capteurs: ${error.message}`,
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
    if (!this.automationsService) {
      this.logger.debug('Service d\'automatisations non disponible, arrêt du déclenchement', 'Zigbee2MqttService');
      return;
    }

    this.logger.debug(
      `[AUTOMATION TRIGGER] Vérification des événements pour l'appareil: ${device.friendlyName} (${device.ieeeAddress})`,
      'Zigbee2MqttService',
    );

    // Détecter le type d'événement
    let eventType: string | null = null;

    // Détection de mouvement
    if (
      (newState.occupancy === true || newState.occupancy === 'true') &&
      (oldState.occupancy !== true && oldState.occupancy !== 'true')
    ) {
      eventType = 'motion';
      this.logger.log(
        `[AUTOMATION TRIGGER] 🔔 MOUVEMENT détecté sur l'appareil "${device.friendlyName}" (${device.ieeeAddress}) - Ancien état: ${oldState.occupancy}, Nouvel état: ${newState.occupancy}`,
        'Zigbee2MqttService',
      );
      await this.automationsService.handleZigbeeEvent(device.ieeeAddress, eventType, newState);
    }

    // Détection de contact (porte/fenêtre)
    if (newState.contact !== undefined && oldState.contact !== newState.contact) {
      eventType = 'contact';
      const isOpen = !newState.contact;
      this.logger.log(
        `[AUTOMATION TRIGGER] 🚪 CONTACT détecté sur l'appareil "${device.friendlyName}" (${device.ieeeAddress}) - Ancien état: ${oldState.contact ? 'fermé' : 'ouvert'}, Nouvel état: ${newState.contact ? 'fermé' : 'ouvert'} (${isOpen ? 'OUVERT' : 'FERMÉ'})`,
        'Zigbee2MqttService',
      );
      await this.automationsService.handleZigbeeEvent(device.ieeeAddress, eventType, {
        ...newState,
        contactChanged: true,
        isOpen: isOpen,
      });
    }

    // Détection de température
    if (
      newState.temperature !== undefined &&
      oldState.temperature !== undefined &&
      Math.abs(newState.temperature - oldState.temperature) > 0.5
    ) {
      eventType = 'temperature';
      this.logger.log(
        `[AUTOMATION TRIGGER] 🌡️ TEMPÉRATURE détectée sur l'appareil "${device.friendlyName}" (${device.ieeeAddress}) - Ancienne: ${oldState.temperature}°C, Nouvelle: ${newState.temperature}°C (différence: ${Math.abs(newState.temperature - oldState.temperature).toFixed(2)}°C)`,
        'Zigbee2MqttService',
      );
      await this.automationsService.handleZigbeeEvent(device.ieeeAddress, eventType, newState);
    }

    // Détection de bouton pressé
    // Les boutons Zigbee peuvent utiliser différents champs : action, click, button_l, button_r, button_1, button_2, etc.
    // Pour les interrupteurs/poussoirs, l'action "single" doit être détectée
    const buttonFields = ['action', 'click', 'button_l', 'button_r', 'button_1', 'button_2', 'button_3', 'button_4'];
    let buttonEventDetected = false;
    let buttonField = null;
    let buttonValue = null;
    let oldButtonValue = null;

    // Vérifier si l'appareil est de type SWITCH (Interrupteur) ou BUTTON (Poussoir)
    const isSwitchOrButton = device.type === DeviceType.SWITCH || device.type === DeviceType.BUTTON;

    // Vérifier le debounce pour éviter les déclenchements multiples
    const now = Date.now();
    const lastPressTime = this.lastButtonPressTime.get(device.ieeeAddress) || 0;
    const timeSinceLastPress = now - lastPressTime;

    for (const field of buttonFields) {
      const newValue = newState[field];
      const oldValue = oldState[field];
      
      // Détecter si un champ de bouton a changé ou est présent pour la première fois
      if (newValue !== undefined) {
        // Pour les interrupteurs/poussoirs, détecter spécifiquement l'action "single"
        // IMPORTANT: Pour ces appareils, "single" est toujours la même valeur à chaque appui,
        // donc on détecte chaque fois que "single" est présent dans le nouveau message,
        // même si la valeur précédente était aussi "single" (car un nouveau message = nouvel appui)
        // Mais on utilise un debounce pour éviter les déclenchements multiples
        if (isSwitchOrButton && field === 'action' && newValue === 'single') {
          // Vérifier le debounce : ne déclencher que si au moins BUTTON_DEBOUNCE_MS se sont écoulés
          if (timeSinceLastPress >= this.BUTTON_DEBOUNCE_MS) {
            buttonEventDetected = true;
            buttonField = field;
            buttonValue = newValue;
            oldButtonValue = oldValue;
            // Mettre à jour le timestamp du dernier appui
            this.lastButtonPressTime.set(device.ieeeAddress, now);
            this.logger.log(
              `[AUTOMATION TRIGGER] 🔘 Action "single" détectée sur ${device.type === DeviceType.SWITCH ? 'interrupteur' : 'poussoir'} "${device.friendlyName}" (${device.ieeeAddress}) - Ancienne valeur: ${oldValue ?? 'undefined'}, Nouvelle valeur: ${newValue} (debounce: ${timeSinceLastPress}ms)`,
              'Zigbee2MqttService',
            );
            break;
          } else {
            this.logger.debug(
              `[AUTOMATION TRIGGER] ⏱️ Action "single" ignorée (debounce) sur "${device.friendlyName}" - ${timeSinceLastPress}ms depuis le dernier appui (minimum: ${this.BUTTON_DEBOUNCE_MS}ms)`,
              'Zigbee2MqttService',
            );
          }
        }
        // Pour les autres boutons, détecter uniquement si la valeur a changé
        else if (!isSwitchOrButton) {
          // Si l'ancienne valeur n'existe pas ou est différente, c'est un événement
          if (oldValue === undefined || oldValue !== newValue) {
            if (newValue !== null && newValue !== '' && newValue !== false) {
              // Vérifier le debounce pour les autres boutons aussi
              if (timeSinceLastPress >= this.BUTTON_DEBOUNCE_MS) {
                buttonEventDetected = true;
                buttonField = field;
                buttonValue = newValue;
                oldButtonValue = oldValue;
                // Mettre à jour le timestamp du dernier appui
                this.lastButtonPressTime.set(device.ieeeAddress, now);
                break;
              }
            }
          }
        }
      }
    }

    if (buttonEventDetected) {
      eventType = 'button';
      this.logger.log(
        `[AUTOMATION TRIGGER] 🔘 BOUTON détecté sur l'appareil "${device.friendlyName}" (${device.ieeeAddress}) - Type: ${device.type}, Champ: ${buttonField}, Ancienne valeur: ${oldButtonValue ?? 'undefined'}, Nouvelle valeur: ${buttonValue}`,
        'Zigbee2MqttService',
      );
      await this.automationsService.handleZigbeeEvent(device.ieeeAddress, eventType, {
        ...newState,
        action: buttonValue, // Normaliser en 'action' pour la compatibilité
        buttonField: buttonField, // Conserver le champ original pour le debug
        buttonValue: buttonValue,
      });
    }

    // Détection de vibration
    if (newState.vibration !== undefined && oldState.vibration !== newState.vibration) {
      eventType = 'vibration';
      this.logger.log(
        `[AUTOMATION TRIGGER] 📳 VIBRATION détectée sur l'appareil "${device.friendlyName}" (${device.ieeeAddress}) - Ancien état: ${oldState.vibration}, Nouvel état: ${newState.vibration}`,
        'Zigbee2MqttService',
      );
      await this.automationsService.handleZigbeeEvent(device.ieeeAddress, eventType, newState);
    }

    // Détection de luminosité (illuminance)
    if (
      newState.illuminance !== undefined &&
      oldState.illuminance !== undefined &&
      Math.abs(newState.illuminance - oldState.illuminance) > 10
    ) {
      eventType = 'illuminance';
      this.logger.log(
        `[AUTOMATION TRIGGER] 💡 LUMINOSITÉ détectée sur l'appareil "${device.friendlyName}" (${device.ieeeAddress}) - Ancienne: ${oldState.illuminance} lux, Nouvelle: ${newState.illuminance} lux`,
        'Zigbee2MqttService',
      );
      await this.automationsService.handleZigbeeEvent(device.ieeeAddress, eventType, newState);
    }

    // Détection d'humidité
    if (
      newState.humidity !== undefined &&
      oldState.humidity !== undefined &&
      Math.abs(newState.humidity - oldState.humidity) > 2
    ) {
      eventType = 'humidity';
      this.logger.log(
        `[AUTOMATION TRIGGER] 💧 HUMIDITÉ détectée sur l'appareil "${device.friendlyName}" (${device.ieeeAddress}) - Ancienne: ${oldState.humidity}%, Nouvelle: ${newState.humidity}%`,
        'Zigbee2MqttService',
      );
      await this.automationsService.handleZigbeeEvent(device.ieeeAddress, eventType, newState);
    }

    // Détection de fuite d'eau
    if (
      (newState.water_leak === true || newState.water === true) &&
      (oldState.water_leak !== true && oldState.water !== true)
    ) {
      eventType = 'water_leak';
      this.logger.log(
        `[AUTOMATION TRIGGER] 💦 FUITE D'EAU détectée sur l'appareil "${device.friendlyName}" (${device.ieeeAddress})`,
        'Zigbee2MqttService',
      );
      await this.automationsService.handleZigbeeEvent(device.ieeeAddress, eventType, newState);
    }

    // Détection de fumée
    if (
      (newState.smoke === true || newState.smoke_detected === true) &&
      (oldState.smoke !== true && oldState.smoke_detected !== true)
    ) {
      eventType = 'smoke';
      this.logger.log(
        `[AUTOMATION TRIGGER] 🔥 FUMÉE détectée sur l'appareil "${device.friendlyName}" (${device.ieeeAddress})`,
        'Zigbee2MqttService',
      );
      await this.automationsService.handleZigbeeEvent(device.ieeeAddress, eventType, newState);
    }

    // Détection de gaz
    if (
      (newState.gas === true || newState.gas_detected === true) &&
      (oldState.gas !== true && oldState.gas_detected !== true)
    ) {
      eventType = 'gas';
      this.logger.log(
        `[AUTOMATION TRIGGER] ⛽ GAZ détecté sur l'appareil "${device.friendlyName}" (${device.ieeeAddress})`,
        'Zigbee2MqttService',
      );
      await this.automationsService.handleZigbeeEvent(device.ieeeAddress, eventType, newState);
    }

    if (!eventType) {
      this.logger.debug(
        `[AUTOMATION TRIGGER] Aucun événement déclencheur détecté pour l'appareil "${device.friendlyName}" (${device.ieeeAddress})`,
        'Zigbee2MqttService',
      );
    }
  }

  private async handleDeviceState(friendlyName: string, state: ZigbeeState) {
    // Le friendlyName dans le topic peut être soit le mqttName soit l'ancien friendlyName
    // Chercher d'abord par mqttName (priorité), puis par friendlyName (compatibilité)
    let device = await this.deviceRepository.findOne({
      where: { mqttName: friendlyName },
    });

    if (!device) {
      device = await this.deviceRepository.findOne({
        where: { friendlyName },
      });
    }

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
    // Le friendlyName dans le topic peut être soit le mqttName soit l'ancien friendlyName
    // Chercher d'abord par mqttName (priorité), puis par friendlyName (compatibilité)
    let device = await this.deviceRepository.findOne({
      where: { mqttName: friendlyName },
    });

    if (!device) {
      device = await this.deviceRepository.findOne({
        where: { friendlyName },
      });
    }

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

    // Enregistrer le changement de statut dans l'historique (sauf pour les appareils "energy")
    if (this.historyTimelineService && oldStatus !== device.status && device.type !== DeviceType.ENERGY) {
      try {
        if (device.status === DeviceStatus.ONLINE) {
          await this.historyTimelineService.logDeviceOnline(
            device.ieeeAddress,
            device.friendlyName || device.ieeeAddress,
            device.room,
          );
        } else {
          await this.historyTimelineService.logDeviceOffline(
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
          
          // Enregistrer l'événement offline dans l'historique (sauf pour les appareils "energy")
          if (this.historyTimelineService && oldStatus !== DeviceStatus.OFFLINE && device.type !== DeviceType.ENERGY) {
            try {
              await this.historyTimelineService.logDeviceOffline(
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


  /**
   * Détermine le type d'appareil en se basant sur :
   * 1. Le fichier de mapping device-type-mapping.json (priorité)
   * 2. Les données Zigbee2MQTT (exposes, type, model, vendor) avec des regex et patterns améliorés
   */
  private normalizeDeviceType(device: ZigbeeDevice): DeviceType {
    const friendlyName = device.friendly_name?.toLowerCase() || '';
    const type = device.type?.toLowerCase() || '';
    const exposes = device.definition?.exposes || [];
    const exposesStr = JSON.stringify(exposes).toLowerCase();
    const model = device.definition?.model || '';
    const modelLower = model.toLowerCase();
    const vendor = device.definition?.vendor?.toLowerCase() || '';
    const description = device.definition?.description?.toLowerCase() || '';
    
    // PRIORITÉ 0: Chercher dans le fichier de mapping par modèle (et vendor si disponible)
    if (this.deviceTypeMapping.length > 0) {
      // Normaliser le modèle pour la recherche (trim, lowercase, supprimer espaces multiples)
      const normalizedModel = model ? modelLower.trim().replace(/\s+/g, ' ') : '';
      const normalizedVendor = vendor ? vendor.trim().toLowerCase() : '';
      
      let mappingEntry: DeviceTypeMappingEntry | undefined = undefined;
      
      // 1. Chercher une correspondance exacte par modèle (si disponible)
      if (normalizedModel) {
        mappingEntry = this.deviceTypeMapping.find(
          (entry) => {
            const entryModel = entry.model?.toLowerCase().trim().replace(/\s+/g, ' ') || '';
            return entryModel === normalizedModel;
          },
        );
      }

      // 2. Si pas trouvé, essayer une correspondance partielle (le modèle du mapping contient le modèle de l'appareil ou vice versa)
      if (!mappingEntry && normalizedModel) {
        mappingEntry = this.deviceTypeMapping.find(
          (entry) => {
            const entryModel = entry.model?.toLowerCase().trim().replace(/\s+/g, ' ') || '';
            return entryModel.includes(normalizedModel) || normalizedModel.includes(entryModel);
          },
        );
      }

      // 3. Si pas trouvé et qu'on a un vendor, chercher avec modèle + vendor
      if (!mappingEntry && normalizedModel && normalizedVendor) {
        mappingEntry = this.deviceTypeMapping.find(
          (entry) => {
            const entryModel = entry.model?.toLowerCase().trim().replace(/\s+/g, ' ') || '';
            const entryVendor = entry.vendor?.toLowerCase().trim() || '';
            return entryModel === normalizedModel && entryVendor === normalizedVendor;
          },
        );
      }

      // 4. Si toujours pas trouvé et qu'on a un vendor, chercher uniquement par vendor (si plusieurs entrées avec le même vendor, prendre la première)
      if (!mappingEntry && normalizedVendor) {
        mappingEntry = this.deviceTypeMapping.find(
          (entry) => {
            const entryVendor = entry.vendor?.toLowerCase().trim() || '';
            return entryVendor === normalizedVendor;
          },
        );
      }

      // Si trouvé, utiliser le type du mapping
      if (mappingEntry) {
        const mappedType = this.mapJsonTypeToDeviceType(mappingEntry.type);
        this.logger.log(
          `✅ Type détecté par mapping JSON: ${mappedType} pour ${device.friendly_name} (modèle: ${model || 'N/A'}${vendor ? `, vendor: ${vendor}` : ''}, type mapping: ${mappingEntry.type})`,
          'Zigbee2MqttService',
        );
        return mappedType;
      } else {
        // Log pour déboguer si le modèle n'est pas trouvé
        if (normalizedModel) {
          this.logger.debug(
            `🔍 Modèle "${model}" non trouvé dans le mapping (${this.deviceTypeMapping.length} entrées disponibles)${vendor ? `, vendor: ${vendor}` : ''}`,
            'Zigbee2MqttService',
          );
        } else {
          this.logger.debug(
            `⚠️ Pas de modèle disponible pour ${device.friendly_name}, impossible de chercher dans le mapping${vendor ? ` (vendor: ${vendor})` : ''}`,
            'Zigbee2MqttService',
          );
        }
      }
    } else if (this.deviceTypeMapping.length === 0) {
      this.logger.debug(
        `⚠️ Fichier de mapping non chargé ou vide, utilisation de la détection par exposes/type`,
        'Zigbee2MqttService',
      );
    }
    
    // Créer une chaîne combinée pour les recherches regex
    const combinedStr = `${friendlyName} ${type} ${modelLower} ${vendor} ${description} ${exposesStr}`.toLowerCase();

    // Définir les patterns regex réutilisables
    const vibrationPattern = /\b(vibration|vibrate|tilt|shock|impact)\b/i;
    const coverPattern = /\b(cover|blind|shutter|curtain|window_covering|lift|position|tilt)\b/i;
    const modelPatterns = {
      vibration: /\b(vibration|vibrate|shock|tilt|rqbz|sjcgq|sjcgq11lm|sjcgq12lm)\b/i,
      cover: /\b(cover|blind|shutter|curtain|moes|tuya|_ts|_tz|motor|lift|position)\b/i,
      motion: /\b(motion|pir|presence|occupancy|rtcgq|sml001|sml002)\b/i,
      contact: /\b(contact|door|window|magnet|mccgq|sensor_magnet)\b/i,
      button: /\b(button|remote|switch_remote|wxcjkg|wxcjkg11lm|wxcjkg12lm|wxcjkg13lm)\b/i,
    };

    // 1. Détection par exposes (le plus fiable - données directes de Zigbee2MQTT)
    if (exposes.length > 0) {
      // PRIORITÉ 1: Détection des capteurs de vibration (avant les boutons)
      // Regex pour détecter vibration dans exposes, model, description
      if (vibrationPattern.test(exposesStr) || 
          vibrationPattern.test(model) || 
          vibrationPattern.test(description) ||
          exposes.some((e: any) => {
            const eStr = JSON.stringify(e).toLowerCase();
            return eStr.includes('vibration') || eStr.includes('tilt') || 
                   e.name?.toLowerCase().includes('vibration') ||
                   e.property?.toLowerCase().includes('vibration');
          })) {
        this.logger.debug(
          `Type détecté par exposes/model: SENSOR (vibration) pour ${device.friendly_name}`,
          'Zigbee2MqttService',
        );
        return DeviceType.SENSOR;
      }

      // PRIORITÉ 2: Détection des volets roulants / contacteurs (cover, window_covering, lift)
      // Regex pour détecter cover/blind/shutter dans exposes, model, description
      const isCover = coverPattern.test(exposesStr) || 
                      coverPattern.test(model) || 
                      coverPattern.test(description) ||
                      exposes.some((e: any) => {
                        return e.type === 'cover' || 
                               e.type === 'window_covering' ||
                               e.name?.toLowerCase().includes('cover') ||
                               e.name?.toLowerCase().includes('lift') ||
                               e.name?.toLowerCase().includes('position');
                      });
      
      // Si c'est un cover mais qu'il a aussi des features de switch/light, c'est probablement un contacteur de volet
      if (isCover) {
        // Les contacteurs de volet peuvent être classés comme SWITCH car ils contrôlent un moteur
        this.logger.debug(
          `Type détecté par exposes/model: SWITCH (cover/blind controller) pour ${device.friendly_name}`,
          'Zigbee2MqttService',
        );
        return DeviceType.SWITCH;
      }

      // PRIORITÉ 3: Détection des lumières (mais pas si c'est un cover)
      if (exposes.some((e: any) => {
        if (e.type === 'light') return true;
        if (e.features?.some((f: any) => f.type === 'light' || (f.name === 'state' && !isCover))) return true;
        return false;
      })) {
        // Vérifier que ce n'est pas un cover qui a aussi des features de light
        if (!isCover) {
          this.logger.debug(
            `Type détecté par exposes: LIGHT pour ${device.friendly_name}`,
            'Zigbee2MqttService',
          );
          return DeviceType.LIGHT;
        }
      }

      // PRIORITÉ 4: Détection des interrupteurs et boutons
      if (exposes.some((e: any) => e.type === 'switch' || e.name === 'state')) {
        // Vérifier si c'est un bouton (action, click, button dans exposes)
        // Mais exclure les capteurs de vibration qui peuvent avoir des actions
        const hasAction = exposesStr.includes('action') || 
                         exposesStr.includes('click') || 
                         exposesStr.includes('button');
        const isVibrationSensor = vibrationPattern.test(exposesStr) || 
                                 vibrationPattern.test(model) || 
                                 vibrationPattern.test(description);
        
        if (hasAction && !isVibrationSensor) {
          this.logger.debug(
            `Type détecté par exposes: BUTTON pour ${device.friendly_name}`,
            'Zigbee2MqttService',
          );
          return DeviceType.BUTTON;
        }
        this.logger.debug(
          `Type détecté par exposes: SWITCH pour ${device.friendly_name}`,
          'Zigbee2MqttService',
        );
        return DeviceType.SWITCH;
      }

      // Détection des capteurs de mouvement
      if (exposesStr.includes('presence') || exposesStr.includes('occupancy') || exposesStr.includes('motion')) {
        this.logger.debug(
          `Type détecté par exposes: MOTION pour ${device.friendly_name}`,
          'Zigbee2MqttService',
        );
        return DeviceType.MOTION;
      }

      // Détection des capteurs de température/humidité
      if (exposesStr.includes('temperature') && exposesStr.includes('humidity')) {
        this.logger.debug(
          `Type détecté par exposes: TEMPERATURE pour ${device.friendly_name}`,
          'Zigbee2MqttService',
        );
        return DeviceType.TEMPERATURE;
      }

      // Détection des capteurs de contact (porte/fenêtre)
      if (exposesStr.includes('contact')) {
        // Distinguer porte et fenêtre par le nom si possible
        if (friendlyName.includes('window') || friendlyName.includes('fenêtre')) {
          this.logger.debug(
            `Type détecté par exposes: WINDOW pour ${device.friendly_name}`,
            'Zigbee2MqttService',
          );
          return DeviceType.WINDOW;
        }
        this.logger.debug(
          `Type détecté par exposes: DOOR pour ${device.friendly_name}`,
          'Zigbee2MqttService',
        );
        return DeviceType.DOOR;
      }

      // Détection des prises (prises intelligentes avec mesure de puissance)
      if (exposesStr.includes('power') && (exposesStr.includes('switch') || exposesStr.includes('state'))) {
        this.logger.debug(
          `Type détecté par exposes: PLUG pour ${device.friendly_name}`,
          'Zigbee2MqttService',
        );
        return DeviceType.PLUG;
      }
      // Détection des prises simples (juste un switch/outlet)
      if (exposes.some((e: any) => e.type === 'outlet' || (e.type === 'switch' && !exposesStr.includes('button')))) {
        this.logger.debug(
          `Type détecté par exposes: PLUG pour ${device.friendly_name}`,
          'Zigbee2MqttService',
        );
        return DeviceType.PLUG;
      }

      // Note: La détection des boutons est maintenant dans PRIORITÉ 4 (déjà traitée ci-dessus)

      // Note: La détection des capteurs de vibration est maintenant en PRIORITÉ 1 (déjà traitée ci-dessus)

      // Détection des capteurs de fuite d'eau
      if (exposesStr.includes('water') || exposesStr.includes('leak')) {
        this.logger.debug(
          `Type détecté par exposes: SENSOR (water leak) pour ${device.friendly_name}`,
          'Zigbee2MqttService',
        );
        return DeviceType.SENSOR;
      }

      // Détection des capteurs de fumée/gaz
      if (exposesStr.includes('smoke') || exposesStr.includes('gas')) {
        this.logger.debug(
          `Type détecté par exposes: SENSOR (smoke/gas) pour ${device.friendly_name}`,
          'Zigbee2MqttService',
        );
        return DeviceType.SENSOR;
      }

      // Détection des capteurs génériques (luminosité, pression, batterie, etc.)
      if (exposesStr.includes('illuminance') || exposesStr.includes('luminosity') || 
          exposesStr.includes('pressure') || (exposesStr.includes('battery') && !exposesStr.includes('button'))) {
        this.logger.debug(
          `Type détecté par exposes: SENSOR pour ${device.friendly_name}`,
          'Zigbee2MqttService',
        );
        return DeviceType.SENSOR;
      }
    }

    // 2. Détection par model/vendor avec regex (si exposes n'est pas suffisant)
    // Vérifier les patterns dans model, vendor, description
    if (modelPatterns.vibration.test(model) || 
        modelPatterns.vibration.test(vendor) || 
        modelPatterns.vibration.test(description)) {
      this.logger.debug(
        `Type détecté par model/vendor: SENSOR (vibration) pour ${device.friendly_name}`,
        'Zigbee2MqttService',
      );
      return DeviceType.SENSOR;
    }

    if (modelPatterns.cover.test(model) || 
        modelPatterns.cover.test(vendor) || 
        modelPatterns.cover.test(description)) {
      this.logger.debug(
        `Type détecté par model/vendor: SWITCH (cover/blind) pour ${device.friendly_name}`,
        'Zigbee2MqttService',
      );
      return DeviceType.SWITCH;
    }

    // 3. Détection par type Zigbee2MQTT (si exposes n'est pas disponible)
    if (type) {
      // Vérifier d'abord si c'est un cover dans le type
      if (type.includes('cover') || type.includes('window_covering') || type.includes('blind')) {
        this.logger.debug(
          `Type détecté par type Zigbee2MQTT: SWITCH (cover) pour ${device.friendly_name}`,
          'Zigbee2MqttService',
        );
        return DeviceType.SWITCH;
      }
      
      if (type.includes('light') || type === 'light') {
        // Vérifier que ce n'est pas un cover
        if (!coverPattern.test(combinedStr)) {
          this.logger.debug(
            `Type détecté par type Zigbee2MQTT: LIGHT pour ${device.friendly_name}`,
            'Zigbee2MqttService',
          );
          return DeviceType.LIGHT;
        }
      }
      if (type.includes('switch') || type === 'switch') {
        this.logger.debug(
          `Type détecté par type Zigbee2MQTT: SWITCH pour ${device.friendly_name}`,
          'Zigbee2MqttService',
        );
        return DeviceType.SWITCH;
      }
      if (type.includes('sensor') || type === 'sensor') {
        // Essayer de déterminer le type de capteur avec regex
        if (modelPatterns.vibration.test(combinedStr)) {
          return DeviceType.SENSOR;
        }
        if (modelPatterns.motion.test(combinedStr) || 
            friendlyName.includes('motion') || friendlyName.includes('mouvement') || 
            friendlyName.includes('pir') || friendlyName.includes('presence')) {
          return DeviceType.MOTION;
        }
        if (friendlyName.includes('temperature') || friendlyName.includes('température') ||
            friendlyName.includes('humidity') || friendlyName.includes('humidité')) {
          return DeviceType.TEMPERATURE;
        }
        if (modelPatterns.contact.test(combinedStr) || 
            friendlyName.includes('door') || friendlyName.includes('porte')) {
          return DeviceType.DOOR;
        }
        if (friendlyName.includes('window') || friendlyName.includes('fenêtre')) {
          return DeviceType.WINDOW;
        }
        this.logger.debug(
          `Type détecté par type Zigbee2MQTT: SENSOR pour ${device.friendly_name}`,
          'Zigbee2MqttService',
        );
        return DeviceType.SENSOR;
      }
      if (type.includes('plug') || type === 'plug' || type.includes('outlet')) {
        this.logger.debug(
          `Type détecté par type Zigbee2MQTT: PLUG pour ${device.friendly_name}`,
          'Zigbee2MqttService',
        );
        return DeviceType.PLUG;
      }
      if (type.includes('button') || type === 'button') {
        // Vérifier que ce n'est pas un capteur de vibration
        if (!modelPatterns.vibration.test(combinedStr)) {
          this.logger.debug(
            `Type détecté par type Zigbee2MQTT: BUTTON pour ${device.friendly_name}`,
            'Zigbee2MqttService',
          );
          return DeviceType.BUTTON;
        }
      }
    }

    // 3. Détection par nom friendly (dernier recours)
    if (friendlyName.includes('light') || friendlyName.includes('ampoule') || friendlyName.includes('bulb') || 
        friendlyName.includes('lamp') || friendlyName.includes('lampe')) {
      this.logger.debug(
        `Type détecté par nom: LIGHT pour ${device.friendly_name}`,
        'Zigbee2MqttService',
      );
      return DeviceType.LIGHT;
    }
    if (friendlyName.includes('switch') || friendlyName.includes('interrupteur')) {
      this.logger.debug(
        `Type détecté par nom: SWITCH pour ${device.friendly_name}`,
        'Zigbee2MqttService',
      );
      return DeviceType.SWITCH;
    }
    if (friendlyName.includes('plug') || friendlyName.includes('prise') || friendlyName.includes('socket')) {
      this.logger.debug(
        `Type détecté par nom: PLUG pour ${device.friendly_name}`,
        'Zigbee2MqttService',
      );
      return DeviceType.PLUG;
    }
    if (friendlyName.includes('button') || friendlyName.includes('bouton') || friendlyName.includes('remote')) {
      this.logger.debug(
        `Type détecté par nom: BUTTON pour ${device.friendly_name}`,
        'Zigbee2MqttService',
      );
      return DeviceType.BUTTON;
    }
    if (friendlyName.includes('motion') || friendlyName.includes('mouvement') || friendlyName.includes('pir')) {
      this.logger.debug(
        `Type détecté par nom: MOTION pour ${device.friendly_name}`,
        'Zigbee2MqttService',
      );
      return DeviceType.MOTION;
    }
    if (friendlyName.includes('temperature') || friendlyName.includes('température') ||
        friendlyName.includes('humidity') || friendlyName.includes('humidité')) {
      this.logger.debug(
        `Type détecté par nom: TEMPERATURE pour ${device.friendly_name}`,
        'Zigbee2MqttService',
      );
      return DeviceType.TEMPERATURE;
    }
    if (friendlyName.includes('door') || friendlyName.includes('porte')) {
      this.logger.debug(
        `Type détecté par nom: DOOR pour ${device.friendly_name}`,
        'Zigbee2MqttService',
      );
      return DeviceType.DOOR;
    }
    if (friendlyName.includes('window') || friendlyName.includes('fenêtre')) {
      this.logger.debug(
        `Type détecté par nom: WINDOW pour ${device.friendly_name}`,
        'Zigbee2MqttService',
      );
      return DeviceType.WINDOW;
    }
    if (friendlyName.includes('sensor') || friendlyName.includes('capteur')) {
      this.logger.debug(
        `Type détecté par nom: SENSOR pour ${device.friendly_name}`,
        'Zigbee2MqttService',
      );
      return DeviceType.SENSOR;
    }

    // Si aucun type n'a pu être déterminé, logger un avertissement
    this.logger.warn(
      `Impossible de déterminer le type pour ${device.friendly_name} (type: ${type}, exposes: ${exposes.length} features)`,
      'Zigbee2MqttService',
    );
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

  /**
   * Supprime un appareil de Zigbee2MQTT
   * @param mqttName - Nom MQTT de l'appareil (utilisé pour les logs)
   * @param ieeeAddress - Adresse IEEE de l'appareil (utilisée dans le payload, prioritaire)
   */
  public async removeDevice(mqttName: string, ieeeAddress?: string): Promise<void> {
    // Supprimer un appareil de Zigbee2MQTT
    // Utiliser le topic bridge/request/device/remove avec l'ieee_address (prioritaire) ou le mqttName
    // Documentation: https://www.zigbee2mqtt.io/guide/usage/mqtt_topics_and_messages.html#zigbee2mqtt-bridge-request-device-remove
    const topic = 'zigbee2mqtt/bridge/request/device/remove';
    // Payload peut être {"id": "deviceID"} ou deviceID (string)
    // On utilise l'ieee_address si disponible (recommandé), sinon le mqttName
    // Toujours mettre "force": true pour forcer la suppression
    const deviceId = ieeeAddress || mqttName;
    const payload = {
      id: deviceId,
      force: true,
    };
    
    this.mqttService.publish(topic, payload);
    this.logger.log(
      `🗑️ Suppression forcée de l'appareil demandée [${mqttName}] (${ieeeAddress || 'N/A'}) via ${topic}`,
      'Zigbee2MqttService',
    );
  }

  /**
   * Renomme un appareil dans Zigbee2MQTT
   * Envoie le mqttName (nom normalisé) à Zigbee2MQTT qui l'utilisera comme friendly_name
   * et pour générer les topics MQTT
   * @param oldMqttName - Ancien nom MQTT de l'appareil (utilisé dans les topics)
   * @param newMqttName - Nouveau nom MQTT de l'appareil (utilisé dans les topics)
   */
  public renameDevice(oldMqttName: string, newMqttName: string): void {
    // Topic correct pour renommer un appareil dans Zigbee2MQTT
    const topic = 'zigbee2mqtt/bridge/request/device/rename';
    // Le payload envoie les mqttName (noms normalisés) à Zigbee2MQTT
    // Zigbee2MQTT utilisera le champ "to" comme friendly_name et pour générer les topics
    const payload = {
      from: oldMqttName,
      to: newMqttName, // mqttName normalisé (sans accents, espaces remplacés par tirets)
    };
    
    this.mqttService.publish(topic, payload);
    this.logger.log(
      `🔄 Renommage MQTT de "${oldMqttName}" vers "${newMqttName}" (payload: ${JSON.stringify(payload)})`,
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
    
    // Mettre à jour l'état local
    this.permitJoinActive = true;
    this.permitJoinTimeRemaining = actualDuration;
    this.permitJoinStartTime = new Date();
    this.permitJoinDuration = actualDuration;
    
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
    
    // Mettre à jour l'état local
    this.permitJoinActive = false;
    this.permitJoinTimeRemaining = 0;
    this.permitJoinStartTime = null;
    this.permitJoinDuration = 0;
  }

  public getPermitJoinStatus(): { active: boolean; timeRemaining?: number } {
    if (!this.permitJoinActive || !this.permitJoinStartTime) {
      return {
        active: this.permitJoinActive,
        timeRemaining: undefined,
      };
    }

    // Calculer le temps restant en fonction du temps écoulé
    const now = new Date();
    const elapsedSeconds = Math.floor((now.getTime() - this.permitJoinStartTime.getTime()) / 1000);
    const remaining = Math.max(0, this.permitJoinDuration - elapsedSeconds);

    // Mettre à jour l'état si le temps est écoulé
    if (remaining === 0) {
      this.permitJoinActive = false;
      this.permitJoinTimeRemaining = 0;
      this.permitJoinStartTime = null;
      this.permitJoinDuration = 0;
    }

    return {
      active: this.permitJoinActive,
      timeRemaining: remaining > 0 ? remaining : undefined,
    };
  }

  /**
   * Enregistre les données de capteurs dans l'historique
   */
  private async logSensorData(
    deviceId: string,
    deviceType: string,
    oldState: Record<string, any>,
    newState: Record<string, any>,
  ): Promise<void> {
    if (!this.historyService) return;

    const sensorValues: Array<{ sensorType: SensorType; value: number }> = [];
    const isEnergyDevice = deviceType === 'energy';
    const isSwitchDevice = deviceType === 'switch';

    // Enregistrer la température si elle a changé
    if (newState.temperature !== undefined && typeof newState.temperature === 'number') {
      if (oldState.temperature === undefined || oldState.temperature !== newState.temperature) {
        sensorValues.push({ sensorType: SensorType.TEMPERATURE, value: newState.temperature });
      }
    }

    // Enregistrer l'humidité si elle a changé
    if (newState.humidity !== undefined && typeof newState.humidity === 'number') {
      if (oldState.humidity === undefined || oldState.humidity !== newState.humidity) {
        sensorValues.push({ sensorType: SensorType.HUMIDITY, value: newState.humidity });
      }
    }

    // Enregistrer la pression si elle a changé
    if (newState.pressure !== undefined && typeof newState.pressure === 'number') {
      if (oldState.pressure === undefined || oldState.pressure !== newState.pressure) {
        sensorValues.push({ sensorType: SensorType.PRESSURE, value: newState.pressure });
      }
    }

    // Enregistrer la luminosité si elle a changé
    if (newState.illuminance !== undefined && typeof newState.illuminance === 'number') {
      if (oldState.illuminance === undefined || oldState.illuminance !== newState.illuminance) {
        sensorValues.push({ sensorType: SensorType.ILLUMINANCE, value: newState.illuminance });
      }
    }

    // Enregistrer la batterie si elle a changé
    if (newState.battery !== undefined && typeof newState.battery === 'number') {
      if (oldState.battery === undefined || oldState.battery !== newState.battery) {
        sensorValues.push({ sensorType: SensorType.BATTERY, value: newState.battery });
      }
    }

    // Enregistrer la tension si elle a changé
    if (newState.voltage !== undefined && typeof newState.voltage === 'number') {
      if (oldState.voltage === undefined || oldState.voltage !== newState.voltage) {
        // Pour les appareils "energy" et "switch", historiser la valeur réelle (déjà en volts)
        // Pour les autres appareils, convertir mV en V
        const voltageValue = isEnergyDevice || isSwitchDevice 
          ? newState.voltage 
          : newState.voltage / 1000;
        sensorValues.push({ sensorType: SensorType.VOLTAGE, value: voltageValue });
      }
    }

    // Enregistrer la puissance si elle a changé (uniquement pour les appareils "energy")
    if (isEnergyDevice && newState.power !== undefined && typeof newState.power === 'number') {
      if (oldState.power === undefined || oldState.power !== newState.power) {
        sensorValues.push({ sensorType: SensorType.POWER, value: newState.power });
      }
    }

    // Enregistrer l'intensité si elle a changé (uniquement pour les appareils "energy")
    if (isEnergyDevice && newState.current !== undefined && typeof newState.current === 'number') {
      if (oldState.current === undefined || oldState.current !== newState.current) {
        sensorValues.push({ sensorType: SensorType.CURRENT, value: newState.current });
      }
    }

    // Enregistrer la qualité de lien si elle a changé
    if (newState.linkquality !== undefined && typeof newState.linkquality === 'number') {
      if (oldState.linkquality === undefined || oldState.linkquality !== newState.linkquality) {
        sensorValues.push({ sensorType: SensorType.LINKQUALITY, value: newState.linkquality });
      }
    }

    // Enregistrer toutes les valeurs en une seule transaction
    if (sensorValues.length > 0) {
      await this.historyService.logSensorValues(deviceId, sensorValues);
    }
  }

  private async logSignificantEvents(
    device: Device,
    oldState: Record<string, any>,
    newState: Record<string, any>,
  ): Promise<void> {
    if (!this.historyTimelineService) return;
    
    // Ne pas enregistrer les événements pour les appareils de type "energy"
    if (device.type === DeviceType.ENERGY) return;

    // Détection de mouvement
    if (
      newState.presence === true ||
      newState.occupancy === true ||
      (newState.motion !== undefined && newState.motion === true)
    ) {
      const hadMotion = oldState.presence === true || oldState.occupancy === true || oldState.motion === true;
      if (!hadMotion) {
        await this.historyTimelineService.logMotionDetected(
          device.ieeeAddress,
          device.friendlyName || device.ieeeAddress,
          device.room,
          { presence: newState.presence, occupancy: newState.occupancy, motion: newState.motion },
        );
      }
    }

    // Changement de contact (porte/fenêtre)
    if (newState.contact !== undefined && oldState.contact !== newState.contact) {
        await this.historyTimelineService.logContactChanged(
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
        await this.historyTimelineService.logTemperatureChanged(
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

    // Détecter les changements de capteurs (humidity, pressure, illuminance, battery, voltage)
    const sensorChanged =
      (oldState.humidity !== newState.humidity && newState.humidity !== undefined) ||
      (oldState.pressure !== newState.pressure && newState.pressure !== undefined) ||
      (oldState.illuminance !== newState.illuminance && newState.illuminance !== undefined) ||
      (oldState.battery !== newState.battery && newState.battery !== undefined) ||
      (oldState.voltage !== newState.voltage && newState.voltage !== undefined);

    // Enregistrer un STATE_CHANGED si l'état ou un capteur a changé
    if (stateChanged || sensorChanged) {
        await this.historyTimelineService.logStateChanged(
        device.ieeeAddress,
        device.friendlyName || device.ieeeAddress,
        oldState,
        newState,
        device.room,
      );
    }
  }
}

