import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Automation,
  AutomationStatus,
  AutomationTriggerType,
  AutomationActionType,
} from './entities/automation.entity';
import { DevicesService } from '../devices/devices.service';
import { LoggerService } from '../logger/logger.service';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompts/system-prompt';
import { AutomationResponseDto } from './dto/automation-response.dto';
import { ConfigService } from '@nestjs/config';
import { HistoryService } from '../history/history.service';
import { Inject, forwardRef } from '@nestjs/common';

interface ParsedAutomation {
  name: string;
  description: string;
  trigger: {
    type: AutomationTriggerType | string;
    deviceName?: string;
    condition?: Record<string, any>;
  };
  actions: Array<{
    type: AutomationActionType | string;
    deviceName?: string;
    params?: Record<string, any>;
  }>;
}

@Injectable()
export class AiService {
  private readonly llamaApiUrl: string;
  private readonly useLocalLlama: boolean;

  constructor(
    @InjectRepository(Automation)
    private automationRepository: Repository<Automation>,
    private devicesService: DevicesService,
    private logger: LoggerService,
    private configService: ConfigService,
    @Inject(forwardRef(() => HistoryService))
    private readonly historyService?: HistoryService,
  ) {
    this.llamaApiUrl =
      this.configService.get<string>('LLAMA_API_URL') ||
      'http://localhost:11434';
    this.useLocalLlama =
      this.configService.get<boolean>('USE_LOCAL_LLAMA', true);
  }

  /**
   * Génère une automatisation à partir d'une phrase en langage naturel
   */
  async generateAutomation(
    userQuery: string,
  ): Promise<AutomationResponseDto> {
    this.logger.log(
      `Génération d'automatisation depuis: "${userQuery}"`,
      'AiService',
    );

    // 1. Récupérer la liste des appareils disponibles
    const devices = await this.devicesService.findAll();
    const availableDevices = devices
      .filter((d) => d.status === 'online' && d.isSupported)
      .map((d) => ({
        friendlyName: d.friendlyName || d.ieeeAddress,
        type: d.type,
        room: d.room,
        ieeeAddress: d.ieeeAddress,
      }));

    if (availableDevices.length === 0) {
      throw new BadRequestException(
        'Aucun appareil disponible pour créer une automatisation',
      );
    }

    // 2. Appeler l'IA pour parser la requête
    const parsedAutomation = await this.parseUserQuery(
      userQuery,
      availableDevices,
    );

    // 3. Valider la cohérence
    await this.validateAutomation(parsedAutomation, availableDevices);

    // 4. Créer l'automatisation en base
    const automation = await this.createAutomation(
      userQuery,
      parsedAutomation,
      availableDevices,
    );

    this.logger.log(
      `Automatisation créée: ${automation.id} - ${automation.name}`,
      'AiService',
    );

    return AutomationResponseDto.fromEntity(automation);
  }

  /**
   * Parse la requête utilisateur via l'IA
   */
  private async parseUserQuery(
    userQuery: string,
    availableDevices: Array<{
      friendlyName: string;
      type: string;
      room?: string;
      ieeeAddress: string;
    }>,
  ): Promise<ParsedAutomation> {
    const userPrompt = buildUserPrompt(userQuery, availableDevices);
    const fullPrompt = `${SYSTEM_PROMPT}\n\n${userPrompt}`;

    try {
      let response: string;

      if (this.useLocalLlama) {
        // Utiliser Gemma 3 local via Ollama
        response = await this.callLocalLlama(fullPrompt);
      } else {
        // Utiliser une API externe (OpenAI, etc.)
        response = await this.callExternalApi(fullPrompt);
      }

      // Extraire le JSON de la réponse
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Aucun JSON trouvé dans la réponse de l\'IA');
      }

