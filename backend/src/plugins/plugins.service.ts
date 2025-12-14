import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plugin, PluginStatus } from './entities/plugin.entity';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class PluginsService {
  private readonly logger: Logger;

  constructor(
    @InjectRepository(Plugin)
    private pluginRepository: Repository<Plugin>,
    private loggerService: LoggerService,
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

    plugin.status = PluginStatus.ENABLED;
    plugin.error = '';

    const updatedPlugin = await this.pluginRepository.save(plugin);

    this.logger.log(`Plugin activé: ${updatedPlugin.name}`, 'PluginsService');

    return updatedPlugin;
  }

  /**
   * Désactive un plugin
   */
  async disable(id: string): Promise<Plugin> {
    const plugin = await this.findOne(id);

    if (plugin.status === PluginStatus.DISABLED) {
      throw new BadRequestException('Le plugin est déjà désactivé');
    }

    plugin.status = PluginStatus.DISABLED;

    const updatedPlugin = await this.pluginRepository.save(plugin);

    this.logger.log(`Plugin désactivé: ${updatedPlugin.name}`, 'PluginsService');

    return updatedPlugin;
  }

  /**
   * Désinstalle un plugin
   */
  async uninstall(id: string): Promise<void> {
    const plugin = await this.findOne(id);

    // Vérifier que le plugin n'est pas activé
    if (plugin.status === PluginStatus.ENABLED) {
      throw new BadRequestException(
        'Le plugin doit être désactivé avant d\'être désinstallé',
      );
    }

    // Supprimer le plugin de la base de données
    await this.pluginRepository.remove(plugin);

    this.logger.log(`Plugin désinstallé: ${plugin.name}`, 'PluginsService');
  }

  /**
   * Met à jour la configuration d'un plugin
   */
  async updateConfig(
    id: string,
    config: Record<string, any>,
  ): Promise<Plugin> {
    const plugin = await this.findOne(id);

    plugin.config = { ...plugin.config, ...config };

    const updatedPlugin = await this.pluginRepository.save(plugin);

    this.logger.log(
      `Configuration mise à jour pour: ${updatedPlugin.name}`,
      'PluginsService',
    );

    return updatedPlugin;
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
}

