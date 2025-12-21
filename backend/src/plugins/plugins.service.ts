import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plugin, PluginStatus } from './entities/plugin.entity';
import { LoggerService } from '../logger/logger.service';
import { PluginInstallService } from './plugin-install.service';
import { PluginRuntimeService } from './plugin-runtime.service';
import { PluginUninstallService } from './plugin-uninstall.service';
import { PluginConfigService } from './plugin-config.service';
import { PluginPermissionsService } from './plugin-permissions.service';
import { PluginUIExtensionService } from './plugin-ui-extension.service';
import { PluginAutomationExtensionService } from './plugin-automation-extension.service';
import { PluginHooksService } from './plugin-hooks.service';
import { PluginNotificationService } from './plugin-notification.service';
import { PluginErrorService } from './plugin-error.service';
import { PluginCircuitBreakerService } from './plugin-circuit-breaker.service';
import { PluginIsolationService } from './plugin-isolation.service';
import { PluginAnalyticsService } from './plugin-analytics.service';
import { PluginMonitoringService } from './plugin-monitoring.service';
import { AnalyticsEventType } from './entities/plugin-analytics.entity';
import { StoreApiService } from '../store/store-api.service';

@Injectable()
export class PluginsService {
  private readonly logger: Logger;

  constructor(
    @InjectRepository(Plugin)
    private pluginRepository: Repository<Plugin>,
    private loggerService: LoggerService,
    @Inject(forwardRef(() => PluginInstallService))
    private pluginInstallService: PluginInstallService,
    @Inject(forwardRef(() => PluginRuntimeService))
    private pluginRuntimeService: PluginRuntimeService,
    @Inject(forwardRef(() => PluginUninstallService))
    private pluginUninstallService: PluginUninstallService,
    @Inject(forwardRef(() => PluginConfigService))
    private pluginConfigService: PluginConfigService,
    @Inject(forwardRef(() => PluginPermissionsService))
    private pluginPermissionsService: PluginPermissionsService,
    @Inject(forwardRef(() => PluginUIExtensionService))
    private pluginUIExtensionService: PluginUIExtensionService,
    @Inject(forwardRef(() => PluginAutomationExtensionService))
    private pluginAutomationExtensionService: PluginAutomationExtensionService,
    @Inject(forwardRef(() => PluginHooksService))
    private pluginHooksService: PluginHooksService,
    @Inject(forwardRef(() => PluginNotificationService))
    private pluginNotificationService: PluginNotificationService,
    @Inject(forwardRef(() => PluginErrorService))
    private pluginErrorService: PluginErrorService,
    @Inject(forwardRef(() => PluginCircuitBreakerService))
    private circuitBreakerService: PluginCircuitBreakerService,
    @Inject(forwardRef(() => PluginIsolationService))
    private isolationService: PluginIsolationService,
    @Inject(forwardRef(() => PluginAnalyticsService))
    private analyticsService: PluginAnalyticsService,
    @Inject(forwardRef(() => PluginMonitoringService))
    private monitoringService: PluginMonitoringService,
    @Inject(forwardRef(() => StoreApiService))
    private storeApiService: StoreApiService,
  ) {
    this.logger = new Logger(PluginsService.name);
  }

  /**
   * Récupère tous les plugins
   */
  async findAll(): Promise<Plugin[]> {
    return this.pluginRepository.find({
      order: { displayName: 'ASC' },
    });
  }

  /**
   * Récupère un plugin par son ID
   */
  async findOne(id: string): Promise<Plugin> {
    const plugin = await this.pluginRepository.findOne({
      where: { id },
    });

    if (!plugin) {
      throw new NotFoundException(`Plugin ${id} non trouvé`);
    }

    return plugin;
  }

  /**
   * Récupère un plugin par son nom
   */
  async findByName(name: string): Promise<Plugin | null> {
    return this.pluginRepository.findOne({
      where: { name },
    });
  }

  /**
   * Installe un plugin
   * Note: L'implémentation complète (téléchargement, extraction, validation) sera ajoutée dans l'étape 5
   */
  async install(installData: {
    name: string;
    displayName: string;
    version: string;
    description?: string;
    author?: string;
    icon?: string;
    repository?: string;
    lumyVersion: string;
    installPath?: string;
    config?: Record<string, any>;
    permissions?: string[];
    dependencies?: Record<string, string>;
    configSchema?: Record<string, any>;
    metadata?: Record<string, any>;
  }): Promise<Plugin> {
    // Vérifier si le plugin existe déjà
    const existingPlugin = await this.findByName(installData.name);
    if (existingPlugin) {
      throw new BadRequestException(
        `Un plugin avec le nom "${installData.name}" existe déjà`,
      );
    }

    // Créer le plugin
    const plugin = this.pluginRepository.create({
      ...installData,
      status: PluginStatus.INSTALLED,
    });

    const savedPlugin = await this.pluginRepository.save(plugin);

    // Enregistrer l'événement d'installation
    try {
      await this.analyticsService.trackEvent(savedPlugin.id, {
        eventType: AnalyticsEventType.INSTALL,
      });
    } catch (error: any) {
      this.logger.warn(
        `Erreur lors de l'enregistrement de l'événement d'installation: ${error.message}`,
        'PluginsService',
      );
    }

    this.logger.log(
      `Plugin installé: ${savedPlugin.name} (v${savedPlugin.version})`,
      'PluginsService',
    );

    return savedPlugin;
  }