      const parsed = JSON.parse(jsonMatch[0]) as ParsedAutomation;
      return parsed;
    } catch (error) {
      this.logger.error(
        `Erreur lors du parsing de la requête: ${error.message}`,
        error.stack,
        'AiService',
      );
      throw new BadRequestException(
        `Impossible de comprendre votre demande. Essayez de reformuler plus simplement.`,
      );
    }
  }

  /**
   * Appelle Gemma 3 local via Ollama
   */
  private async callLocalLlama(prompt: string): Promise<string> {
    const model = this.configService.get<string>('LLAMA_MODEL', 'gemma3');

    try {
      const response = await fetch(`${this.llamaApiUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          options: {
            temperature: 0.3, // Plus déterministe pour des règles
            top_p: 0.9,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Ollama API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();
      return data.response || '';
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'appel à Ollama: ${error.message}`,
        error.stack,
        'AiService',
      );
      throw new Error(
        'Service IA non disponible. Vérifiez que Ollama est installé et démarré.',
      );
    }
  }

  /**
   * Appelle une API externe (placeholder pour future intégration)
   */
  private async callExternalApi(prompt: string): Promise<string> {
    // TODO: Implémenter l'appel à OpenAI ou autre API
    throw new Error('API externe non implémentée');
  }

  /**
   * Valide la cohérence de l'automatisation
   */
  private async validateAutomation(
    automation: ParsedAutomation,
    availableDevices: Array<{
      friendlyName: string;
      type: string;
      room?: string;
      ieeeAddress: string;
    }>,
  ): Promise<void> {
    const errors: string[] = [];

    // Vérifier le déclencheur
    if (automation.trigger.deviceName) {
      const triggerDevice = availableDevices.find(
        (d) => d.friendlyName === automation.trigger.deviceName,
      );
      if (!triggerDevice) {
        errors.push(
          `Appareil déclencheur "${automation.trigger.deviceName}" non trouvé`,
        );
      } else {
        // Vérifier que le type d'appareil correspond au type de déclencheur
        const validTriggerTypes = this.getValidTriggerTypes(triggerDevice.type);
        if (!validTriggerTypes.includes(automation.trigger.type)) {
          errors.push(
            `L'appareil "${automation.trigger.deviceName}" (${triggerDevice.type}) ne peut pas être utilisé comme déclencheur "${automation.trigger.type}"`,
          );
        }
      }
    }

    // Vérifier les actions
    for (const action of automation.actions) {
      if (action.deviceName) {
        const actionDevice = availableDevices.find(
          (d) => d.friendlyName === action.deviceName,
        );
        if (!actionDevice) {
          errors.push(
            `Appareil cible "${action.deviceName}" non trouvé`,
          );
        } else {
          // Vérifier que l'action est possible sur ce type d'appareil
          const validActions = this.getValidActions(actionDevice.type);
          if (!validActions.includes(action.type)) {
            errors.push(
              `L'action "${action.type}" n'est pas possible sur "${action.deviceName}" (${actionDevice.type})`,
            );
          }
        }
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException(
        `Erreurs de validation: ${errors.join('; ')}`,
      );
    }
  }

  /**
   * Retourne les types de déclencheurs valides pour un type d'appareil
   */
  private getValidTriggerTypes(deviceType: string): string[] {
    const mapping: Record<string, string[]> = {
      motion: ['motion'],
      sensor: ['motion', 'temperature'],
      temperature: ['temperature'],
      door: ['contact'],
      window: ['contact'],
      button: ['button'],
    };

    return mapping[deviceType] || [];
  }

  /**
   * Retourne les actions valides pour un type d'appareil
   */
  private getValidActions(deviceType: string): string[] {
    const mapping: Record<string, string[]> = {
      light: ['turn_on', 'turn_off', 'set_brightness', 'set_color'],
      switch: ['turn_on', 'turn_off'],
      plug: ['turn_on', 'turn_off'],
    };

    return mapping[deviceType] || [];
  }

  /**
   * Crée l'automatisation en base de données
   */
  private async createAutomation(
    userQuery: string,
    parsed: ParsedAutomation,
    availableDevices: Array<{
      friendlyName: string;
      type: string;
      room?: string;
      ieeeAddress: string;
    }>,
  ): Promise<Automation> {
    // Trouver les IEEE addresses des appareils
    const triggerDevice = parsed.trigger.deviceName
      ? availableDevices.find(
          (d) => d.friendlyName === parsed.trigger.deviceName,
        )
      : null;

    const actionsWithDeviceIds = parsed.actions.map((action) => {
      const device = availableDevices.find(
        (d) => d.friendlyName === action.deviceName,
      );
      return {
        type: action.type as AutomationActionType,
        deviceId: device?.ieeeAddress || '',
        deviceName: action.deviceName,
        params: action.params,
      };
    });

    const automation = this.automationRepository.create({
      name: parsed.name,
      description: parsed.description,
      userQuery,
      trigger: {
        type: parsed.trigger.type as AutomationTriggerType,
        deviceId: triggerDevice?.ieeeAddress,
        deviceName: parsed.trigger.deviceName,
        condition: parsed.trigger.condition,
      },
      actions: actionsWithDeviceIds,
      status: AutomationStatus.ACTIVE,
      executionLog: [],
    });

    return this.automationRepository.save(automation);
  }

  /**
   * Liste toutes les automatisations
   */
  async findAll(): Promise<AutomationResponseDto[]> {
    const automations = await this.automationRepository.find({
      order: { createdAt: 'DESC' },
    });
    return automations.map((a) => AutomationResponseDto.fromEntity(a));
  }

  /**
   * Récupère une automatisation par ID
   */
  async findOne(id: string): Promise<AutomationResponseDto> {
    const automation = await this.automationRepository.findOne({
      where: { id },
    });

    if (!automation) {
      throw new NotFoundException(`Automatisation ${id} non trouvée`);
    }

    return AutomationResponseDto.fromEntity(automation);
  }

  /**
   * Active ou désactive une automatisation
   */
  async toggleStatus(
    id: string,
    status: AutomationStatus,
  ): Promise<AutomationResponseDto> {
    const automation = await this.automationRepository.findOne({
      where: { id },
    });

    if (!automation) {
      throw new NotFoundException(`Automatisation ${id} non trouvée`);
    }

    automation.status = status;
    await this.automationRepository.save(automation);

    return AutomationResponseDto.fromEntity(automation);
  }

  /**
   * Supprime une automatisation
   */
  async remove(id: string): Promise<void> {
    const result = await this.automationRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Automatisation ${id} non trouvée`);
    }
  }

  /**
   * Vérifie si le serveur Gemma 3 est disponible
   */
  async checkLlamaAvailability(): Promise<{ available: boolean; message?: string }> {
    if (!this.useLocalLlama) {
      return {
        available: false,
        message: 'Le mode local Gemma 3 est désactivé',
      };
    }

    try {
      const model = this.configService.get<string>('LLAMA_MODEL', 'gemma3');
      
      // Vérifier si le modèle est disponible
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch(`${this.llamaApiUrl}/api/tags`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          available: false,
          message: `Le serveur Ollama n'est pas accessible (${response.status})`,
        };
      }

      const data = await response.json();
      const models = data.models || [];
      
      // Vérifier si le modèle exact existe
      let modelExists = models.some((m: any) => m.name === model);
      
      // Si le modèle exact n'existe pas, chercher un modèle qui contient "gemma"
      // (pour gérer les variantes comme gemma2:3b, gemma2:9b, etc.)
      if (!modelExists && model.toLowerCase().includes('gemma')) {
        modelExists = models.some((m: any) => 
          m.name.toLowerCase().includes('gemma')
        );
      }
      
      if (!modelExists) {
        const availableModels = models.map((m: any) => m.name).join(', ') || 'aucun';
        this.logger.warn(
          `Modèle ${model} non trouvé. Modèles disponibles: ${availableModels}`,
          'AiService',
        );
        return {
          available: false,
          message: `Le modèle ${model} n'est pas installé. Modèles disponibles: ${availableModels}. Installez-le avec: ollama pull ${model}`,
        };
      }

      // Si le modèle existe et le serveur répond, on considère que le service est disponible
      // On ne fait pas de test de génération car cela peut prendre du temps et échouer
      // pour des raisons non liées à la disponibilité du service
      this.logger.log(
        `Service Gemma 3 disponible (modèle trouvé dans Ollama)`,
        'AiService',
      );
      return { available: true };
    } catch (error: any) {
      this.logger.warn(
        `Vérification Gemma 3 échouée: ${error.message}`,
        'AiService',
      );
      return {
        available: false,
        message:
          error.name === 'AbortError' || error.message?.includes('aborted')
            ? 'Le serveur Ollama ne répond pas (timeout)'
            : `Le serveur Ollama n'est pas accessible: ${error.message}`,
      };
    }
  }
}

