import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { LoggerService } from '../../logger/logger.service';
import { PluginHookType, PluginEvent, PluginHook } from './plugin-hooks.enum';
import { Plugin } from '../entities/plugin.entity';
import { PluginMonitoringService } from '../monitoring/plugin-monitoring.service';
import { PluginErrorService } from '../errors/plugin-error.service';
import { PluginAnalyticsService } from '../analytics/plugin-analytics.service';
import { AnalyticsEventType } from '../analytics/plugin-analytics.entity';
import * as fs from 'fs';
import * as path from 'path';
import { PluginStatus } from '../entities/plugin.entity';

@Injectable()
export class PluginHooksService {
  private hooks: Map<string, PluginHook[]> = new Map(); // Map<eventType, hooks[]>
  private readonly logger: Logger;

  constructor(
    private loggerService: LoggerService,
    private monitoringService: PluginMonitoringService,
    @Inject(forwardRef(() => PluginErrorService))
    private errorService?: PluginErrorService,
    @Inject(forwardRef(() => PluginAnalyticsService))
    private analyticsService?: PluginAnalyticsService,
  ) {
    this.logger = new Logger(PluginHooksService.name);
  }

  /**
   * Enregistre un hook pour un plugin
   */
  registerHook(plugin: Plugin, hookType: PluginHookType | string, handlerPath: string, priority: number = 100): void {
    if (plugin.status !== PluginStatus.ENABLED) {
      this.logger.warn(`[PluginHooksService] Plugin ${plugin.name} n'est pas activé, hook non enregistré`);
      return;
    }

    const hook: PluginHook = {
      pluginId: plugin.id,
      pluginName: plugin.name,
      hookType,
      handlerPath,
      enabled: true,
      priority,
    };

    if (!this.hooks.has(hookType)) {
      this.hooks.set(hookType, []);
    }

    const hooksForType = this.hooks.get(hookType)!;
    hooksForType.push(hook);

    // Trier par priorité (plus bas = exécuté en premier)
    hooksForType.sort((a, b) => (a.priority || 100) - (b.priority || 100));

    this.logger.log(
      `[PluginHooksService] Hook ${hookType} enregistré pour le plugin ${plugin.name} (priorité: ${priority})`,
      'PluginHooksService',
    );
  }

  /**
   * Enregistre tous les hooks d'un plugin depuis son manifest
   */
  registerPluginHooks(plugin: Plugin): void {
    if (!plugin.metadata?.hooks || typeof plugin.metadata.hooks !== 'object') {
      return;
    }

    const hooks = plugin.metadata.hooks as Record<string, string>;
    const installPath = plugin.installPath;

    if (!installPath || !fs.existsSync(installPath)) {
      this.logger.warn(
        `[PluginHooksService] Chemin d'installation non trouvé pour ${plugin.name}`,
        'PluginHooksService',
      );
      return;
    }

    for (const [hookType, handlerPath] of Object.entries(hooks)) {
      const fullHandlerPath = path.join(installPath, handlerPath);

      // Vérifier que le fichier handler existe
      if (!fs.existsSync(fullHandlerPath)) {
        this.logger.warn(
          `[PluginHooksService] Handler non trouvé: ${fullHandlerPath} pour le hook ${hookType} du plugin ${plugin.name}`,
          'PluginHooksService',
        );
        continue;
      }

      // Déterminer la priorité (par défaut 100, peut être configuré dans le manifest)
      const priority = plugin.metadata.hookPriorities?.[hookType] || 100;

      this.registerHook(plugin, hookType, handlerPath, priority);
    }

    this.logger.log(
      `[PluginHooksService] ${Object.keys(hooks).length} hook(s) enregistré(s) pour le plugin ${plugin.name}`,
      'PluginHooksService',
    );
  }

  /**
   * Désenregistre tous les hooks d'un plugin
   */
  unregisterPluginHooks(pluginId: string): void {
    for (const [hookType, hooks] of this.hooks.entries()) {
      const filteredHooks = hooks.filter((hook) => hook.pluginId !== pluginId);
      if (filteredHooks.length === 0) {
        this.hooks.delete(hookType);
      } else {
        this.hooks.set(hookType, filteredHooks);
      }
    }

    this.logger.log(
      `[PluginHooksService] Hooks désenregistrés pour le plugin ${pluginId}`,
      'PluginHooksService',
    );
  }