  /**
   * Active un plugin
   */
  async enable(id: string): Promise<Plugin> {
    const plugin = await this.findOne(id);

    if (plugin.status === PluginStatus.ENABLED) {
      throw new BadRequestException('Le plugin est déjà activé');
    }

    if (plugin.status === PluginStatus.ERROR) {
      throw new BadRequestException(
        'Le plugin est en erreur. Veuillez corriger l\'erreur avant de l\'activer',
      );
    }

    try {
      // Charger le plugin en mémoire
      await this.pluginRuntimeService.loadPlugin(plugin);

      // Enregistrer les extensions UI depuis le manifest
      await this.registerUIExtensions(plugin);

      // Enregistrer les extensions d'automatisation depuis le manifest
      await this.registerAutomationExtensions(plugin);

      // Déclencher les hooks d'activation
      await this.pluginHooksService.triggerEnableHooks(plugin.id);

      // Mettre à jour le statut
      plugin.status = PluginStatus.ENABLED;
      plugin.error = '';

      const updatedPlugin = await this.pluginRepository.save(plugin);

      // Enregistrer l'événement d'activation
      try {
        await this.analyticsService.trackEvent(updatedPlugin.id, {
          eventType: AnalyticsEventType.ENABLE,
        });
      } catch (error: any) {
        this.logger.warn(
          `Erreur lors de l'enregistrement de l'événement d'activation: ${error.message}`,
          'PluginsService',
        );
      }

      this.logger.log(`Plugin activé: ${updatedPlugin.name}`, 'PluginsService');

      return updatedPlugin;
    } catch (error: any) {
      // En cas d'erreur, marquer le plugin comme étant en erreur
      plugin.status = PluginStatus.ERROR;
      plugin.error = error.message;
      await this.pluginRepository.save(plugin);

      this.logger.error(
        `Erreur lors de l'activation du plugin ${plugin.name}: ${error.message}`,
        'PluginsService',
      );

      throw new BadRequestException(
        `Erreur lors de l'activation du plugin: ${error.message}`,
      );
    }
  }

