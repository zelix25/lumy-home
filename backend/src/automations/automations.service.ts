import {
  Injectable,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Automation, AutomationTriggerType, AutomationActionType, AutomationStatus } from '../ai/entities/automation.entity';
import { AutomationExecutionLog } from './entities/automation-execution-log.entity';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';
import { Zigbee2MqttService } from '../devices/zigbee2mqtt.service';
import { DevicesService } from '../devices/devices.service';
import { LoggerService } from '../logger/logger.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';

@Injectable()
export class AutomationsService implements OnModuleInit {
  // Map pour stocker les timers d'extinction automatique (deviceId -> timeout)
  private turnOffTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    @InjectRepository(Automation)
    private automationRepository: Repository<Automation>,
    @InjectRepository(AutomationExecutionLog)
    private executionLogRepository: Repository<AutomationExecutionLog>,
    @Inject(forwardRef(() => Zigbee2MqttService))
    private readonly zigbee2MqttService: Zigbee2MqttService,
    @Inject(forwardRef(() => DevicesService))
    private readonly devicesService: DevicesService,
    private readonly logger: LoggerService,
    private readonly websocketGateway: WebsocketGateway,
  ) {}

  async onModuleInit() {
    // S'abonner aux événements Zigbee pour déclencher les automatisations
    this.subscribeToZigbeeEvents();
    this.logger.log('Module Automations initialisé', 'AutomationsService');
  }

  private subscribeToZigbeeEvents() {
    // Cette méthode sera appelée pour écouter les événements Zigbee
    // L'implémentation sera faite via l'écoute des messages MQTT dans Zigbee2MqttService
    this.logger.log('Abonnement aux événements Zigbee configuré', 'AutomationsService');
  }

  async findAll(): Promise<Automation[]> {
    return this.automationRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Automation> {
    const automation = await this.automationRepository.findOne({
      where: { id },
    });

    if (!automation) {
      throw new NotFoundException(`Automatisation avec l'ID ${id} non trouvée`);
    }

    return automation;
  }

  async create(createDto: CreateAutomationDto): Promise<Automation> {
    // Vérifier que les appareils existent
    if (createDto.trigger.deviceId) {
      try {
        await this.devicesService.findOne(createDto.trigger.deviceId);
      } catch (error) {
        throw new BadRequestException(`Appareil déclencheur ${createDto.trigger.deviceId} non trouvé`);
      }
    }

    for (const action of createDto.actions) {
      try {
        await this.devicesService.findOne(action.deviceId);
      } catch (error) {
        throw new BadRequestException(`Appareil cible ${action.deviceId} non trouvé`);
      }
    }

    const automation = this.automationRepository.create({
      ...createDto,
      status: AutomationStatus.ACTIVE,
      executionLog: [],
    });

    return this.automationRepository.save(automation);
  }

  async update(id: string, updateDto: UpdateAutomationDto): Promise<Automation> {
    const automation = await this.findOne(id);

    // Vérifier les appareils si modifiés
    if (updateDto.trigger?.deviceId) {
      try {
        await this.devicesService.findOne(updateDto.trigger.deviceId);
      } catch (error) {
        throw new BadRequestException(`Appareil déclencheur ${updateDto.trigger.deviceId} non trouvé`);
      }
    }

    if (updateDto.actions) {
      for (const action of updateDto.actions) {
        try {
          await this.devicesService.findOne(action.deviceId);
        } catch (error) {
          throw new BadRequestException(`Appareil cible ${action.deviceId} non trouvé`);
        }
      }
    }

    Object.assign(automation, updateDto);
    return this.automationRepository.save(automation);
  }

  async remove(id: string): Promise<void> {
    const automation = await this.findOne(id);
    await this.automationRepository.remove(automation);
  }

  async toggleStatus(id: string): Promise<Automation> {
    const automation = await this.findOne(id);
    automation.status =
      automation.status === AutomationStatus.ACTIVE
        ? AutomationStatus.INACTIVE
        : AutomationStatus.ACTIVE;
    return this.automationRepository.save(automation);
  }

  /**
   * Traite un événement Zigbee et exécute les automatisations correspondantes
   */
  async handleZigbeeEvent(deviceId: string, eventType: string, eventData: any): Promise<void> {
    this.logger.log(
      `[AUTOMATION HANDLER] 📥 Événement reçu - Type: ${eventType}, Appareil détecteur: ${deviceId}`,
      'AutomationsService',
    );

    // Trouver toutes les automatisations actives qui correspondent à cet événement
    const automations = await this.automationRepository.find({
      where: { status: AutomationStatus.ACTIVE },
    });

    this.logger.debug(
      `[AUTOMATION HANDLER] ${automations.length} automatisation(s) active(s) trouvée(s)`,
      'AutomationsService',
    );

    let triggeredCount = 0;
    for (const automation of automations) {
      const shouldTrigger = this.shouldTriggerAutomation(automation, deviceId, eventType, eventData);
      if (shouldTrigger) {
        triggeredCount++;
        this.logger.log(
          `[AUTOMATION HANDLER] ✅ Automatisation "${automation.name}" (ID: ${automation.id}) correspond au déclencheur - Type: ${automation.trigger.type}, Appareil déclencheur: ${automation.trigger.deviceId || 'tous'}`,
          'AutomationsService',
        );
        await this.executeAutomation(automation, eventData);
      } else {
        this.logger.debug(
          `[AUTOMATION HANDLER] ❌ Automatisation "${automation.name}" (ID: ${automation.id}) ne correspond pas - Type déclencheur: ${automation.trigger.type}, Appareil déclencheur: ${automation.trigger.deviceId || 'tous'}`,
          'AutomationsService',
        );
      }
    }

    if (triggeredCount === 0) {
      this.logger.debug(
        `[AUTOMATION HANDLER] Aucune automatisation déclenchée pour l'événement ${eventType} de l'appareil ${deviceId}`,
        'AutomationsService',
      );
    } else {
      this.logger.log(
        `[AUTOMATION HANDLER] ${triggeredCount} automatisation(s) déclenchée(s) pour l'événement ${eventType}`,
        'AutomationsService',
      );
    }
  }

  /**
   * Vérifie si une automatisation doit être déclenchée
   */
  private shouldTriggerAutomation(
    automation: Automation,
    deviceId: string,
    eventType: string,
    eventData: any,
  ): boolean {
    const trigger = automation.trigger;

    this.logger.debug(
      `[AUTOMATION CHECK] 🔍 Vérification de l'automatisation "${automation.name}" (ID: ${automation.id}) - Type déclencheur: ${trigger.type}, Appareil déclencheur requis: ${trigger.deviceId || 'tous'}, Appareil détecteur: ${deviceId}, Type événement: ${eventType}`,
      'AutomationsService',
    );

    // Vérifier que l'appareil correspond
    if (trigger.deviceId && trigger.deviceId !== deviceId) {
      this.logger.debug(
        `[AUTOMATION CHECK] ❌ L'appareil ne correspond pas - Requis: ${trigger.deviceId}, Reçu: ${deviceId}`,
        'AutomationsService',
      );
      return false;
    }

    this.logger.debug(
      `[AUTOMATION CHECK] ✅ L'appareil correspond (${trigger.deviceId ? trigger.deviceId : 'tous les appareils'})`,
      'AutomationsService',
    );

    // Vérifier le type d'événement
    let shouldTrigger = false;
    switch (trigger.type) {
      case AutomationTriggerType.MOTION:
        shouldTrigger = eventType === 'motion' || (eventData.occupancy === true || eventData.occupancy === 'true');
        this.logger.debug(
          `[AUTOMATION CHECK] Type MOUVEMENT - eventType: ${eventType}, occupancy: ${eventData.occupancy}, Résultat: ${shouldTrigger}`,
          'AutomationsService',
        );
        return shouldTrigger;

      case AutomationTriggerType.CONTACT:
        shouldTrigger = eventType === 'contact' || eventData.contact !== undefined;
        this.logger.debug(
          `[AUTOMATION CHECK] Type CONTACT - eventType: ${eventType}, contact: ${eventData.contact}, Résultat: ${shouldTrigger}`,
          'AutomationsService',
        );
        return shouldTrigger;

      case AutomationTriggerType.TEMPERATURE:
        if (eventType !== 'temperature' && !eventData.temperature) {
          this.logger.debug(
            `[AUTOMATION CHECK] Type TEMPÉRATURE - Pas de température dans l'événement, Résultat: false`,
            'AutomationsService',
          );
          return false;
        }
        // Vérifier les conditions de température si définies
        if (trigger.condition?.operator && trigger.condition?.value) {
          const temp = eventData.temperature;
          const value = trigger.condition.value;
          const operator = trigger.condition.operator;
          let conditionMet = false;
          switch (operator) {
            case '>':
              conditionMet = temp > value;
              break;
            case '<':
              conditionMet = temp < value;
              break;
            case '>=':
              conditionMet = temp >= value;
              break;
            case '<=':
              conditionMet = temp <= value;
              break;
            case '==':
              conditionMet = temp === value;
              break;
          }
          this.logger.debug(
            `[AUTOMATION CHECK] Type TEMPÉRATURE - Condition: ${temp} ${operator} ${value}, Résultat: ${conditionMet}`,
            'AutomationsService',
          );
          return conditionMet;
        }
        this.logger.debug(
          `[AUTOMATION CHECK] Type TEMPÉRATURE - Pas de condition spécifique, Résultat: true`,
          'AutomationsService',
        );
        return true;

      case AutomationTriggerType.BUTTON:
        // Les boutons peuvent utiliser action, click, button_l, button_r, etc.
        const hasButtonEvent =
          eventType === 'button' ||
          eventData.action !== undefined ||
          eventData.click !== undefined ||
          eventData.button_l !== undefined ||
          eventData.button_r !== undefined ||
          eventData.button_1 !== undefined ||
          eventData.button_2 !== undefined ||
          eventData.button_3 !== undefined ||
          eventData.button_4 !== undefined;
        shouldTrigger = hasButtonEvent;
        this.logger.debug(
          `[AUTOMATION CHECK] Type BOUTON - eventType: ${eventType}, action: ${eventData.action}, click: ${eventData.click}, button_l: ${eventData.button_l}, button_r: ${eventData.button_r}, button_1: ${eventData.button_1}, button_2: ${eventData.button_2}, Résultat: ${shouldTrigger}`,
          'AutomationsService',
        );
        return shouldTrigger;

      default:
        this.logger.debug(
          `[AUTOMATION CHECK] ❌ Type de déclencheur non supporté: ${trigger.type}`,
          'AutomationsService',
        );
        return false;
    }
  }

  /**
   * Exécute une automatisation
   */
  private async executeAutomation(automation: Automation, triggerData: any): Promise<void> {
    this.logger.log(
      `[AUTOMATION EXECUTE] 🚀 Début de l'exécution de l'automatisation "${automation.name}" (ID: ${automation.id})`,
      'AutomationsService',
    );
    this.logger.log(
      `[AUTOMATION EXECUTE] 📋 Déclencheur: ${automation.trigger.type}, Appareil détecteur: ${automation.trigger.deviceId || 'tous'}, Nombre d'actions: ${automation.actions.length}`,
      'AutomationsService',
    );

    const log = this.executionLogRepository.create({
      automation,
      automationId: automation.id,
      success: false,
      triggerData,
      actionResults: [],
    });

    try {
      const actionResults = [];

      for (let i = 0; i < automation.actions.length; i++) {
        const action = automation.actions[i];
        this.logger.log(
          `[AUTOMATION EXECUTE] ⚙️ Action ${i + 1}/${automation.actions.length}: ${action.type} sur l'appareil ${action.deviceId} (${action.deviceName || 'nom non disponible'})`,
          'AutomationsService',
        );

        try {
          await this.executeAction(action, automation);
          this.logger.log(
            `[AUTOMATION EXECUTE] ✅ Action ${i + 1} réussie: ${action.type} sur ${action.deviceId}`,
            'AutomationsService',
          );
          actionResults.push({
            actionType: action.type,
            deviceId: action.deviceId,
            success: true,
          });
        } catch (error) {
          this.logger.error(
            `[AUTOMATION EXECUTE] ❌ Erreur lors de l'exécution de l'action ${i + 1} (${action.type}) sur ${action.deviceId}: ${error.message}`,
            error.stack,
            'AutomationsService',
          );
          actionResults.push({
            actionType: action.type,
            deviceId: action.deviceId,
            success: false,
            message: error.message,
          });
        }
      }

      log.success = actionResults.every((r) => r.success);
      log.message = log.success
        ? `Automatisation exécutée avec succès`
        : `Certaines actions ont échoué`;
      log.actionResults = actionResults;

      const successCount = actionResults.filter((r) => r.success).length;
      const failCount = actionResults.filter((r) => !r.success).length;

      this.logger.log(
        `[AUTOMATION EXECUTE] 📊 Résultat: ${successCount} action(s) réussie(s), ${failCount} action(s) échouée(s) sur ${automation.actions.length} action(s) totale(s)`,
        'AutomationsService',
      );

      // Mettre à jour le log d'exécution dans l'automation
      const executionLog = automation.executionLog || [];
      executionLog.push({
        timestamp: new Date(),
        success: log.success,
        message: log.message,
      });
      // Garder seulement les 50 derniers logs
      automation.executionLog = executionLog.slice(-50);
      await this.automationRepository.save(automation);

      // Notifier via WebSocket
      this.websocketGateway.broadcast('automation_executed', {
        automationId: automation.id,
        automationName: automation.name,
        success: log.success,
        timestamp: new Date(),
      });

      this.logger.log(
        `[AUTOMATION EXECUTE] ✅ Automatisation "${automation.name}" terminée: ${log.message}`,
        'AutomationsService',
      );
    } catch (error) {
      log.success = false;
      log.message = `Erreur lors de l'exécution: ${error.message}`;
      this.logger.error(
        `Erreur lors de l'exécution de l'automatisation ${automation.id}: ${error.message}`,
        error.stack,
        'AutomationsService',
      );
    } finally {
      await this.executionLogRepository.save(log);
    }
  }

  /**
   * Exécute une action sur un appareil
   */
  private async executeAction(action: any, automation: Automation): Promise<void> {
    const { type, deviceId, params } = action;

    this.logger.log(
      `[AUTOMATION ACTION] 🎯 Exécution de l'action "${type}" sur l'appareil ${deviceId} (${action.deviceName || 'nom non disponible'})`,
      'AutomationsService',
    );

    try {
      switch (type) {
        case AutomationActionType.TURN_ON:
          // Récupérer l'appareil pour obtenir son friendlyName
          const turnOnDevice = await this.devicesService.findOne(deviceId);
          const duration = params?.duration || 0; // 0 = infini
          
          this.logger.log(
            `[AUTOMATION ACTION] 💡 Commande: Allumer l'appareil ${turnOnDevice.friendlyName} (${deviceId})${duration > 0 ? ` pendant ${duration} secondes` : ' (infini)'}`,
            'AutomationsService',
          );
          
          // Annuler le timer précédent s'il existe (pour éviter les conflits)
          const existingTimer = this.turnOffTimers.get(deviceId);
          if (existingTimer) {
            clearTimeout(existingTimer);
            this.turnOffTimers.delete(deviceId);
            this.logger.debug(
              `[AUTOMATION ACTION] ⏱️ Timer précédent annulé pour l'appareil ${deviceId}`,
              'AutomationsService',
            );
          }
          
          // Allumer l'appareil
          await this.zigbee2MqttService.sendCommand(turnOnDevice.friendlyName, { state: 'ON' });
          this.logger.log(
            `[AUTOMATION ACTION] ✅ Commande "ON" envoyée avec succès à l'appareil ${turnOnDevice.friendlyName} (${deviceId})`,
            'AutomationsService',
          );
          
          // Si duration >= 1 seconde, programmer l'extinction automatique
          if (duration >= 1) {
            // Stocker le friendlyName dans une variable locale pour le callback
            const deviceFriendlyName = turnOnDevice.friendlyName;
            const timer = setTimeout(async () => {
              try {
                // Récupérer l'appareil à nouveau pour s'assurer qu'on a les bonnes informations
                const deviceForTurnOff = await this.devicesService.findOne(deviceId);
                this.logger.log(
                  `[AUTOMATION ACTION] ⏰ Extinction automatique après ${duration} secondes pour l'appareil ${deviceForTurnOff.friendlyName} (${deviceId})`,
                  'AutomationsService',
                );
                await this.zigbee2MqttService.sendCommand(deviceForTurnOff.friendlyName, { state: 'OFF' });
                this.logger.log(
                  `[AUTOMATION ACTION] ✅ Commande "OFF" (extinction automatique) envoyée avec succès à l'appareil ${deviceForTurnOff.friendlyName} (${deviceId})`,
                  'AutomationsService',
                );
                this.turnOffTimers.delete(deviceId);
              } catch (error) {
                this.logger.error(
                  `Erreur lors de l'extinction automatique de l'appareil ${deviceId}: ${error.message}`,
                  error.stack,
                  'AutomationsService',
                );
                this.turnOffTimers.delete(deviceId);
              }
            }, duration * 1000);
            
            this.turnOffTimers.set(deviceId, timer);
            this.logger.log(
              `[AUTOMATION ACTION] ⏱️ Timer d'extinction programmé pour ${duration} secondes (${duration * 1000}ms) pour l'appareil ${turnOnDevice.friendlyName} (${deviceId})`,
              'AutomationsService',
            );
          } else {
            this.logger.log(
              `[AUTOMATION ACTION] ♾️ Aucun timer d'extinction (duration = 0 = infini) pour l'appareil ${turnOnDevice.friendlyName} (${deviceId})`,
              'AutomationsService',
            );
          }
          break;

        case AutomationActionType.TURN_OFF:
          this.logger.log(
            `[AUTOMATION ACTION] 🔌 Commande: Éteindre l'appareil ${deviceId}`,
            'AutomationsService',
          );
          await this.zigbee2MqttService.sendCommand(deviceId, { state: 'OFF' });
          this.logger.log(
            `[AUTOMATION ACTION] ✅ Commande "OFF" envoyée avec succès à l'appareil ${deviceId}`,
            'AutomationsService',
          );
          break;

        case AutomationActionType.TOGGLE:
          // Récupérer l'état actuel de l'appareil
          const device = await this.devicesService.findOne(deviceId);
          const currentState = device.state?.state;
          const newState = currentState === 'ON' ? 'OFF' : 'ON';
          
          this.logger.log(
            `[AUTOMATION ACTION] 🔄 Commande: Basculer l'appareil ${device.friendlyName} (${deviceId}) - État actuel: ${currentState || 'inconnu'} → ${newState}`,
            'AutomationsService',
          );
          await this.zigbee2MqttService.sendCommand(device.friendlyName, { state: newState });
          this.logger.log(
            `[AUTOMATION ACTION] ✅ Commande "TOGGLE" (${newState}) envoyée avec succès à l'appareil ${device.friendlyName} (${deviceId})`,
            'AutomationsService',
          );
          break;

        case AutomationActionType.SET_BRIGHTNESS:
          if (!params?.brightness) {
            throw new BadRequestException('Le paramètre brightness est requis');
          }
          this.logger.log(
            `[AUTOMATION ACTION] 🌟 Commande: Régler la luminosité de l'appareil ${deviceId} à ${params.brightness}%`,
            'AutomationsService',
          );
          await this.zigbee2MqttService.sendCommand(deviceId, {
            state: 'ON',
            brightness: params.brightness,
          });
          this.logger.log(
            `[AUTOMATION ACTION] ✅ Commande de luminosité (${params.brightness}%) envoyée avec succès à l'appareil ${deviceId}`,
            'AutomationsService',
          );
          break;

        case AutomationActionType.SET_COLOR:
          if (!params?.color) {
            throw new BadRequestException('Le paramètre color est requis');
          }
          this.logger.log(
            `[AUTOMATION ACTION] 🎨 Commande: Changer la couleur de l'appareil ${deviceId} en ${params.color}`,
            'AutomationsService',
          );
          await this.zigbee2MqttService.sendCommand(deviceId, {
            state: 'ON',
            color: params.color,
          });
          this.logger.log(
            `[AUTOMATION ACTION] ✅ Commande de couleur (${params.color}) envoyée avec succès à l'appareil ${deviceId}`,
            'AutomationsService',
          );
          break;

        case AutomationActionType.NOTIFY:
          // Pour l'instant, on log juste la notification
          // Plus tard, on pourra intégrer un système de notifications
          this.logger.log(
            `[AUTOMATION ACTION] 📢 Notification: ${params?.message || 'Aucun message'} pour l'automatisation "${automation.name}"`,
            'AutomationsService',
          );
          // Notifier via WebSocket
          this.websocketGateway.broadcast('notification', {
            message: params?.message || `Automatisation "${automation.name}" déclenchée`,
            automationId: automation.id,
            automationName: automation.name,
          });
          this.logger.log(
            `[AUTOMATION ACTION] ✅ Notification envoyée avec succès`,
            'AutomationsService',
          );
          break;

        default:
          throw new BadRequestException(`Type d'action non supporté: ${type}`);
      }
    } catch (error) {
      this.logger.error(
        `[AUTOMATION ACTION] ❌ Erreur lors de l'exécution de l'action ${type} sur ${deviceId}: ${error.message}`,
        error.stack,
        'AutomationsService',
      );
      throw error;
    }
  }

  /**
   * Récupère les logs d'exécution d'une automatisation
   */
  async getExecutionLogs(automationId: string, limit: number = 50): Promise<AutomationExecutionLog[]> {
    return this.executionLogRepository.find({
      where: { automationId },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }
}

