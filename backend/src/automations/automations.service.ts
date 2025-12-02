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
    // Trouver toutes les automatisations actives qui correspondent à cet événement
    const automations = await this.automationRepository.find({
      where: { status: AutomationStatus.ACTIVE },
    });

    for (const automation of automations) {
      if (this.shouldTriggerAutomation(automation, deviceId, eventType, eventData)) {
        await this.executeAutomation(automation, eventData);
      }
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

    // Vérifier que l'appareil correspond
    if (trigger.deviceId && trigger.deviceId !== deviceId) {
      return false;
    }

    // Vérifier le type d'événement
    switch (trigger.type) {
      case AutomationTriggerType.MOTION:
        return eventType === 'motion' || (eventData.occupancy === true || eventData.occupancy === 'true');

      case AutomationTriggerType.CONTACT:
        return eventType === 'contact' || eventData.contact !== undefined;

      case AutomationTriggerType.TEMPERATURE:
        if (eventType !== 'temperature' && !eventData.temperature) {
          return false;
        }
        // Vérifier les conditions de température si définies
        if (trigger.condition?.operator && trigger.condition?.value) {
          const temp = eventData.temperature;
          const value = trigger.condition.value;
          switch (trigger.condition.operator) {
            case '>':
              return temp > value;
            case '<':
              return temp < value;
            case '>=':
              return temp >= value;
            case '<=':
              return temp <= value;
            case '==':
              return temp === value;
          }
        }
        return true;

      case AutomationTriggerType.BUTTON:
        return eventType === 'button' || eventData.action !== undefined;

      default:
        return false;
    }
  }

  /**
   * Exécute une automatisation
   */
  private async executeAutomation(automation: Automation, triggerData: any): Promise<void> {
    const log = this.executionLogRepository.create({
      automation,
      automationId: automation.id,
      success: false,
      triggerData,
      actionResults: [],
    });

    try {
      const actionResults = [];

      for (const action of automation.actions) {
        try {
          await this.executeAction(action, automation);
          actionResults.push({
            actionType: action.type,
            deviceId: action.deviceId,
            success: true,
          });
        } catch (error) {
          this.logger.error(
            `Erreur lors de l'exécution de l'action ${action.type} sur ${action.deviceId}: ${error.message}`,
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
        `Automatisation "${automation.name}" exécutée: ${log.message}`,
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

    switch (type) {
      case AutomationActionType.TURN_ON:
        await this.zigbee2MqttService.sendCommand(deviceId, { state: 'ON' });
        break;

      case AutomationActionType.TURN_OFF:
        await this.zigbee2MqttService.sendCommand(deviceId, { state: 'OFF' });
        break;

      case AutomationActionType.SET_BRIGHTNESS:
        if (!params?.brightness) {
          throw new BadRequestException('Le paramètre brightness est requis');
        }
        await this.zigbee2MqttService.sendCommand(deviceId, {
          state: 'ON',
          brightness: params.brightness,
        });
        break;

      case AutomationActionType.SET_COLOR:
        if (!params?.color) {
          throw new BadRequestException('Le paramètre color est requis');
        }
        await this.zigbee2MqttService.sendCommand(deviceId, {
          state: 'ON',
          color: params.color,
        });
        break;

      case AutomationActionType.NOTIFY:
        // Pour l'instant, on log juste la notification
        // Plus tard, on pourra intégrer un système de notifications
        this.logger.log(
          `Notification: ${params?.message || 'Aucun message'} pour l'automatisation "${automation.name}"`,
          'AutomationsService',
        );
        // Notifier via WebSocket
        this.websocketGateway.broadcast('notification', {
          message: params?.message || `Automatisation "${automation.name}" déclenchée`,
          automationId: automation.id,
          automationName: automation.name,
        });
        break;

      default:
        throw new BadRequestException(`Type d'action non supporté: ${type}`);
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

