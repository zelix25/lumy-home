import {
  Injectable,
  Logger,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plugin, PluginStatus } from './entities/plugin.entity';
import { PluginRuntimeService } from './plugin-runtime.service';
import { LoggerService } from '../logger/logger.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

export enum PluginHookType {
  ON_DEVICE_UPDATE = 'onDeviceUpdate',
  ON_DEVICE_STATE_CHANGE = 'onDeviceStateChange',
  ON_SCHEDULE = 'onSchedule',
  ON_TIME = 'onTime',
  ON_AUTOMATION_TRIGGER = 'onAutomationTrigger',
  ON_AUTOMATION_EXECUTE = 'onAutomationExecute',
  ON_INIT = 'onInit',
  ON_ENABLE = 'onEnable',
  ON_DISABLE = 'onDisable',
  ON_DESTROY = 'onDestroy',
}

export interface PluginHookEvent {
  pluginId: string;
  hookType: PluginHookType;
  data: Record<string, any>;
  timestamp: Date;
}

@Injectable()
export class PluginHooksService implements OnModuleInit {
  private readonly logger: Logger;
  private readonly registeredHooks: Map<
    string,
    Map<PluginHookType, Function[]>
  > = new Map();

  constructor(
    @InjectRepository(Plugin)
    private pluginRepository: Repository<Plugin>,
    @Inject(forwardRef(() => PluginRuntimeService))
    private pluginRuntimeService: PluginRuntimeService,
    private loggerService: LoggerService,
    private eventEmitter: EventEmitter2,
  ) {
    this.logger = new Logger(PluginHooksService.name);
  }

  async onModuleInit() {
    // S'abonner aux événements système pour déclencher les hooks
    this.subscribeToSystemEvents();
    this.logger.log('Service de hooks de plugins initialisé', 'PluginHooksService');
  }

  /**
   * S'abonne aux événements système pour déclencher les hooks
   */
  private subscribeToSystemEvents(): void {
    // Écouter les événements de mise à jour de device
    this.eventEmitter.on('device.update', (data: any) => {
      this.triggerHook(PluginHookType.ON_DEVICE_UPDATE, data);
    });

    this.eventEmitter.on('device.stateChange', (data: any) => {
      this.triggerHook(PluginHookType.ON_DEVICE_STATE_CHANGE, data);
    });

    this.eventEmitter.on('automation.trigger', (data: any) => {
      this.triggerHook(PluginHookType.ON_AUTOMATION_TRIGGER, data);
    });

    this.eventEmitter.on('automation.execute', (data: any) => {
      this.triggerHook(PluginHookType.ON_AUTOMATION_EXECUTE, data);
    });

    // Planifier les hooks temporels
    this.scheduleTimeHooks();
  }

  /**
   * Enregistre un hook pour un plugin
   */
  async registerHook(
    pluginId: string,
    hookType: PluginHookType,
    handler: Function,
  ): Promise<void> {
    if (!this.registeredHooks.has(pluginId)) {
      this.registeredHooks.set(pluginId, new Map());
    }

    const pluginHooks = this.registeredHooks.get(pluginId)!;

    if (!pluginHooks.has(hookType)) {
      pluginHooks.set(hookType, []);
    }

    pluginHooks.get(hookType)!.push(handler);

    this.logger.log(
      `Hook ${hookType} enregistré pour le plugin ${pluginId}`,
      'PluginHooksService',
    );
  }

  /**
   * Déclenche un hook pour tous les plugins concernés
   */
  async triggerHook(
    hookType: PluginHookType,
    data: Record<string, any>,
  ): Promise<void> {
    const enabledPlugins = await this.pluginRepository.find({
      where: { status: PluginStatus.ENABLED },
    });

    for (const plugin of enabledPlugins) {
      const pluginHooks = this.registeredHooks.get(plugin.id);

      if (pluginHooks && pluginHooks.has(hookType)) {
        const handlers = pluginHooks.get(hookType)!;

        for (const handler of handlers) {
          try {
            await this.executeHook(plugin.id, hookType, handler, data);
          } catch (error: any) {
            this.logger.error(
              `Erreur lors de l'exécution du hook ${hookType} pour le plugin ${plugin.name}: ${error.message}`,
              'PluginHooksService',
            );
          }
        }
      }
    }
  }

  /**
   * Exécute un hook spécifique
   */
  private async executeHook(
    pluginId: string,
    hookType: PluginHookType,
    handler: Function,
    data: Record<string, any>,
  ): Promise<void> {
    const loadedPlugin = this.pluginRuntimeService.getLoadedPlugin(pluginId);

    if (!loadedPlugin) {
      this.logger.warn(
        `Plugin ${pluginId} non chargé, impossible d'exécuter le hook ${hookType}`,
        'PluginHooksService',
      );
      return;
    }

    // Construire l'événement de hook
    const hookEvent: PluginHookEvent = {
      pluginId,
      hookType,
      data,
      timestamp: new Date(),
    };

    // Exécuter le handler
    // Note: Dans une implémentation complète, on chargerait et exécuterait le code du handler
    // depuis le répertoire du plugin
    if (typeof handler === 'function') {
      await handler(hookEvent);
    } else {
      // Si le handler est un chemin vers un fichier, le charger dynamiquement
      this.logger.debug(
        `Exécution du hook ${hookType} pour le plugin ${pluginId}`,
        'PluginHooksService',
      );
      // TODO: Charger et exécuter le handler depuis le fichier
    }
  }

  /**
   * Planifie les hooks temporels (onTime, onSchedule)
   */
  private scheduleTimeHooks(): void {
    // Planifier les vérifications horaires
    setInterval(async () => {
      await this.triggerHook(PluginHookType.ON_TIME, {
        time: new Date(),
      });
    }, 60000); // Toutes les minutes

    // Planifier les vérifications de schedule
    setInterval(async () => {
      await this.triggerHook(PluginHookType.ON_SCHEDULE, {
        time: new Date(),
      });
    }, 60000); // Toutes les minutes
  }

  /**
   * Déclenche les hooks d'initialisation pour un plugin
   */
  async triggerInitHooks(pluginId: string): Promise<void> {
    await this.triggerHook(PluginHookType.ON_INIT, {
      pluginId,
      timestamp: new Date(),
    });
  }

  /**
   * Déclenche les hooks d'activation pour un plugin
   */
  async triggerEnableHooks(pluginId: string): Promise<void> {
    await this.triggerHook(PluginHookType.ON_ENABLE, {
      pluginId,
      timestamp: new Date(),
    });
  }

  /**
   * Déclenche les hooks de désactivation pour un plugin
   */
  async triggerDisableHooks(pluginId: string): Promise<void> {
    await this.triggerHook(PluginHookType.ON_DISABLE, {
      pluginId,
      timestamp: new Date(),
    });
  }

  /**
   * Déclenche les hooks de destruction pour un plugin
   */
  async triggerDestroyHooks(pluginId: string): Promise<void> {
    await this.triggerHook(PluginHookType.ON_DESTROY, {
      pluginId,
      timestamp: new Date(),
    });
  }

  /**
   * Supprime tous les hooks d'un plugin
   */
  removePluginHooks(pluginId: string): void {
    this.registeredHooks.delete(pluginId);
    this.logger.log(
      `Hooks supprimés pour le plugin ${pluginId}`,
      'PluginHooksService',
    );
  }
}

