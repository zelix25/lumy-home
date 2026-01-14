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
import { Cron, CronExpression } from '@nestjs/schedule';
import { Automation, AutomationTriggerType, AutomationActionType, AutomationStatus } from '../ai/entities/automation.entity';
import { AutomationExecutionLog } from './entities/automation-execution-log.entity';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';
import { Zigbee2MqttService } from '../devices/zigbee2mqtt.service';
import { DevicesService } from '../devices/devices.service';
import { LoggerService } from '../logger/logger.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { WeatherService } from '../weather/weather.service';

@Injectable()
export class AutomationsService implements OnModuleInit {
  // Map pour stocker les timers d'extinction automatique (deviceId -> timeout)
  private turnOffTimers: Map<string, NodeJS.Timeout> = new Map();
  // Suivi des événements sunrise/sunset déjà déclenchés aujourd'hui
  private lastSunriseDate: string | null = null;
  private lastSunsetDate: string | null = null;
  // Suivi des automations TIME déjà déclenchées aujourd'hui (automationId -> date)
  private lastTimeTriggerDates: Map<string, string> = new Map();

  constructor(
    @InjectRepository(Automation)
    private automationRepository: Repository<Automation>,
    @InjectRepository(AutomationExecutionLog)
    private executionLogRepository: Repository<AutomationExecutionLog>,
    @Inject(forwardRef(() => Zigbee2MqttService))
    private readonly zigbee2MqttService: Zigbee2MqttService,
    @Inject(forwardRef(() => DevicesService))
    private readonly devicesService: DevicesService,
    @Inject(forwardRef(() => WeatherService))
    private readonly weatherService: WeatherService,
    private readonly logger: LoggerService,
    private readonly websocketGateway: WebsocketGateway,
  ) {}

  async onModuleInit() {
    // S'abonner aux événements Zigbee pour déclencher les automatisations
    this.subscribeToZigbeeEvents();
    this.logger.log('Module Automations initialisé', 'AutomationsService');
  }

