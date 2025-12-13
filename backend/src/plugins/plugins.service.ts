import { Injectable, BadRequestException, NotFoundException, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plugin, PluginStatus } from './entities/plugin.entity';
import { PluginManifestDto, PluginCategory } from './dto/plugin-manifest.dto';
import { InstallPluginDto } from './dto/install-plugin.dto';
import { UpdatePluginConfigDto } from './dto/update-plugin-config.dto';
import { LoggerService } from '../logger/logger.service';
import { PluginsStoreService } from './plugins-store.service';
import { PluginPermissionsService } from './permissions/plugin-permissions.service';
import { PluginConfigService } from './configuration/plugin-config.service';
import { PluginHooksService } from './hooks/plugin-hooks.service';
import { PluginHookType } from './hooks/plugin-hooks.enum';
import { PluginDependenciesService } from './dependencies/plugin-dependencies.service';
import { PluginLoggerService } from './monitoring/plugin-logger.service';
import { PluginMonitoringService } from './monitoring/plugin-monitoring.service';
import { PluginCompatibilityService } from './compatibility/plugin-compatibility.service';
import { PluginAutomationExtensionService } from './automation/plugin-automation-extension.service';
import { PluginAnalyticsService } from './analytics/plugin-analytics.service';
import { AnalyticsEventType } from './analytics/plugin-analytics.entity';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

@Injectable()
export class PluginsService implements OnModuleInit {
  private readonly pluginsDirectory: string;
  private readonly loadedPlugins: Map<string, any> = new Map();

  constructor(
    @InjectRepository(Plugin)
    private pluginRepository: Repository<Plugin>,
    private logger: LoggerService,
    private pluginsStoreService: PluginsStoreService,
    private permissionsService: PluginPermissionsService,
    private configService: PluginConfigService,
    @Inject(forwardRef(() => PluginHooksService))
    private hooksService: PluginHooksService,
    @Inject(forwardRef(() => PluginDependenciesService))
    private dependenciesService: PluginDependenciesService,
    private pluginLogger: PluginLoggerService,
    private monitoringService: PluginMonitoringService,
    private compatibilityService: PluginCompatibilityService,
    @Inject(forwardRef(() => PluginAutomationExtensionService))
    private automationExtensionService?: PluginAutomationExtensionService,
    @Inject(forwardRef(() => PluginAnalyticsService))
    private analyticsService?: PluginAnalyticsService,
  ) {
    // Définir le répertoire des plugins
    this.pluginsDirectory = path.join(process.cwd(), 'plugins');
    
    // Créer le répertoire s'il n'existe pas
    if (!fs.existsSync(this.pluginsDirectory)) {
      fs.mkdirSync(this.pluginsDirectory, { recursive: true });
      this.logger.log(
        `[PluginsService] Répertoire plugins créé: ${this.pluginsDirectory}`,
        'PluginsService',
      );
    }
  }

  async onModuleInit() {
    // Charger tous les plugins activés au démarrage
    await this.loadAllPlugins();
    this.logger.log('Module Plugins initialisé', 'PluginsService');
  }

  /**
   * Récupère tous les plugins installés
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
    const plugin = await this.pluginRepository.findOne({ where: { id } });
    if (!plugin) {
      throw new NotFoundException(`Plugin avec l'ID ${id} non trouvé`);
    }
    return plugin;
  }

  /**
   * Récupère un plugin par son nom
   */
  async findByName(name: string): Promise<Plugin | null> {
    return this.pluginRepository.findOne({ where: { name } });
  }

