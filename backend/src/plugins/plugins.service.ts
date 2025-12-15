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
   * Installe un plugin depuis le Lumy Store
   */
  async installFromStore(userId: string, pluginId: string): Promise<Plugin> {
    const plugin = await this.pluginInstallService.installFromStore(
      userId,
      pluginId,
    );

    // Valider les permissions après l'installation
    if (plugin.permissions && plugin.permissions.length > 0) {
      this.pluginPermissionsService.validatePermissions(plugin.permissions);
    }

    return plugin;
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