  /**
   * Vérifie toutes les minutes si l'heure actuelle correspond à sunrise/sunset
   * et déclenche les événements correspondants
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkSunriseSunset() {
    try {
      // Récupérer les données météo d'aujourd'hui
      const todayWeather = await this.weatherService.getTodayWeather();
      
      if (!todayWeather || !todayWeather.sunrise || !todayWeather.sunset) {
        return; // Pas de données météo disponibles
      }

      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      // Réinitialiser les dates si on est un nouveau jour
      if (this.lastSunriseDate && this.lastSunriseDate !== todayStr) {
        this.lastSunriseDate = null;
      }
      if (this.lastSunsetDate && this.lastSunsetDate !== todayStr) {
        this.lastSunsetDate = null;
      }

      // Vérifier le lever du soleil
      if (todayWeather.sunrise) {
        // Le format est HH:mm:ss, extraire l'heure et les minutes
        const sunriseParts = todayWeather.sunrise.split(':');
        if (sunriseParts.length >= 2) {
          const sunriseHour = parseInt(sunriseParts[0], 10);
          const sunriseMinute = parseInt(sunriseParts[1], 10);
          
          // Vérifier si l'heure actuelle correspond à sunrise (à la minute près)
          if (
            !isNaN(sunriseHour) &&
            !isNaN(sunriseMinute) &&
            now.getHours() === sunriseHour &&
            now.getMinutes() === sunriseMinute &&
            this.lastSunriseDate !== todayStr
          ) {
            this.logger.log(
              `🌅 Lever du soleil détecté à ${todayWeather.sunrise} - Déclenchement des automatisations`,
              'AutomationsService',
            );
            this.lastSunriseDate = todayStr;
            await this.handleZigbeeEvent('weather', 'sunrise', { sunrise: true });
          }
        }
      }

      // Vérifier le coucher du soleil
      if (todayWeather.sunset) {
        // Le format est HH:mm:ss, extraire l'heure et les minutes
        const sunsetParts = todayWeather.sunset.split(':');
        if (sunsetParts.length >= 2) {
          const sunsetHour = parseInt(sunsetParts[0], 10);
          const sunsetMinute = parseInt(sunsetParts[1], 10);
          
          // Vérifier si l'heure actuelle correspond à sunset (à la minute près)
          if (
            !isNaN(sunsetHour) &&
            !isNaN(sunsetMinute) &&
            now.getHours() === sunsetHour &&
            now.getMinutes() === sunsetMinute &&
            this.lastSunsetDate !== todayStr
          ) {
            this.logger.log(
              `🌇 Coucher du soleil détecté à ${todayWeather.sunset} - Déclenchement des automatisations`,
              'AutomationsService',
            );
            this.lastSunsetDate = todayStr;
            await this.handleZigbeeEvent('weather', 'sunset', { sunset: true });
          }
        }
      }
    } catch (error) {
      this.logger.error(
        `Erreur lors de la vérification sunrise/sunset: ${error.message}`,
        error.stack,
        'AutomationsService',
      );
    }
  }

  /**
   * Vérifie toutes les minutes si l'heure actuelle correspond à une automation avec trigger TIME
   * et déclenche les événements correspondants
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkTimeTriggers() {
    try {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      // Récupérer toutes les automations actives avec trigger TIME
      const timeAutomations = await this.automationRepository.find({
        where: {
          status: AutomationStatus.ACTIVE,
        },
      });

      for (const automation of timeAutomations) {
        if (automation.trigger.type !== AutomationTriggerType.TIME) {
          continue;
        }

        const triggerTime = automation.trigger.time;
        if (!triggerTime) {
          continue;
        }

        // Parser l'heure (format HH:MM)
        const timeParts = triggerTime.split(':');
        if (timeParts.length !== 2) {
          this.logger.warn(
            `Format d'heure invalide pour l'automation ${automation.id}: ${triggerTime}`,
            'AutomationsService',
          );
          continue;
        }

        const triggerHour = parseInt(timeParts[0], 10);
        const triggerMinute = parseInt(timeParts[1], 10);

        if (isNaN(triggerHour) || isNaN(triggerMinute)) {
          this.logger.warn(
            `Heure invalide pour l'automation ${automation.id}: ${triggerTime}`,
            'AutomationsService',
          );
          continue;
        }

        // Vérifier si l'heure actuelle correspond à l'heure du trigger
        const lastTriggerDate = this.lastTimeTriggerDates.get(automation.id);
        if (
          currentHour === triggerHour &&
          currentMinute === triggerMinute &&
          lastTriggerDate !== todayStr
        ) {
          this.logger.log(
            `⏰ Déclenchement de l'automation "${automation.name}" à ${triggerTime}`,
            'AutomationsService',
          );
          this.lastTimeTriggerDates.set(automation.id, todayStr);
          await this.handleZigbeeEvent('time', 'time_trigger', {
            automationId: automation.id,
            time: triggerTime,
          });
        }
      }

      // Nettoyer les dates obsolètes (automations supprimées ou modifiées)
      const activeTimeAutomationIds = timeAutomations
        .filter((a) => a.trigger.type === AutomationTriggerType.TIME)
        .map((a) => a.id);
      for (const [automationId] of this.lastTimeTriggerDates.entries()) {
        if (!activeTimeAutomationIds.includes(automationId)) {
          this.lastTimeTriggerDates.delete(automationId);
        }
      }
    } catch (error) {
      this.logger.error(
        `Erreur lors de la vérification des triggers TIME: ${error.message}`,
        error.stack,
        'AutomationsService',
      );
    }
  }

  private subscribeToZigbeeEvents() {
    // Cette méthode sera appelée pour écouter les événements Zigbee
    // L'implémentation sera faite via l'écoute des messages MQTT dans Zigbee2MqttService
    this.logger.log('Abonnement aux événements Zigbee configuré', 'AutomationsService');
  }

  async findAll(): Promise<Automation[]> {
    const automations = await this.automationRepository.find({
      order: { createdAt: 'DESC' },
    });

    // Calculer le nombre total d'exécutions pour chaque automation
    for (const automation of automations) {
      const executionCount = await this.executionLogRepository.count({
        where: { automationId: automation.id },
      });
      // Ajouter executionCount comme propriété dynamique
      (automation as any).executionCount = executionCount;
    }

    return automations;
  }

  async findOne(id: string): Promise<Automation> {
    const automation = await this.automationRepository.findOne({
      where: { id },
    });

    if (!automation) {
      throw new NotFoundException(`Automatisation avec l'ID ${id} non trouvée`);
    }

    // Calculer le nombre total d'exécutions
    const executionCount = await this.executionLogRepository.count({
      where: { automationId: automation.id },
    });
    // Ajouter executionCount comme propriété dynamique
    (automation as any).executionCount = executionCount;

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
      const shouldTrigger = await this.shouldTriggerAutomation(automation, deviceId, eventType, eventData);
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
  private async shouldTriggerAutomation(
    automation: Automation,
    deviceId: string,
    eventType: string,
    eventData: any,
  ): Promise<boolean> {
    const trigger = automation.trigger;

    this.logger.debug(
      `[AUTOMATION CHECK] 🔍 Vérification de l'automatisation "${automation.name}" (ID: ${automation.id}) - Type déclencheur: ${trigger.type}, Appareil déclencheur requis: ${trigger.deviceId || 'tous'}, Appareil détecteur: ${deviceId}, Type événement: ${eventType}`,
      'AutomationsService',
    );

    // Vérifier si l'événement correspond au trigger principal
    const triggerDeviceMatches = !trigger.deviceId || trigger.deviceId === deviceId;
    
    // Vérifier le type d'événement principal
    let mainTriggerMet = false;
    
    // Si l'appareil correspond au trigger principal, vérifier le trigger
    if (triggerDeviceMatches) {
      this.logger.debug(
        `[AUTOMATION CHECK] ✅ L'appareil correspond au trigger principal (${trigger.deviceId ? trigger.deviceId : 'tous les appareils'})`,
        'AutomationsService',
      );
      
      switch (trigger.type) {
      case AutomationTriggerType.MOTION:
        mainTriggerMet = eventType === 'motion' || (eventData.occupancy === true || eventData.occupancy === 'true');
        this.logger.debug(
          `[AUTOMATION CHECK] Type MOUVEMENT - eventType: ${eventType}, occupancy: ${eventData.occupancy}, Résultat: ${mainTriggerMet}`,
          'AutomationsService',
        );
        break;

      case AutomationTriggerType.CONTACT:
        mainTriggerMet = eventType === 'contact' || eventData.contact !== undefined;
        this.logger.debug(
          `[AUTOMATION CHECK] Type CONTACT - eventType: ${eventType}, contact: ${eventData.contact}, Résultat: ${mainTriggerMet}`,
          'AutomationsService',
        );
        break;

      case AutomationTriggerType.TEMPERATURE:
        if (eventType !== 'temperature' && !eventData.temperature) {
          this.logger.debug(
            `[AUTOMATION CHECK] Type TEMPÉRATURE - Pas de température dans l'événement, Résultat: false`,
            'AutomationsService',
          );
          mainTriggerMet = false;
          break;
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
          mainTriggerMet = conditionMet;
        } else {
          mainTriggerMet = true;
          this.logger.debug(
            `[AUTOMATION CHECK] Type TEMPÉRATURE - Pas de condition spécifique, Résultat: true`,
            'AutomationsService',
          );
        }
        break;

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
        mainTriggerMet = hasButtonEvent;
        this.logger.debug(
          `[AUTOMATION CHECK] Type BOUTON - eventType: ${eventType}, action: ${eventData.action}, click: ${eventData.click}, button_l: ${eventData.button_l}, button_r: ${eventData.button_r}, button_1: ${eventData.button_1}, button_2: ${eventData.button_2}, Résultat: ${mainTriggerMet}`,
          'AutomationsService',
        );
        break;

      case AutomationTriggerType.VIBRATION:
        mainTriggerMet = eventType === 'vibration' || eventData.vibration !== undefined;
        this.logger.debug(
          `[AUTOMATION CHECK] Type VIBRATION - eventType: ${eventType}, vibration: ${eventData.vibration}, Résultat: ${mainTriggerMet}`,
          'AutomationsService',
        );
        break;

      case AutomationTriggerType.ILLUMINANCE:
        if (eventType !== 'illuminance' && !eventData.illuminance) {
          this.logger.debug(
            `[AUTOMATION CHECK] Type LUMINOSITÉ - Pas de luminosité dans l'événement, Résultat: false`,
            'AutomationsService',
          );
          mainTriggerMet = false;
          break;
        }
        // Vérifier les conditions de luminosité si définies
        if (trigger.condition?.operator && trigger.condition?.value) {
          const illuminance = eventData.illuminance;
          const value = trigger.condition.value;
          const operator = trigger.condition.operator;
          let conditionMet = false;
          switch (operator) {
            case '>':
              conditionMet = illuminance > value;
              break;
            case '<':
              conditionMet = illuminance < value;
              break;
            case '>=':
              conditionMet = illuminance >= value;
              break;
            case '<=':
              conditionMet = illuminance <= value;
              break;
            case '==':
              conditionMet = illuminance === value;
              break;
          }
          this.logger.debug(
            `[AUTOMATION CHECK] Type LUMINOSITÉ - Condition: ${illuminance} ${operator} ${value}, Résultat: ${conditionMet}`,
            'AutomationsService',
          );
          mainTriggerMet = conditionMet;
        } else {
          mainTriggerMet = true;
          this.logger.debug(
            `[AUTOMATION CHECK] Type LUMINOSITÉ - Pas de condition spécifique, Résultat: true`,
            'AutomationsService',
          );
        }
        break;

      case AutomationTriggerType.HUMIDITY:
        if (eventType !== 'humidity' && !eventData.humidity) {
          this.logger.debug(
            `[AUTOMATION CHECK] Type HUMIDITÉ - Pas d'humidité dans l'événement, Résultat: false`,
            'AutomationsService',
          );
          mainTriggerMet = false;
          break;
        }
        // Vérifier les conditions d'humidité si définies
        if (trigger.condition?.operator && trigger.condition?.value) {
          const humidity = eventData.humidity;
          const value = trigger.condition.value;
          const operator = trigger.condition.operator;
          let conditionMet = false;
          switch (operator) {
            case '>':
              conditionMet = humidity > value;
              break;
            case '<':
              conditionMet = humidity < value;
              break;
            case '>=':
              conditionMet = humidity >= value;
              break;
            case '<=':
              conditionMet = humidity <= value;
              break;
            case '==':
              conditionMet = humidity === value;
              break;
          }
          this.logger.debug(
            `[AUTOMATION CHECK] Type HUMIDITÉ - Condition: ${humidity} ${operator} ${value}, Résultat: ${conditionMet}`,
            'AutomationsService',
          );
          mainTriggerMet = conditionMet;
        } else {
          mainTriggerMet = true;
          this.logger.debug(
            `[AUTOMATION CHECK] Type HUMIDITÉ - Pas de condition spécifique, Résultat: true`,
            'AutomationsService',
          );
        }
        break;

      case AutomationTriggerType.WATER_LEAK:
        mainTriggerMet = eventType === 'water_leak' || eventData.water_leak !== undefined || eventData.water === true;
        this.logger.debug(
          `[AUTOMATION CHECK] Type FUITE D'EAU - eventType: ${eventType}, water_leak: ${eventData.water_leak}, water: ${eventData.water}, Résultat: ${mainTriggerMet}`,
          'AutomationsService',
        );
        break;

      case AutomationTriggerType.SMOKE:
        mainTriggerMet = eventType === 'smoke' || eventData.smoke !== undefined || eventData.smoke_detected === true;
        this.logger.debug(
          `[AUTOMATION CHECK] Type FUMÉE - eventType: ${eventType}, smoke: ${eventData.smoke}, smoke_detected: ${eventData.smoke_detected}, Résultat: ${mainTriggerMet}`,
          'AutomationsService',
        );
        break;

      case AutomationTriggerType.GAS:
        mainTriggerMet = eventType === 'gas' || eventData.gas !== undefined || eventData.gas_detected === true;
        this.logger.debug(
          `[AUTOMATION CHECK] Type GAZ - eventType: ${eventType}, gas: ${eventData.gas}, gas_detected: ${eventData.gas_detected}, Résultat: ${mainTriggerMet}`,
          'AutomationsService',
        );
        break;

      case AutomationTriggerType.SUNRISE_SUNSET:
        // Vérifier le type spécifique (lever ou coucher) si défini
        const sunriseSunsetType = trigger.sunriseSunsetType;
        if (sunriseSunsetType) {
          // Vérifier que l'événement correspond au type spécifié
          if (sunriseSunsetType === 'sunrise') {
            mainTriggerMet = eventType === 'sunrise' || eventData.sunrise === true;
          } else if (sunriseSunsetType === 'sunset') {
            mainTriggerMet = eventType === 'sunset' || eventData.sunset === true;
          }
        } else {
          // Si aucun type spécifique, accepter les deux (comportement par défaut)
          mainTriggerMet = eventType === 'sunrise' || eventType === 'sunset' || eventData.sunrise || eventData.sunset;
        }
        this.logger.debug(
          `[AUTOMATION CHECK] Type LEVER/COUCHER DU SOLEIL - eventType: ${eventType}, sunriseSunsetType: ${sunriseSunsetType || 'tous'}, sunrise: ${eventData.sunrise}, sunset: ${eventData.sunset}, Résultat: ${mainTriggerMet}`,
          'AutomationsService',
        );
        break;

      case AutomationTriggerType.TIME:
        // Vérifier que l'événement correspond à un trigger TIME
        mainTriggerMet = eventType === 'time_trigger' && eventData.automationId === automation.id;
        this.logger.debug(
          `[AUTOMATION CHECK] Type HEURE - eventType: ${eventType}, automationId: ${eventData.automationId}, Résultat: ${mainTriggerMet}`,
          'AutomationsService',
        );
        break;

      default:
        this.logger.debug(
          `[AUTOMATION CHECK] ❌ Type de déclencheur non supporté: ${trigger.type}`,
          'AutomationsService',
        );
        mainTriggerMet = false;
        break;
      }
    } else {
      this.logger.debug(
        `[AUTOMATION CHECK] ⚠️ L'appareil ne correspond pas au trigger principal - Requis: ${trigger.deviceId}, Reçu: ${deviceId}. Vérification des conditions supplémentaires si opérateur OR...`,
        'AutomationsService',
      );
      mainTriggerMet = false;
    }

    // Vérifier les conditions supplémentaires si elles existent
    if (trigger.additionalConditions && trigger.additionalConditions.length > 0) {
      const logicOperator = trigger.logicOperator || 'AND';
      this.logger.log(
        `[AUTOMATION CHECK] 🔗 Vérification de ${trigger.additionalConditions.length} condition(s) supplémentaire(s) avec opérateur: ${logicOperator}`,
        'AutomationsService',
      );

      // Pour un OR : si le trigger principal est satisfait, on s'exécute immédiatement
      if (logicOperator === 'OR' && mainTriggerMet) {
        this.logger.log(
          `[AUTOMATION CHECK] ✅ Opérateur OR : le trigger principal est satisfait, l'automation sera exécutée`,
          'AutomationsService',
        );
        return true;
      }

      // Pour un AND : le trigger principal doit être satisfait ET toutes les conditions supplémentaires
      if (logicOperator === 'AND' && !mainTriggerMet) {
        this.logger.log(
          `[AUTOMATION CHECK] ❌ Opérateur AND : le trigger principal n'est pas satisfait`,
          'AutomationsService',
        );
        return false;
      }

      // Vérifier les conditions supplémentaires
      // Pour un OR, on vérifie d'abord si l'événement actuel correspond à une condition supplémentaire
      const additionalConditionsResults: boolean[] = [];

      for (const additionalCondition of trigger.additionalConditions) {
        let conditionResult = false;
        
        // Pour un OR, vérifier si l'événement actuel correspond à cette condition
        if (logicOperator === 'OR') {
          conditionResult = this.checkEventMatchesCondition(
            additionalCondition,
            eventType,
            eventData,
            deviceId,
          );
        }
        
        // Si l'événement ne correspond pas (ou si c'est un AND), vérifier l'état actuel
        if (!conditionResult) {
          conditionResult = await this.checkCondition(additionalCondition);
        }
        
        additionalConditionsResults.push(conditionResult);
        this.logger.log(
          `[AUTOMATION CHECK] 📋 Condition ${additionalCondition.type} (${additionalCondition.deviceId || 'tous'}): ${conditionResult} ${logicOperator === 'OR' && conditionResult ? '(événement actuel)' : ''}`,
          'AutomationsService',
        );
      }

      // Appliquer l'opérateur logique
      let allConditionsMet = false;
      if (logicOperator === 'AND') {
        // Pour AND : trigger principal ET toutes les conditions supplémentaires
        allConditionsMet = mainTriggerMet && additionalConditionsResults.every(result => result === true);
      } else if (logicOperator === 'OR') {
        // Pour OR : trigger principal OU au moins une condition supplémentaire
        allConditionsMet = mainTriggerMet || additionalConditionsResults.some(result => result === true);
      }

      this.logger.log(
        `[AUTOMATION CHECK] ${logicOperator === 'AND' ? '🔗' : '🔀'} Résultat final (${logicOperator}): ${allConditionsMet} - Trigger principal: ${mainTriggerMet}, Conditions supplémentaires: ${additionalConditionsResults.filter(r => r).length}/${additionalConditionsResults.length} satisfaites`,
        'AutomationsService',
      );

      if (!allConditionsMet) {
        this.logger.log(
          `[AUTOMATION CHECK] ❌ Les conditions ne sont pas toutes satisfaites, l'automation ne sera pas exécutée`,
          'AutomationsService',
        );
      }

      return allConditionsMet;
    }

    // Pas de conditions supplémentaires, le trigger principal suffit
    if (!mainTriggerMet) {
      this.logger.debug(
        `[AUTOMATION CHECK] ❌ Le trigger principal n'est pas satisfait`,
        'AutomationsService',
      );
      return false;
    }

    return mainTriggerMet;
  }

  /**
   * Vérifie si l'événement actuel correspond à une condition supplémentaire
   */
  private checkEventMatchesCondition(
    condition: {
      type: AutomationTriggerType;
      deviceId?: string;
      deviceName?: string;
      condition?: Record<string, any>;
    },
    eventType: string,
    eventData: any,
    eventDeviceId: string,
  ): boolean {
    // Vérifier que l'appareil correspond
    if (condition.deviceId && condition.deviceId !== eventDeviceId) {
      return false;
    }

    // Vérifier selon le type de condition
    switch (condition.type) {
      case AutomationTriggerType.MOTION:
        return eventType === 'motion' || (eventData.occupancy === true || eventData.occupancy === 'true');

      case AutomationTriggerType.CONTACT:
        return eventType === 'contact' || eventData.contact !== undefined;

      case AutomationTriggerType.TEMPERATURE:
        if (eventType !== 'temperature' && !eventData.temperature) {
          return false;
        }
        if (condition.condition?.operator && condition.condition?.value) {
          const temp = eventData.temperature;
          const value = condition.condition.value;
          const operator = condition.condition.operator;
          switch (operator) {
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
            default:
              return false;
          }
        }
        return true;

      case AutomationTriggerType.ILLUMINANCE:
        if (eventType !== 'illuminance' && !eventData.illuminance) {
          return false;
        }
        if (condition.condition?.operator && condition.condition?.value) {
          const illuminance = eventData.illuminance;
          const value = condition.condition.value;
          const operator = condition.condition.operator;
          switch (operator) {
            case '>':
              return illuminance > value;
            case '<':
              return illuminance < value;
            case '>=':
              return illuminance >= value;
            case '<=':
              return illuminance <= value;
            case '==':
              return illuminance === value;
            default:
              return false;
          }
        }
        return true;

      case AutomationTriggerType.HUMIDITY:
        if (eventType !== 'humidity' && !eventData.humidity) {
          return false;
        }
        if (condition.condition?.operator && condition.condition?.value) {
          const humidity = eventData.humidity;
          const value = condition.condition.value;
          const operator = condition.condition.operator;
          switch (operator) {
            case '>':
              return humidity > value;
            case '<':
              return humidity < value;
            case '>=':
              return humidity >= value;
            case '<=':
              return humidity <= value;
            case '==':
              return humidity === value;
            default:
              return false;
          }
        }
        return true;

      case AutomationTriggerType.BUTTON:
        return (
          eventType === 'button' ||
          eventData.action !== undefined ||
          eventData.click !== undefined ||
          eventData.button_l !== undefined ||
          eventData.button_r !== undefined ||
          eventData.button_1 !== undefined ||
          eventData.button_2 !== undefined ||
          eventData.button_3 !== undefined ||
          eventData.button_4 !== undefined
        );

      case AutomationTriggerType.VIBRATION:
        return eventType === 'vibration' || eventData.vibration !== undefined;

      case AutomationTriggerType.WATER_LEAK:
        return eventType === 'water_leak' || eventData.water_leak !== undefined || eventData.water === true;

      case AutomationTriggerType.SMOKE:
        return eventType === 'smoke' || eventData.smoke !== undefined || eventData.smoke_detected === true;

      case AutomationTriggerType.GAS:
        return eventType === 'gas' || eventData.gas !== undefined || eventData.gas_detected === true;

      case AutomationTriggerType.SUNRISE_SUNSET:
        const conditionSunriseSunsetType = (condition as any).sunriseSunsetType;
        if (conditionSunriseSunsetType) {
          if (conditionSunriseSunsetType === 'sunrise') {
            return eventType === 'sunrise' || eventData.sunrise === true;
          } else if (conditionSunriseSunsetType === 'sunset') {
            return eventType === 'sunset' || eventData.sunset === true;
          }
        }
        return eventType === 'sunrise' || eventType === 'sunset' || eventData.sunrise || eventData.sunset;

      case AutomationTriggerType.TIME:
        return eventType === 'time_trigger';

      default:
        return false;
    }
  }

