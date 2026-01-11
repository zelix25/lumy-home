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

  async updateFriendlyName(
    ieeeAddress: string,
    friendlyName: string,
  ): Promise<Device> {
    const device = await this.findOne(ieeeAddress);
    const oldFriendlyName = device.friendlyName;
    const oldMqttName = device.mqttName;

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

    // IMPORTANT: Zigbee2MQTT utilise le friendly_name normalisé dans les topics MQTT
    // Pour la requête de renommage, le champ "from" doit être le nom normalisé actuellement
    // utilisé par Zigbee2MQTT dans ses topics (pas le friendly_name original)
    // Le champ "to" sera le nouveau mqttName normalisé
    
    // Si l'appareil a déjà été renommé, meta.originalZigbeeName contient le mqttName précédent
    // Sinon, Zigbee2MQTT utilise le friendly_name original qu'il a reçu, normalisé pour les topics
    let currentZigbeeMqttName = device.meta?.originalZigbeeName;
    
    // Si pas de nom stocké, c'est la première fois qu'on renomme cet appareil
    // Zigbee2MQTT utilise le friendly_name original, normalisé pour les topics
    if (!currentZigbeeMqttName) {
      // Utiliser le mqttName actuel s'il existe, sinon générer à partir du friendlyName
      // car Zigbee2MQTT normalise automatiquement le friendly_name pour créer les topics
      currentZigbeeMqttName = oldMqttName || this.generateMqttName(oldFriendlyName);
    }

    device.friendlyName = friendlyName;
    const newMqttName = this.generateMqttName(friendlyName);
    device.mqttName = newMqttName;
    
    // Mettre à jour le nom original Zigbee2MQTT dans les métadonnées
    if (!device.meta) {
      device.meta = {};
    }
    
    await this.deviceRepository.save(device);

    // Renommer dans Zigbee2MQTT via le bridge
    // Le champ "from" doit être le nom normalisé actuellement utilisé par Zigbee2MQTT dans ses topics
    // Le champ "to" sera le nouveau mqttName normalisé
    // Zigbee2MQTT utilisera ce nouveau mqttName comme friendly_name et pour générer les topics
    this.logger.log(
      `🔄 Tentative de renommage: de "${currentZigbeeMqttName}" vers "${newMqttName}"`,
      'DevicesService',
    );
    this.zigbee2MqttService.renameDevice(currentZigbeeMqttName, newMqttName);
    
    // Mettre à jour le nom stocké après le renommage
    // Après le renommage réussi, Zigbee2MQTT utilisera le nouveau mqttName
    device.meta.originalZigbeeName = newMqttName;
    await this.deviceRepository.save(device);

    return device;
  }

  async updateRoom(ieeeAddress: string, room?: string): Promise<Device> {
    const device = await this.findOne(ieeeAddress);

    device.room = room || 'Non défini';
    await this.deviceRepository.save(device);

    return device;
  }

  /**
   * Valide et normalise les valeurs de commande avant envoi
   * @param command - Commande à valider
   * @returns Commande validée et normalisée
   */
  private validateAndNormalizeCommand(command: Record<string, any>): Record<string, any> {
    const validatedCommand = { ...command };

    // Validation des consignes de chauffage (5-35°C)
    if (validatedCommand.occupied_heating_setpoint !== undefined) {
      const value = typeof validatedCommand.occupied_heating_setpoint === 'number'
        ? validatedCommand.occupied_heating_setpoint
        : parseFloat(validatedCommand.occupied_heating_setpoint);
      
      if (isNaN(value)) {
        throw new Error('La valeur de occupied_heating_setpoint doit être un nombre');
      }
      
      validatedCommand.occupied_heating_setpoint = Math.max(5, Math.min(35, value));
      
      if (value !== validatedCommand.occupied_heating_setpoint) {
        this.logger.log(
          `⚠️ Valeur de consigne ajustée: ${value}°C → ${validatedCommand.occupied_heating_setpoint}°C (plage: 5-35°C)`,
          'DevicesService',
        );
      }
    }

    if (validatedCommand.current_heating_setpoint !== undefined) {
      const value = typeof validatedCommand.current_heating_setpoint === 'number'
        ? validatedCommand.current_heating_setpoint
        : parseFloat(validatedCommand.current_heating_setpoint);
      
      if (isNaN(value)) {
        throw new Error('La valeur de current_heating_setpoint doit être un nombre');
      }
      
      validatedCommand.current_heating_setpoint = Math.max(5, Math.min(35, value));
      
      if (value !== validatedCommand.current_heating_setpoint) {
        this.logger.log(
          `⚠️ Valeur de consigne ajustée: ${value}°C → ${validatedCommand.current_heating_setpoint}°C (plage: 5-35°C)`,
          'DevicesService',
        );
      }
    }

    // Validation de la position des volets (0-100)
    if (validatedCommand.position !== undefined) {
      const value = typeof validatedCommand.position === 'number'
        ? validatedCommand.position
        : parseFloat(validatedCommand.position);
      
      if (isNaN(value)) {
        throw new Error('La valeur de position doit être un nombre');
      }
      
      validatedCommand.position = Math.max(0, Math.min(100, value));
    }

    // Validation de la luminosité (0-254 pour Zigbee)
    if (validatedCommand.brightness !== undefined) {
      const value = typeof validatedCommand.brightness === 'number'
        ? validatedCommand.brightness
        : parseFloat(validatedCommand.brightness);
      
      if (isNaN(value)) {
        throw new Error('La valeur de brightness doit être un nombre');
      }
      
      validatedCommand.brightness = Math.max(0, Math.min(254, value));
    }

    return validatedCommand;
  }

  async sendCommand(
    ieeeAddress: string,
    command: Record<string, any>,
  ): Promise<void> {
    const device = await this.findOne(ieeeAddress);
    
    // Valider et normaliser la commande avant envoi
    const validatedCommand = this.validateAndNormalizeCommand(command);
    
    // Utiliser mqttName pour les topics MQTT, avec fallback sur friendlyName si mqttName n'existe pas
    const mqttName = device.mqttName || this.generateMqttName(device.friendlyName);
    
    // Envoyer la commande
    await this.zigbee2MqttService.sendCommand(mqttName, validatedCommand);
    
    // Pour les consignes de chauffage, forcer une lecture de l'état après un court délai
    // pour s'assurer que la mise à jour est bien appliquée et reflétée dans la base de données
    if (validatedCommand.occupied_heating_setpoint !== undefined || 
        validatedCommand.current_heating_setpoint !== undefined) {
      // Attendre un court délai pour laisser le temps à Zigbee2MQTT de traiter la commande
      setTimeout(async () => {
        try {
          await this.forceReadDeviceState(ieeeAddress);
          this.logger.log(
            `✅ Lecture forcée de l'état après changement de consigne pour ${device.friendlyName}`,
            'DevicesService',
          );
        } catch (error) {
          this.logger.error(
            `Erreur lors de la lecture forcée après changement de consigne: ${error.message}`,
            error.stack,
            'DevicesService',
          );
        }
      }, 500); // 500ms de délai
    }
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
    // Utiliser mqttName pour les topics MQTT, avec fallback sur friendlyName si mqttName n'existe pas
    const mqttName = device.mqttName || this.generateMqttName(device.friendlyName);
    await this.zigbee2MqttService.forceReadDeviceState(mqttName);
  }

  async forceReadAllDeviceStates(): Promise<void> {
    const devices = await this.findAll();
    for (const device of devices) {
      if (device.status === 'online') {
        // Utiliser mqttName pour les topics MQTT, avec fallback sur friendlyName si mqttName n'existe pas
        const mqttName = device.mqttName || this.generateMqttName(device.friendlyName);
        await this.zigbee2MqttService.forceReadDeviceState(mqttName);
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
      // Utiliser mqttName pour les topics MQTT, avec fallback sur friendlyName si mqttName n'existe pas
      const mqttName = device.mqttName || this.generateMqttName(device.friendlyName);
      await this.zigbee2MqttService.removeDevice(mqttName, device.ieeeAddress);
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