  /**
   * Désactive un plugin
   */
  async disable(id: string): Promise<Plugin> {
    const plugin = await this.findOne(id);

    if (plugin.status === PluginStatus.DISABLED) {
      throw new BadRequestException('Le plugin est déjà désactivé');
    }

    try {
      // Déclencher les hooks de désactivation
      await this.pluginHooksService.triggerDisableHooks(id);

      // Décharger le plugin de la mémoire
      await this.pluginRuntimeService.unloadPlugin(id);

      // Mettre à jour le statut
      plugin.status = PluginStatus.DISABLED;

      const updatedPlugin = await this.pluginRepository.save(plugin);

      // Enregistrer l'événement de désactivation
      try {
        await this.analyticsService.trackEvent(updatedPlugin.id, {
          eventType: AnalyticsEventType.DISABLE,
        });
      } catch (error: any) {
        this.logger.warn(
          `Erreur lors de l'enregistrement de l'événement de désactivation: ${error.message}`,
          'PluginsService',
        );
      }

      this.logger.log(`Plugin désactivé: ${updatedPlugin.name}`, 'PluginsService');

      return updatedPlugin;
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de la désactivation du plugin ${plugin.name}: ${error.message}`,
        'PluginsService',
      );

      // Mettre à jour le statut quand même
      plugin.status = PluginStatus.DISABLED;
      const updatedPlugin = await this.pluginRepository.save(plugin);

      throw new BadRequestException(
        `Erreur lors de la désactivation du plugin: ${error.message}`,
      );
    }
  }

  /**
   * Désinstalle un plugin
   */
  async uninstall(id: string): Promise<void> {
    const plugin = await this.findOne(id);
    await this.pluginUninstallService.uninstall(plugin);
  }

  /**
   * Met à jour la configuration d'un plugin avec validation
   */
  async updateConfig(
    id: string,
    config: Record<string, any>,
  ): Promise<Plugin> {
    return this.pluginConfigService.updateConfig(id, config);
  }

  /**
   * Marque un plugin comme étant en erreur
   */
  async markAsError(id: string, errorMessage: string): Promise<Plugin> {
    const plugin = await this.findOne(id);

    plugin.status = PluginStatus.ERROR;
    plugin.error = errorMessage;

    const updatedPlugin = await this.pluginRepository.save(plugin);

    this.logger.warn(
      `Plugin marqué comme erreur: ${updatedPlugin.name} - ${errorMessage}`,
      'PluginsService',
    );

    return updatedPlugin;
  }

  /**
   * Récupère les plugins disponibles sur le Lumy Store
   * Utilise l'endpoint public /api/plugins/public qui ne nécessite pas d'authentification
   * Selon la documentation ENDPOINTS_API_TOKEN.md
   */
  async getAvailablePluginsFromStore(
    userId: string,
    search?: string,
    category?: string,
  ): Promise<any[]> {
    try {
      const params: Record<string, any> = {};
      if (search) {
        params.search = search;
      }
      if (category) {
        params.category = category;
      }
      // Ajouter des paramètres par défaut pour la pagination
      params.limit = params.limit || 50;
      params.offset = params.offset || 0;

      // Utiliser l'endpoint public /api/plugins/public qui ne nécessite pas d'authentification
      // Si l'utilisateur est connecté, on peut aussi essayer d'obtenir les infos utilisateur
      let plugins: any[];
      
      try {
        // Essayer d'abord avec authentification pour avoir les infos utilisateur (userHasPurchased, etc.)
        // L'endpoint /api/plugins/:id avec auth retourne plus d'infos, mais pour la liste on utilise le public
        const response = await this.storeApiService.getPublic<any>(
          '/api/plugins/public',
          params,
        );

        // La méthode searchPublic du store retourne { plugins: Plugin[], total: number }
        // Vérifier le format de la réponse et extraire le tableau de plugins
        if (Array.isArray(response)) {
          plugins = response;
        } else if (response && Array.isArray(response.plugins)) {
          // Format attendu: { plugins: [...], total: number }
          plugins = response.plugins;
        } else if (response && Array.isArray(response.data)) {
          plugins = response.data;
        } else if (response && Array.isArray(response.items)) {
          plugins = response.items;
        } else {
          this.logger.warn(
            `Format de réponse inattendu du store: ${JSON.stringify(response).substring(0, 200)}`,
            'PluginsService',
          );
          plugins = [];
        }
      } catch (error: any) {
        this.logger.warn(
          `Erreur lors de la récupération des plugins publics: ${error.message}`,
          'PluginsService',
        );
        throw error;
      }

      // Note: L'endpoint public retourne les infos de base
      // Si besoin d'enrichir avec les infos utilisateur (userHasPurchased, etc.),
      // on peut faire des appels GET /api/plugins/:id avec auth pour chaque plugin
      // mais cela nécessiterait beaucoup d'appels API, donc on garde la liste publique simple

      // S'assurer que plugins est un tableau
      if (!Array.isArray(plugins)) {
        this.logger.error(
          `La réponse du store n'est pas un tableau après extraction: ${typeof plugins}, valeur: ${JSON.stringify(plugins).substring(0, 200)}`,
          'PluginsService',
        );
        plugins = [];
      }

      // Récupérer les plugins installés pour marquer ceux qui sont déjà installés
      const installedPlugins = await this.findAll();
      const installedPluginNames = new Set(
        installedPlugins.map((p) => p.name),
      );