  /**
   * Installe un plugin
   */
  async install(installDto: InstallPluginDto): Promise<Plugin> {
    this.logger.log(
      `[PluginsService] Installation du plugin depuis: ${installDto.source}`,
      'PluginsService',
    );

    // Vérifier si le plugin existe déjà
    const existingPlugin = await this.findByName(installDto.source);
    if (existingPlugin && !installDto.allowUpdate) {
      throw new BadRequestException(`Le plugin ${installDto.source} est déjà installé`);
    }
    
    // Si le plugin existe et qu'on permet la mise à jour, on le supprime d'abord
    if (existingPlugin && installDto.allowUpdate) {
      this.logger.log(
        `[PluginsService] Mise à jour du plugin ${existingPlugin.name} de ${existingPlugin.version} vers ${installDto.version || 'latest'}`,
        'PluginsService',
      );
      // Supprimer l'ancienne version
      await this.uninstall(existingPlugin.id);
    }

    // Récupérer les informations du plugin depuis le store ou l'URL
    let downloadUrl: string;
    let storePlugin: any = null;

    try {
      // Essayer de récupérer depuis le store
      storePlugin = await this.pluginsStoreService.findOne(installDto.source);
      downloadUrl = await this.pluginsStoreService.getDownloadUrl(
        installDto.source,
        installDto.version,
      );
    } catch (error) {
      // Si ce n'est pas dans le store, utiliser l'URL directement
      if (installDto.source.startsWith('http://') || installDto.source.startsWith('https://')) {
        downloadUrl = installDto.source;
      } else {
        throw new BadRequestException(
          `Plugin ${installDto.source} non trouvé dans le store et URL invalide`,
        );
      }
    }

    // Télécharger le plugin
    const pluginPath = await this.downloadPlugin(downloadUrl, installDto.source);

    // Extraire le plugin
    const extractedPath = await this.extractPlugin(pluginPath, installDto.source);

    // Charger et valider le manifest
    const manifestPath = path.join(extractedPath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new BadRequestException('Manifest.json non trouvé dans le plugin');
    }

    const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
    const manifestData = JSON.parse(manifestContent);
    const manifest = this.validateManifest(manifestData);

    // Vérifier et installer les dépendances
    if (manifest.dependencies && Object.keys(manifest.dependencies).length > 0) {
      try {
        await this.dependenciesService.installDependencies(manifest.name, manifest.dependencies);
      } catch (error) {
        throw new BadRequestException(
          `Erreur lors de l'installation des dépendances: ${error.message}`,
        );
      }
    }

    // Créer le plugin dans la base de données
    const plugin = this.pluginRepository.create({
      name: manifest.name,
      displayName: manifest.displayName,
      version: manifest.version,
      description: manifest.description || storePlugin?.description,
      author: manifest.author || storePlugin?.author,
      icon: manifest.icon || storePlugin?.icon,
      repository: manifest.repository || storePlugin?.repository,
      lumyVersion: manifest.lumyVersion,
      dependencies: manifest.dependencies,
      permissions: manifest.permissions,
      status: PluginStatus.INSTALLED,
      config: installDto.config || {},
      installPath: extractedPath,
      metadata: {
        category: manifest.category || storePlugin?.category,
        tags: manifest.tags || storePlugin?.tags,
      },
    });

    const savedPlugin = await this.pluginRepository.save(plugin);

    // Nettoyer le fichier ZIP téléchargé
    if (fs.existsSync(pluginPath)) {
      fs.unlinkSync(pluginPath);
    }

    this.logger.log(
      `[PluginsService] Plugin ${savedPlugin.name} installé avec succès`,
      'PluginsService',
    );

    // Déclencher l'événement plugin:installed
    await this.hooksService.triggerHook(PluginHookType.PLUGIN_INSTALLED, {
      pluginId: savedPlugin.id,
      pluginName: savedPlugin.name,
      version: savedPlugin.version,
    }, 'plugins');

    this.pluginLogger.log(savedPlugin.id, savedPlugin.name, 'info', 'Plugin installed', {
      version: savedPlugin.version,
    });

    return savedPlugin;
  }