  /**
   * Vérifie une condition individuelle en récupérant l'état actuel de l'appareil
   */
  private async checkCondition(condition: {
    type: AutomationTriggerType;
    deviceId?: string;
    deviceName?: string;
    condition?: Record<string, any>;
  }): Promise<boolean> {
    try {
      // Récupérer l'appareil pour obtenir son état actuel
      let device = null;
      if (condition.deviceId) {
        device = await this.devicesService.findOne(condition.deviceId);
      }

      // Vérifier selon le type de condition
      switch (condition.type) {
        case AutomationTriggerType.MOTION:
          if (!device) return false;
          return device.state?.occupancy === true || device.state?.presence === true;

        case AutomationTriggerType.ILLUMINANCE:
          if (!device || device.state?.illuminance === undefined) return false;
          if (condition.condition?.operator && condition.condition?.value) {
            const illuminance = typeof device.state.illuminance === 'number' 
              ? device.state.illuminance 
              : parseFloat(device.state.illuminance) || 0;
            const value = condition.condition.value;
            const operator = condition.condition.operator;
            switch (operator) {
              case '>':
                return illuminance > value;
              case '<':
                return illuminance < value;
              case '>=':
                return illuminance >= value;
              case '<=':
                return illuminance <= value;
              case '==':
                return illuminance === value;
              default:
                return false;
            }
          }
          return device.state.illuminance !== undefined;

        case AutomationTriggerType.TEMPERATURE:
          if (!device || device.state?.temperature === undefined) return false;
          if (condition.condition?.operator && condition.condition?.value) {
            const temp = typeof device.state.temperature === 'number' 
              ? device.state.temperature 
              : parseFloat(device.state.temperature) || 0;
            const value = condition.condition.value;
            const operator = condition.condition.operator;
            switch (operator) {
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
              default:
                return false;
            }
          }
          return device.state.temperature !== undefined;

        case AutomationTriggerType.HUMIDITY:
          if (!device || device.state?.humidity === undefined) return false;
          if (condition.condition?.operator && condition.condition?.value) {
            const humidity = typeof device.state.humidity === 'number' 
              ? device.state.humidity 
              : parseFloat(device.state.humidity) || 0;
            const value = condition.condition.value;
            const operator = condition.condition.operator;
            switch (operator) {
              case '>':
                return humidity > value;
              case '<':
                return humidity < value;
              case '>=':
                return humidity >= value;
              case '<=':
                return humidity <= value;
              case '==':
                return humidity === value;
              default:
                return false;
            }
          }
          return device.state.humidity !== undefined;

        case AutomationTriggerType.CONTACT:
          if (!device) return false;
          return device.state?.contact !== undefined;

        case AutomationTriggerType.VIBRATION:
          if (!device) return false;
          return device.state?.vibration === true;

        default:
          this.logger.debug(
            `[AUTOMATION CHECK] ❌ Type de condition supplémentaire non supporté: ${condition.type}`,
            'AutomationsService',
          );
          return false;
      }
    } catch (error) {
      this.logger.error(
        `[AUTOMATION CHECK] ❌ Erreur lors de la vérification de la condition: ${error.message}`,
        error.stack,
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
          
          // Allumer l'appareil - Utiliser devicesService pour gérer correctement le mqttName
          await this.devicesService.sendCommand(deviceId, { state: 'ON' });
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
                await this.devicesService.sendCommand(deviceId, { state: 'OFF' });
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
          const turnOffDevice = await this.devicesService.findOne(deviceId);
          // Annuler le timer d'extinction automatique s'il existe
          const turnOffTimer = this.turnOffTimers.get(deviceId);
          if (turnOffTimer) {
            clearTimeout(turnOffTimer);
            this.turnOffTimers.delete(deviceId);
            this.logger.debug(
              `[AUTOMATION ACTION] ⏱️ Timer d'extinction automatique annulé pour l'appareil ${deviceId}`,
              'AutomationsService',
            );
          }
          this.logger.log(
            `[AUTOMATION ACTION] 🔌 Commande: Éteindre l'appareil ${turnOffDevice.friendlyName} (${deviceId})`,
            'AutomationsService',
          );
          await this.devicesService.sendCommand(deviceId, { state: 'OFF' });
          this.logger.log(
            `[AUTOMATION ACTION] ✅ Commande "OFF" envoyée avec succès à l'appareil ${turnOffDevice.friendlyName} (${deviceId})`,
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
          await this.devicesService.sendCommand(deviceId, { state: newState });
          this.logger.log(
            `[AUTOMATION ACTION] ✅ Commande "TOGGLE" (${newState}) envoyée avec succès à l'appareil ${device.friendlyName} (${deviceId})`,
            'AutomationsService',
          );
          break;

        case AutomationActionType.SET_BRIGHTNESS:
          if (!params?.brightness) {
            throw new BadRequestException('Le paramètre brightness est requis');
          }
          const brightnessDevice = await this.devicesService.findOne(deviceId);
          this.logger.log(
            `[AUTOMATION ACTION] 🌟 Commande: Régler la luminosité de l'appareil ${brightnessDevice.friendlyName} (${deviceId}) à ${params.brightness}%`,
            'AutomationsService',
          );
          // Convertir le pourcentage en valeur 0-255 pour Zigbee2MQTT
          const brightnessValue = Math.round((params.brightness / 100) * 255);
          await this.devicesService.sendCommand(deviceId, {
            state: 'ON',
            brightness: brightnessValue,
          });
          this.logger.log(
            `[AUTOMATION ACTION] ✅ Commande de luminosité (${params.brightness}% = ${brightnessValue}/255) envoyée avec succès à l'appareil ${brightnessDevice.friendlyName} (${deviceId})`,
            'AutomationsService',
          );
          break;

        case AutomationActionType.SET_COLOR:
          if (!params?.color) {
            throw new BadRequestException('Le paramètre color est requis');
          }
          const colorDevice = await this.devicesService.findOne(deviceId);
          this.logger.log(
            `[AUTOMATION ACTION] 🎨 Commande: Changer la couleur de l'appareil ${colorDevice.friendlyName} (${deviceId}) en ${params.color}`,
            'AutomationsService',
          );
          await this.devicesService.sendCommand(deviceId, {
            state: 'ON',
            color: params.color,
          });
          this.logger.log(
            `[AUTOMATION ACTION] ✅ Commande de couleur (${params.color}) envoyée avec succès à l'appareil ${colorDevice.friendlyName} (${deviceId})`,
            'AutomationsService',
          );
          break;

        case AutomationActionType.SET_COLOR_TEMP:
          if (!params?.color_temp) {
            throw new BadRequestException('Le paramètre color_temp est requis');
          }
          const colorTempDevice = await this.devicesService.findOne(deviceId);
          this.logger.log(
            `[AUTOMATION ACTION] 🌡️ Commande: Régler la température de couleur de l'appareil ${colorTempDevice.friendlyName} (${deviceId}) à ${params.color_temp}`,
            'AutomationsService',
          );
          await this.devicesService.sendCommand(deviceId, {
            state: 'ON',
            color_temp: params.color_temp,
          });
          this.logger.log(
            `[AUTOMATION ACTION] ✅ Commande de température de couleur (${params.color_temp}) envoyée avec succès à l'appareil ${colorTempDevice.friendlyName} (${deviceId})`,
            'AutomationsService',
          );
          break;

        case AutomationActionType.SET_THERMOSTAT:
          if (!params?.temperature) {
            throw new BadRequestException('Le paramètre temperature est requis');
          }
          const thermostatDevice = await this.devicesService.findOne(deviceId);
          this.logger.log(
            `[AUTOMATION ACTION] 🌡️ Commande: Régler le thermostat ${thermostatDevice.friendlyName} (${deviceId}) à ${params.temperature}°C`,
            'AutomationsService',
          );
          await this.devicesService.sendCommand(deviceId, {
            current_heating_setpoint: params.temperature,
          });
          this.logger.log(
            `[AUTOMATION ACTION] ✅ Commande de thermostat (${params.temperature}°C) envoyée avec succès à l'appareil ${thermostatDevice.friendlyName} (${deviceId})`,
            'AutomationsService',
          );
          break;

        case AutomationActionType.OPEN_COVER:
          const openCoverDevice = await this.devicesService.findOne(deviceId);
          // Utiliser la position définie dans params si disponible, sinon 100 (ouvert)
          const openPosition = params?.position !== undefined ? params.position : 100;
          this.logger.log(
            `[AUTOMATION ACTION] 🪟 Commande: Positionner le volet ${openCoverDevice.friendlyName} (${deviceId}) à ${openPosition}%`,
            'AutomationsService',
          );
          await this.devicesService.sendCommand(deviceId, {
            position: openPosition,
          });
          this.logger.log(
            `[AUTOMATION ACTION] ✅ Commande de position (${openPosition}%) envoyée avec succès au volet ${openCoverDevice.friendlyName} (${deviceId})`,
            'AutomationsService',
          );
          break;

        case AutomationActionType.CLOSE_COVER:
          const closeCoverDevice = await this.devicesService.findOne(deviceId);
          // Utiliser la position définie dans params si disponible, sinon 0 (fermé)
          const closePosition = params?.position !== undefined ? params.position : 0;
          this.logger.log(
            `[AUTOMATION ACTION] 🪟 Commande: Positionner le volet ${closeCoverDevice.friendlyName} (${deviceId}) à ${closePosition}%`,
            'AutomationsService',
          );
          await this.devicesService.sendCommand(deviceId, {
            position: closePosition,
          });
          this.logger.log(
            `[AUTOMATION ACTION] ✅ Commande de position (${closePosition}%) envoyée avec succès au volet ${closeCoverDevice.friendlyName} (${deviceId})`,
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

  /**
   * Exécute manuellement une automation
   */
  async executeManually(id: string): Promise<void> {
    const automation = await this.findOne(id);
    
    if (automation.status !== AutomationStatus.ACTIVE) {
      throw new BadRequestException(
        `L'automatisation "${automation.name}" n'est pas active. Veuillez l'activer avant de l'exécuter manuellement.`,
      );
    }

    this.logger.log(
      `[AUTOMATION MANUAL] 🎯 Exécution manuelle de l'automatisation "${automation.name}" (ID: ${automation.id})`,
      'AutomationsService',
    );

    // Exécuter l'automation avec un événement manuel
    await this.executeAutomation(automation, {
      manual: true,
      triggeredBy: 'user',
      timestamp: new Date(),
    });
  }
}