      return plugins.map((plugin) => ({
        ...plugin,
        installed: installedPluginNames.has(plugin.name),
      }));
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de la récupération des plugins du store: ${error.message}`,
        'PluginsService',
      );
      throw error;
    }
  }

  /**
   * Récupère les détails d'un plugin depuis le Lumy Store
   * Utilise l'endpoint /api/plugins/:id avec authentification pour avoir les infos utilisateur
   * Si l'utilisateur n'est pas connecté, utilise l'endpoint public /api/plugins/public/:id
   */
  async getPluginFromStore(userId: string, pluginId: string): Promise<any> {
    try {
      let plugin: any;
      
      try {
        // Essayer d'abord avec authentification pour avoir les infos utilisateur (userHasPurchased, etc.)
        plugin = await this.storeApiService.get<any>(
          userId,
          `/api/plugins/${pluginId}`,
        );
      } catch (error: any) {
        // Si l'authentification échoue, utiliser l'endpoint public
        this.logger.debug(
          `Utilisateur non connecté, utilisation de l'endpoint public pour le plugin ${pluginId}`,
          'PluginsService',
        );
        plugin = await this.storeApiService.getPublic<any>(
          `/api/plugins/public/${pluginId}`,
        );
      }

      // Vérifier si le plugin est déjà installé
      const installedPlugin = await this.pluginRepository.findOne({
        where: { name: plugin.name },
      });

      return {
        ...plugin,
        installed: !!installedPlugin,
        installedPluginId: installedPlugin?.id,
      };
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de la récupération du plugin ${pluginId} du store: ${error.message}`,
        'PluginsService',
      );
      throw error;
    }
  }

  /**
   * Installe un plugin depuis le Lumy Store
   */
  async installFromStore(userId: string, pluginId: string, tokenStore?: string): Promise<Plugin> {
    const plugin = await this.pluginInstallService.installFromStore(
      userId,
      pluginId,
      tokenStore,
    );

    // Valider les permissions après l'installation
    if (plugin.permissions && plugin.permissions.length > 0) {
      this.pluginPermissionsService.validatePermissions(plugin.permissions);
    }

    // Activer automatiquement le plugin après l'installation
    try {
      const enabledPlugin = await this.enable(plugin.id);
      this.logger.log(
        `Plugin ${plugin.name} activé automatiquement après l'installation`,
        'PluginsService',
      );
      return enabledPlugin;
    } catch (error: any) {
      // Si l'activation échoue, retourner le plugin installé quand même
      this.logger.warn(
        `Impossible d'activer automatiquement le plugin ${plugin.name} après l'installation: ${error.message}`,
        'PluginsService',
      );
      return plugin;
    }
  }

  /**
   * Analyse les permissions d'un plugin
   */
  async analyzePermissions(id: string): Promise<{
    declared: string[];
    detected: string[];
    missing: string[];
    unnecessary: string[];
  }> {
    const plugin = await this.findOne(id);
    return this.pluginPermissionsService.compareDeclaredAndDetectedPermissions(
      plugin,
    );
  }

  /**
   * Vérifie si un plugin a une permission spécifique
   */
  hasPermission(pluginId: string, permission: string): boolean {
    // Cette méthode sera utilisée lors de l'exécution pour vérifier les permissions
    // Pour l'instant, on retourne false si le plugin n'est pas trouvé
    return false; // Sera implémenté avec le runtime
  }

  /**
   * Enregistre les extensions d'automatisation d'un plugin depuis son manifest
   */
  private async registerAutomationExtensions(plugin: Plugin): Promise<void> {
    try {
      const loadedPlugin = this.pluginRuntimeService.getLoadedPlugin(plugin.id);
      
      if (!loadedPlugin || !loadedPlugin.manifest) {
        this.logger.warn(
          `Impossible d'enregistrer les extensions d'automatisation pour ${plugin.name}: manifest non chargé`,
          'PluginsService',
        );
        return;
      }

      const manifest = loadedPlugin.manifest;
      const automationExtensions = manifest.automationExtensions || manifest.automation || [];

      if (!Array.isArray(automationExtensions) || automationExtensions.length === 0) {
        this.logger.log(
          `Aucune extension d'automatisation définie pour le plugin ${plugin.name}`,
          'PluginsService',
        );
        return;
      }

      // Enregistrer toutes les extensions
      await this.pluginAutomationExtensionService.registerExtensions(
        plugin.id,
        automationExtensions,
      );

      this.logger.log(
        `${automationExtensions.length} extension(s) d'automatisation enregistrée(s) pour le plugin ${plugin.name}`,
        'PluginsService',
      );
    } catch (error: any) {
      this.logger.warn(
        `Erreur lors de l'enregistrement des extensions d'automatisation pour ${plugin.name}: ${error.message}`,
        'PluginsService',
      );
      // Ne pas faire échouer l'activation si l'enregistrement des extensions échoue
    }
  }

  /**
   * Enregistre les extensions UI d'un plugin depuis son manifest
   */
  private async registerUIExtensions(plugin: Plugin): Promise<void> {
    try {
      const loadedPlugin = this.pluginRuntimeService.getLoadedPlugin(plugin.id);
      
      if (!loadedPlugin || !loadedPlugin.manifest) {
        this.logger.warn(
          `Impossible d'enregistrer les extensions UI pour ${plugin.name}: manifest non chargé`,
          'PluginsService',
        );
        return;
      }

      const manifest = loadedPlugin.manifest;
      const uiExtensions = manifest.uiExtensions || manifest.ui || [];

      if (!Array.isArray(uiExtensions) || uiExtensions.length === 0) {
        this.logger.log(
          `Aucune extension UI définie pour le plugin ${plugin.name}`,
          'PluginsService',
        );
        return;
      }

      // Enregistrer toutes les extensions
      await this.pluginUIExtensionService.registerExtensions(
        plugin.id,
        uiExtensions,
      );

      this.logger.log(
        `${uiExtensions.length} extension(s) UI enregistrée(s) pour le plugin ${plugin.name}`,
        'PluginsService',
      );
    } catch (error: any) {
      this.logger.warn(
        `Erreur lors de l'enregistrement des extensions UI pour ${plugin.name}: ${error.message}`,
        'PluginsService',
      );
      // Ne pas faire échouer l'activation si l'enregistrement des extensions échoue
    }
  }
}

