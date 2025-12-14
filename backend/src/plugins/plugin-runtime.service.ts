import {
  Injectable,
  BadRequestException,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Plugin, PluginStatus } from './entities/plugin.entity';
import { LoggerService } from '../logger/logger.service';

interface LoadedPlugin {
  plugin: Plugin;
  manifest: Record<string, any>;
  loadedAt: Date;
  instance?: any; // Instance du plugin chargé (pour les plugins avec code exécutable)
}

@Injectable()
export class PluginRuntimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger: Logger;
  private readonly pluginsDirectory: string;
  private loadedPlugins: Map<string, LoadedPlugin> = new Map();

  constructor(
    @InjectRepository(Plugin)
    private pluginRepository: Repository<Plugin>,
    private configService: ConfigService,
    private loggerService: LoggerService,
  ) {
    this.logger = new Logger(PluginRuntimeService.name);
    this.pluginsDirectory = path.join(
      process.cwd(),
      this.configService.get<string>('PLUGINS_DIRECTORY', 'plugins'),
    );
  }

  async onModuleInit() {
    // Charger tous les plugins activés au démarrage
    await this.loadEnabledPlugins();
  }

  async onModuleDestroy() {
    // Décharger tous les plugins au shutdown
    await this.unloadAllPlugins();
  }

  /**
   * Charge tous les plugins activés au démarrage
   */
  private async loadEnabledPlugins(): Promise<void> {
    try {
      const enabledPlugins = await this.pluginRepository.find({
        where: { status: PluginStatus.ENABLED },
      });

      this.logger.log(
        `Chargement de ${enabledPlugins.length} plugin(s) activé(s)...`,
        'PluginRuntimeService',
      );

      for (const plugin of enabledPlugins) {
        try {
          await this.loadPlugin(plugin);
        } catch (error: any) {
          this.logger.error(
            `Erreur lors du chargement du plugin ${plugin.name}: ${error.message}`,
            'PluginRuntimeService',
          );
          // Marquer le plugin comme étant en erreur
          plugin.status = PluginStatus.ERROR;
          plugin.error = error.message;
          await this.pluginRepository.save(plugin);
        }
      }
    } catch (error: any) {
      this.logger.error(
        `Erreur lors du chargement des plugins: ${error.message}`,
        'PluginRuntimeService',
      );
    }
  }

  /**
   * Charge un plugin en mémoire
   */
  async loadPlugin(plugin: Plugin): Promise<void> {
    // Vérifier si le plugin est déjà chargé
    if (this.loadedPlugins.has(plugin.id)) {
      this.logger.warn(
        `Plugin ${plugin.name} est déjà chargé en mémoire`,
        'PluginRuntimeService',
      );
      return;
    }

    // Vérifier que le plugin est installé
    if (!plugin.installPath) {
      throw new BadRequestException(
        `Le plugin ${plugin.name} n'est pas installé (installPath manquant)`,
      );
    }

    // Vérifier que le répertoire existe
    if (!(await fs.pathExists(plugin.installPath))) {
      throw new BadRequestException(
        `Le répertoire d'installation du plugin ${plugin.name} n'existe pas: ${plugin.installPath}`,
      );
    }

    try {
      // Lire le manifest.json
      const manifestPath = path.join(plugin.installPath, 'manifest.json');
      if (!(await fs.pathExists(manifestPath))) {
        throw new BadRequestException(
          `manifest.json non trouvé pour le plugin ${plugin.name}`,
        );
      }

      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);

      // Charger le plugin en mémoire
      const loadedPlugin: LoadedPlugin = {
        plugin,
        manifest,
        loadedAt: new Date(),
      };

      // TODO: Charger le code exécutable du plugin si nécessaire
      // Pour l'instant, on stocke juste les métadonnées
      // Dans le futur, on pourra charger des modules Node.js, des scripts, etc.

      this.loadedPlugins.set(plugin.id, loadedPlugin);

      this.logger.log(
        `Plugin chargé en mémoire: ${plugin.name} (v${plugin.version})`,
        'PluginRuntimeService',
      );

      // Exécuter les hooks d'initialisation si définis
      await this.executeInitHooks(loadedPlugin);
    } catch (error: any) {
      this.logger.error(
        `Erreur lors du chargement du plugin ${plugin.name}: ${error.message}`,
        'PluginRuntimeService',
      );
      throw error;
    }
  }

  /**
   * Décharge un plugin de la mémoire
   */
  async unloadPlugin(pluginId: string): Promise<void> {
    const loadedPlugin = this.loadedPlugins.get(pluginId);

    if (!loadedPlugin) {
      this.logger.warn(
        `Plugin ${pluginId} n'est pas chargé en mémoire`,
        'PluginRuntimeService',
      );
      return;
    }

    try {
      // Exécuter les hooks de nettoyage si définis
      await this.executeCleanupHooks(loadedPlugin);

      // Nettoyer les ressources
      // TODO: Décharger les modules, fermer les connexions, etc.

      this.loadedPlugins.delete(pluginId);

      this.logger.log(
        `Plugin déchargé de la mémoire: ${loadedPlugin.plugin.name}`,
        'PluginRuntimeService',
      );
    } catch (error: any) {
      this.logger.error(
        `Erreur lors du déchargement du plugin ${pluginId}: ${error.message}`,
        'PluginRuntimeService',
      );
      throw error;
    }
  }

  /**
   * Décharge tous les plugins
   */
  private async unloadAllPlugins(): Promise<void> {
    const pluginIds = Array.from(this.loadedPlugins.keys());
    for (const pluginId of pluginIds) {
      try {
        await this.unloadPlugin(pluginId);
      } catch (error: any) {
        this.logger.error(
          `Erreur lors du déchargement du plugin ${pluginId}: ${error.message}`,
          'PluginRuntimeService',
        );
      }
    }
  }

  /**
   * Vérifie si un plugin est chargé en mémoire
   */
  isPluginLoaded(pluginId: string): boolean {
    return this.loadedPlugins.has(pluginId);
  }

  /**
   * Récupère un plugin chargé
   */
  getLoadedPlugin(pluginId: string): LoadedPlugin | undefined {
    return this.loadedPlugins.get(pluginId);
  }

  /**
   * Récupère tous les plugins chargés
   */
  getLoadedPlugins(): LoadedPlugin[] {
    return Array.from(this.loadedPlugins.values());
  }

  /**
   * Exécute les hooks d'initialisation du plugin
   */
  private async executeInitHooks(loadedPlugin: LoadedPlugin): Promise<void> {
    // TODO: Implémenter l'exécution des hooks d'initialisation
    // Par exemple : onInit, onEnable, etc.
    const hooks = loadedPlugin.manifest.hooks || {};
    
    if (hooks.onInit) {
      this.logger.debug(
        `Exécution du hook onInit pour ${loadedPlugin.plugin.name}`,
        'PluginRuntimeService',
      );
      // TODO: Exécuter le hook
    }

    if (hooks.onEnable) {
      this.logger.debug(
        `Exécution du hook onEnable pour ${loadedPlugin.plugin.name}`,
        'PluginRuntimeService',
      );
      // TODO: Exécuter le hook
    }
  }

  /**
   * Exécute les hooks de nettoyage du plugin
   */
  private async executeCleanupHooks(loadedPlugin: LoadedPlugin): Promise<void> {
    // TODO: Implémenter l'exécution des hooks de nettoyage
    // Par exemple : onDisable, onDestroy, etc.
    const hooks = loadedPlugin.manifest.hooks || {};
    
    if (hooks.onDisable) {
      this.logger.debug(
        `Exécution du hook onDisable pour ${loadedPlugin.plugin.name}`,
        'PluginRuntimeService',
      );
      // TODO: Exécuter le hook
    }

    if (hooks.onDestroy) {
      this.logger.debug(
        `Exécution du hook onDestroy pour ${loadedPlugin.plugin.name}`,
        'PluginRuntimeService',
      );
      // TODO: Exécuter le hook
    }
  }
}