  /**
   * Déclenche un événement et exécute tous les hooks associés
   */
  async triggerHook(eventType: PluginHookType | string, eventData: Record<string, any>, source?: string): Promise<void> {
    const hooks = this.hooks.get(eventType) || [];

    if (hooks.length === 0) {
      return;
    }

    const event: PluginEvent = {
      type: eventType,
      timestamp: new Date(),
      data: eventData,
      source,
    };

    this.logger.debug(
      `[PluginHooksService] Déclenchement de l'événement ${eventType} pour ${hooks.length} hook(s)`,
      'PluginHooksService',
    );

    // Exécuter tous les hooks en parallèle
    const promises = hooks
      .filter((hook) => hook.enabled)
      .map((hook) => this.executeHook(hook, event));

    await Promise.allSettled(promises);
  }

  /**
   * Exécute un hook spécifique
   */
  private async executeHook(hook: PluginHook, event: PluginEvent): Promise<void> {
    const startTime = Date.now();
    let success = true;
    let error: string | undefined;

    try {
      // TODO: Implémenter l'exécution réelle du hook
      // Pour l'instant, on simule l'exécution
      // Dans une vraie implémentation, on chargerait et exécuterait le code du plugin
      // dans un sandbox sécurisé

      this.logger.debug(
        `[PluginHooksService] Exécution du hook ${hook.hookType} pour le plugin ${hook.pluginName}`,
        'PluginHooksService',
      );

      // TODO: Charger et exécuter le handler
      // const handler = await this.loadHandler(hook.handlerPath);
      // await handler(event);

      // Pour l'instant, on log juste l'événement
      this.logger.log(
        `[PluginHooksService] Hook ${hook.hookType} exécuté pour ${hook.pluginName} avec données: ${JSON.stringify(event.data)}`,
        'PluginHooksService',
      );
    } catch (err: any) {
      success = false;
      error = err.message;
      this.logger.error(
        `[PluginHooksService] Erreur lors de l'exécution du hook ${hook.hookType} pour ${hook.pluginName}: ${error}`,
        err.stack,
        'PluginHooksService',
      );

      // Enregistrer l'erreur dans le service d'erreurs
      if (this.errorService) {
        await this.errorService.recordError(
          hook.pluginId,
          err,
          {
            hook: hook.hookType,
            eventType: event.type,
          },
        );
      }
    } finally {
      // Enregistrer les métriques de performance
      const duration = Date.now() - startTime;
      this.monitoringService.recordExecution(
        hook.pluginId,
        hook.pluginName,
        `hook:${hook.hookType}`,
        duration,
        success,
        error,
      );

      // Enregistrer l'événement d'analytics
      if (this.analyticsService) {
        await this.analyticsService.recordEvent(
          hook.pluginId,
          AnalyticsEventType.HOOK_EXECUTION,
          {
            hookType: hook.hookType,
            eventType: event.type,
          },
          undefined,
          duration,
          success,
        );
      }
    }
  }

  /**
   * Charge un handler depuis le système de fichiers
   */
  private async loadHandler(handlerPath: string): Promise<(event: PluginEvent) => Promise<void>> {
    // TODO: Implémenter le chargement dynamique du handler
    // Cela nécessitera un système de sandboxing pour la sécurité
    throw new Error('Chargement de handler non implémenté - nécessite un système de sandboxing');
  }

  /**
   * Récupère tous les hooks enregistrés
   */
  getAllHooks(): Map<string, PluginHook[]> {
    return new Map(this.hooks);
  }

  /**
   * Récupère les hooks pour un type d'événement spécifique
   */
  getHooksForEvent(eventType: PluginHookType | string): PluginHook[] {
    return this.hooks.get(eventType) || [];
  }

  /**
   * Récupère les hooks pour un plugin spécifique
   */
  getHooksForPlugin(pluginId: string): PluginHook[] {
    const allHooks: PluginHook[] = [];
    for (const hooks of this.hooks.values()) {
      allHooks.push(...hooks.filter((hook) => hook.pluginId === pluginId));
    }
    return allHooks;
  }

  /**
   * Active ou désactive un hook
   */
  setHookEnabled(pluginId: string, hookType: PluginHookType | string, enabled: boolean): void {
    const hooks = this.hooks.get(hookType) || [];
    const hook = hooks.find((h) => h.pluginId === pluginId && h.hookType === hookType);
    if (hook) {
      hook.enabled = enabled;
      this.logger.log(
        `[PluginHooksService] Hook ${hookType} ${enabled ? 'activé' : 'désactivé'} pour le plugin ${pluginId}`,
        'PluginHooksService',
      );
    }
  }
}