  /**
   * Télécharge un plugin depuis une URL
   */
  private async downloadPlugin(url: string, pluginName: string): Promise<string> {
    this.logger.log(`[PluginsService] Téléchargement du plugin depuis: ${url}`, 'PluginsService');

    const tempDir = path.join(this.pluginsDirectory, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const zipPath = path.join(tempDir, `${pluginName}.zip`);

    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(zipPath);
      const protocol = url.startsWith('https') ? https : http;

      protocol
        .get(url, (response) => {
          if (response.statusCode === 301 || response.statusCode === 302) {
            // Suivre les redirections
            return this.downloadPlugin(response.headers.location || url, pluginName)
              .then(resolve)
              .catch(reject);
          }

          if (response.statusCode !== 200) {
            reject(new BadRequestException(`Erreur HTTP ${response.statusCode}`));
            return;
          }

          response.pipe(file);

          file.on('finish', () => {
            file.close();
            this.logger.log(`[PluginsService] Plugin téléchargé: ${zipPath}`, 'PluginsService');
            resolve(zipPath);
          });
        })
        .on('error', (error) => {
          fs.unlinkSync(zipPath);
          reject(new BadRequestException(`Erreur lors du téléchargement: ${error.message}`));
        });
    });
  }

  /**
   * Extrait un plugin depuis une archive ZIP
   */
  private async extractPlugin(zipPath: string, pluginName: string): Promise<string> {
    this.logger.log(`[PluginsService] Extraction du plugin: ${zipPath}`, 'PluginsService');

    const extractPath = path.join(this.pluginsDirectory, pluginName);

    // Créer le répertoire d'extraction
    if (fs.existsSync(extractPath)) {
      fs.rmSync(extractPath, { recursive: true, force: true });
    }
    fs.mkdirSync(extractPath, { recursive: true });

    try {
      // Essayer d'utiliser adm-zip si disponible
      let AdmZip: any;
      try {
        AdmZip = require('adm-zip');
      } catch (error) {
        // Si adm-zip n'est pas installé, on ne peut pas extraire
        throw new BadRequestException(
          'Le module adm-zip est requis pour extraire les plugins. Installez-le avec: npm install adm-zip',
        );
      }

      // Extraire avec adm-zip
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(extractPath, true);

      this.logger.log(
        `[PluginsService] Plugin extrait avec succès: ${extractPath}`,
        'PluginsService',
      );

      return extractPath;
    } catch (error) {
      // Nettoyer en cas d'erreur
      if (fs.existsSync(extractPath)) {
        fs.rmSync(extractPath, { recursive: true, force: true });
      }
      throw new BadRequestException(`Erreur lors de l'extraction: ${error.message}`);
    }
  }


  /**
   * Active un plugin
   */
  async enable(id: string): Promise<Plugin> {
    const plugin = await this.findOne(id);
    
    if (plugin.status === PluginStatus.ENABLED) {
      return plugin;
    }

    // Charger le plugin
    try {
      await this.loadPlugin(plugin);
    } catch (error) {
      plugin.status = PluginStatus.ERROR;
      plugin.error = error.message;
      await this.pluginRepository.save(plugin);
      throw error;
    }

    // Enregistrer les hooks du plugin
    this.hooksService.registerPluginHooks(plugin);

    // Charger les handlers d'extensions d'automation
    if (this.automationExtensionService) {
      await this.automationExtensionService.loadPluginHandlers(plugin.id);
    }

    // Initialiser le monitoring
    this.monitoringService.initializeMetrics(plugin);

    // Déclencher l'événement plugin:enabled
    await this.hooksService.triggerHook(PluginHookType.PLUGIN_ENABLED, {
      pluginId: plugin.id,
      pluginName: plugin.name,
      version: plugin.version,
    }, 'plugins');

    this.pluginLogger.log(plugin.id, plugin.name, 'info', 'Plugin enabled');

    plugin.status = PluginStatus.ENABLED;
    plugin.error = null;
    
    const updatedPlugin = await this.pluginRepository.save(plugin);
    
    this.logger.log(
      `[PluginsService] Plugin ${updatedPlugin.name} activé`,
      'PluginsService',
    );

    return updatedPlugin;
  }

  /**
   * Désactive un plugin
   */
  async disable(id: string): Promise<Plugin> {
    const plugin = await this.findOne(id);
    
    if (plugin.status === PluginStatus.DISABLED || plugin.status === PluginStatus.INSTALLED) {
      return plugin;
    }

    // Déclencher l'événement plugin:disabled avant la désactivation
    await this.hooksService.triggerHook(PluginHookType.PLUGIN_DISABLED, {
      pluginId: plugin.id,
      pluginName: plugin.name,
      version: plugin.version,
    }, 'plugins');

    // Désenregistrer les hooks du plugin
    this.hooksService.unregisterPluginHooks(plugin.id);

    // Décharger les handlers d'extensions d'automation
    if (this.automationExtensionService) {
      await this.automationExtensionService.unloadPluginHandlers(plugin.id);
    }

    // Arrêter le monitoring
    this.monitoringService.removeMetrics(plugin.id);
    this.pluginLogger.closeLogStream(plugin.id);
    this.pluginLogger.log(plugin.id, plugin.name, 'info', 'Plugin disabled');

    // Décharger le plugin
    try {
      await this.unloadPlugin(plugin);
    } catch (error) {
      this.logger.error(
        `[PluginsService] Erreur lors du déchargement du plugin ${plugin.name}: ${error.message}`,
        error.stack,
        'PluginsService',
      );
    }

    plugin.status = PluginStatus.DISABLED;
    
    const updatedPlugin = await this.pluginRepository.save(plugin);
    
    this.logger.log(
      `[PluginsService] Plugin ${updatedPlugin.name} désactivé`,
      'PluginsService',
    );

    return updatedPlugin;
  }

  /**
   * Met à jour la configuration d'un plugin
   */
  async updateConfig(id: string, updateConfigDto: UpdatePluginConfigDto): Promise<Plugin> {
    const plugin = await this.findOne(id);
    
    // Récupérer le schéma de configuration depuis les métadonnées
    const configSchema = plugin.metadata?.configSchema;

    // Valider et normaliser la configuration
    let finalConfig = updateConfigDto.config;
    if (configSchema) {
      const validation = this.configService.validateAndNormalize(
        finalConfig,
        configSchema,
      );
      if (validation.errors.length > 0) {
        throw new BadRequestException(
          `Configuration invalide: ${validation.errors.join(', ')}`,
        );
      }
      finalConfig = validation.config;
    }
    
    plugin.config = finalConfig;
    
    const updatedPlugin = await this.pluginRepository.save(plugin);
    
    this.logger.log(
      `[PluginsService] Configuration du plugin ${updatedPlugin.name} mise à jour`,
      'PluginsService',
    );

    return updatedPlugin;
  }

  /**
   * Récupère le schéma de configuration d'un plugin
   */
  async getConfigSchema(id: string): Promise<any> {
    const plugin = await this.findOne(id);
    return plugin.metadata?.configSchema || null;
  }

  /**
   * Valide une configuration pour un plugin
   */
  async validatePluginConfig(id: string, config: any): Promise<{ valid: boolean; errors: string[] }> {
    const plugin = await this.findOne(id);
    const configSchema = plugin.metadata?.configSchema;

    if (!configSchema) {
      return { valid: true, errors: [] };
    }

    const validation = this.configService.validateAndNormalize(config, configSchema);
    return {
      valid: validation.errors.length === 0,
      errors: validation.errors,
    };
  }

  /**
   * Désinstalle un plugin
   */
  async uninstall(id: string): Promise<void> {
    const plugin = await this.findOne(id);
    
    // Vérifier si le plugin peut être désinstallé (pas de dépendants)
    const { canUninstall, dependents } = await this.dependenciesService.canUninstall(id);
    if (!canUninstall) {
      throw new BadRequestException(
        `Le plugin ${plugin.name} ne peut pas être désinstallé car il est requis par: ${dependents.map((p) => p.name).join(', ')}`,
      );
    }
    
    // Désactiver le plugin s'il est activé
    if (plugin.status === PluginStatus.ENABLED) {
      await this.disable(id);
    }

    // Désenregistrer les hooks
    this.hooksService.unregisterPluginHooks(plugin.id);
    
    // Décharger les handlers d'extensions d'automation
    if (this.automationExtensionService) {
      await this.automationExtensionService.unloadPluginHandlers(plugin.id);
    }
    // Décharger les handlers d'extensions d'automation
    if (this.automationExtensionService) {
      await this.automationExtensionService.unloadPluginHandlers(plugin.id);
    }

    // Arrêter le monitoring et fermer les logs
    this.monitoringService.removeMetrics(plugin.id);
    this.pluginLogger.closeLogStream(plugin.id);

    // Déclencher l'événement plugin:uninstalled
    await this.hooksService.triggerHook(PluginHookType.PLUGIN_UNINSTALLED, {
      pluginId: plugin.id,
      pluginName: plugin.name,
      version: plugin.version,
    }, 'plugins');
    
    this.pluginLogger.log(plugin.id, plugin.name, 'info', 'Plugin uninstalled');
    
    // TODO: Supprimer les fichiers
    
    await this.pluginRepository.remove(plugin);
    
    this.logger.log(
      `[PluginsService] Plugin ${plugin.name} désinstallé`,
      'PluginsService',
    );

    // Enregistrer l'événement de désinstallation
    if (this.analyticsService) {
      await this.analyticsService.recordEvent(
        plugin.id,
        AnalyticsEventType.UNINSTALL,
        { version: plugin.version },
      );
    }
  }

  /**
   * Charge un plugin depuis le système de fichiers
   */
  private async loadPlugin(plugin: Plugin): Promise<void> {
    if (this.loadedPlugins.has(plugin.name)) {
      return;
    }

    const pluginPath = plugin.installPath;
    if (!pluginPath || !fs.existsSync(pluginPath)) {
      throw new NotFoundException(`Répertoire du plugin non trouvé: ${pluginPath}`);
    }

    const manifestPath = path.join(pluginPath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new NotFoundException(`Manifest non trouvé: ${manifestPath}`);
    }

    // Charger et valider le manifest
    let manifest: PluginManifestDto;
    try {
      const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
      const manifestData = JSON.parse(manifestContent);
      manifest = this.validateManifest(manifestData);
    } catch (error) {
      throw new BadRequestException(`Erreur lors du chargement du manifest: ${error.message}`);
    }

    // Vérifier la compatibilité de version
    if (manifest.lumyVersion) {
      const compatibility = this.compatibilityService.checkCompatibility(manifest.lumyVersion);
      if (!compatibility.compatible) {
        let errorMessage = `Version de Lumy Home incompatible. Requis: ${manifest.lumyVersion}, Actuel: ${compatibility.currentVersion}`;
        
        if (compatibility.breakingChanges && compatibility.breakingChanges.length > 0) {
          errorMessage += `\nBreaking changes détectés: ${compatibility.breakingChanges.join(', ')}`;
        }
        
        if (compatibility.migrationGuide) {
          errorMessage += `\nGuide de migration: ${compatibility.migrationGuide}`;
        }
        
        throw new BadRequestException(errorMessage);
      }
    }

    // Charger le code du plugin si un point d'entrée est défini
    let pluginInstance: any = null;
    if (manifest.main) {
      const mainPath = path.join(pluginPath, manifest.main);
      if (!fs.existsSync(mainPath)) {
        this.logger.warn(
          `[PluginsService] Point d'entrée ${manifest.main} non trouvé pour le plugin ${plugin.name}`,
          'PluginsService',
        );
      } else {
        // TODO: Charger le code dans un sandbox sécurisé
        // Pour l'instant, on ne charge pas le code pour des raisons de sécurité
        this.logger.log(
          `[PluginsService] Point d'entrée trouvé: ${manifest.main} (non chargé - sandboxing à implémenter)`,
          'PluginsService',
        );
      }
    }

    // Enregistrer le plugin chargé
    this.loadedPlugins.set(plugin.name, {
      plugin,
      manifest,
      instance: pluginInstance,
      loaded: true,
      loadedAt: new Date(),
    });

    // Enregistrer les hooks si le plugin est activé
    if (plugin.status === PluginStatus.ENABLED) {
      this.hooksService.registerPluginHooks(plugin);
    }

    this.logger.log(
      `[PluginsService] Plugin ${plugin.name} chargé avec succès`,
      'PluginsService',
    );
  }


  /**
   * Vérifie que les dépendances sont installées
   */
  private async checkDependencies(dependencies: Record<string, string>): Promise<void> {
    for (const [depName, depVersion] of Object.entries(dependencies)) {
      const depPlugin = await this.findByName(depName);
      if (!depPlugin) {
        throw new BadRequestException(`Dépendance manquante: ${depName}@${depVersion}`);
      }
      // TODO: Vérifier la version de la dépendance
    }
  }

  /**
   * Valide le manifest d'un plugin
   */
  private validateManifest(manifest: any): PluginManifestDto {
    if (!manifest.name || !manifest.version || !manifest.displayName) {
      throw new BadRequestException('Manifest invalide: name, version et displayName sont requis');
    }

    // Valider le format du nom (alphanumeric, -, _)
    if (!/^[a-z0-9-_]+$/.test(manifest.name)) {
      throw new BadRequestException('Le nom du plugin doit contenir uniquement des lettres minuscules, chiffres, tirets et underscores');
    }

    // Valider le format de la version (semver)
    if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
      throw new BadRequestException('La version doit suivre le format semver (ex: 1.0.0)');
    }

    // Valider les permissions si définies
    if (manifest.permissions && !Array.isArray(manifest.permissions)) {
      throw new BadRequestException('Les permissions doivent être un tableau');
    }

    // Valider les dépendances si définies
    if (manifest.dependencies && typeof manifest.dependencies !== 'object') {
      throw new BadRequestException('Les dépendances doivent être un objet');
    }

    return manifest as PluginManifestDto;
  }

  /**
   * Vérifie si un plugin a une permission spécifique
   */
  async checkPluginPermission(pluginId: string, permission: string): Promise<boolean> {
    const plugin = await this.findOne(pluginId);
    if (!plugin.permissions || plugin.permissions.length === 0) {
      return false;
    }
    return this.permissionsService.hasPermission(plugin.permissions, permission as any);
  }

  /**
   * Obtient l'analyse des permissions d'un plugin
   */
  async getPluginPermissionsAnalysis(pluginId: string): Promise<any> {
    const plugin = await this.findOne(pluginId);
    if (!plugin.permissions || plugin.permissions.length === 0) {
      return null;
    }
    return this.permissionsService.analyzePermissions(plugin.permissions);
  }

  /**
   * Charge tous les plugins installés au démarrage
   */
  async loadAllPlugins(): Promise<void> {
    const plugins = await this.findAll();
    for (const plugin of plugins) {
      if (plugin.status === PluginStatus.ENABLED) {
        try {
          await this.loadPlugin(plugin);
        } catch (error) {
          this.logger.error(
            `[PluginsService] Erreur lors du chargement du plugin ${plugin.name}: ${error.message}`,
            error.stack,
            'PluginsService',
          );
          // Marquer le plugin comme étant en erreur
          plugin.status = PluginStatus.ERROR;
          plugin.error = error.message;
          await this.pluginRepository.save(plugin);
        }
      }
    }
    this.logger.log(
      `[PluginsService] ${this.loadedPlugins.size} plugin(s) chargé(s)`,
      'PluginsService',
    );
  }

  /**
   * Décharge un plugin
   */
  private async unloadPlugin(plugin: Plugin): Promise<void> {
    if (!this.loadedPlugins.has(plugin.name)) {
      return;
    }

    const loadedPlugin = this.loadedPlugins.get(plugin.name);
    
    // TODO: Appeler le hook onPluginUnload si disponible
    // TODO: Nettoyer les ressources du plugin

    this.loadedPlugins.delete(plugin.name);

    this.logger.log(
      `[PluginsService] Plugin ${plugin.name} déchargé`,
      'PluginsService',
    );
  }
}

