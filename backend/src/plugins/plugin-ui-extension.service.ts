import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PluginUIExtension, UIExtensionType } from './entities/plugin-ui-extension.entity';
import { Plugin, PluginStatus } from './entities/plugin.entity';
import { LoggerService } from '../logger/logger.service';

export interface UIExtensionDefinition {
  type: UIExtensionType;
  name: string;
  displayName: string;
  description?: string;
  route?: string;
  componentPath?: string;
  icon?: string;
  menuPath?: string;
  menuOrder?: number;
  props?: Record<string, any>;
  metadata?: Record<string, any>;
}

@Injectable()
export class PluginUIExtensionService {
  private readonly logger: Logger;

  constructor(
    @InjectRepository(PluginUIExtension)
    private uiExtensionRepository: Repository<PluginUIExtension>,
    @InjectRepository(Plugin)
    private pluginRepository: Repository<Plugin>,
    private loggerService: LoggerService,
  ) {
    this.logger = new Logger(PluginUIExtensionService.name);
  }

  /**
   * Enregistre une extension UI pour un plugin
   */
  async registerExtension(
    pluginId: string,
    extension: UIExtensionDefinition,
  ): Promise<PluginUIExtension> {
    const plugin = await this.pluginRepository.findOne({
      where: { id: pluginId },
    });

    if (!plugin) {
      throw new NotFoundException(`Plugin ${pluginId} non trouvé`);
    }

    // Vérifier que le plugin est activé ou en cours d'installation
    // Permettre INSTALLED car on peut enregistrer les extensions lors de l'activation
    if (plugin.status !== PluginStatus.ENABLED && plugin.status !== PluginStatus.INSTALLED) {
      throw new BadRequestException(
        `Le plugin ${plugin.name} doit être activé ou installé pour enregistrer des extensions UI`,
      );
    }

    // Vérifier les champs requis selon le type
    this.validateExtensionDefinition(extension);

    // Vérifier si l'extension existe déjà
    const existing = await this.uiExtensionRepository.findOne({
      where: {
        pluginId,
        name: extension.name,
      },
    });

    if (existing) {
      // Mettre à jour l'extension existante
      existing.displayName = extension.displayName;
      existing.description = extension.description ?? null;
      existing.route = extension.route ?? null;
      existing.componentPath = extension.componentPath ?? null;
      existing.icon = extension.icon ?? null;
      existing.menuPath = extension.menuPath ?? null;
      existing.menuOrder = extension.menuOrder ?? null;
      existing.props = extension.props ?? null;
      existing.metadata = extension.metadata ?? null;

      const updated = await this.uiExtensionRepository.save(existing);

      this.logger.log(
        `Extension UI "${extension.name}" mise à jour pour le plugin ${plugin.name}`,
        'PluginUIExtensionService',
      );

      return updated;
    }

    // Créer une nouvelle extension
    const uiExtension = this.uiExtensionRepository.create({
      pluginId,
      type: extension.type,
      name: extension.name,
      displayName: extension.displayName,
      description: extension.description ?? null,
      route: extension.route ?? null,
      componentPath: extension.componentPath ?? null,
      icon: extension.icon ?? null,
      menuPath: extension.menuPath ?? null,
      menuOrder: extension.menuOrder ?? null,
      props: extension.props ?? null,
      metadata: extension.metadata ?? null,
      enabled: true,
    });

    const saved = await this.uiExtensionRepository.save(uiExtension);

    this.logger.log(
      `Extension UI "${extension.name}" enregistrée pour le plugin ${plugin.name}`,
      'PluginUIExtensionService',
    );

    return saved;
  }

  /**
   * Enregistre plusieurs extensions UI pour un plugin
   */
  async registerExtensions(
    pluginId: string,
    extensions: UIExtensionDefinition[],
  ): Promise<PluginUIExtension[]> {
    const results: PluginUIExtension[] = [];

    for (const extension of extensions) {
      const result = await this.registerExtension(pluginId, extension);
      results.push(result);
    }

    return results;
  }

  /**
   * Récupère toutes les extensions UI d'un plugin
   */
  async getPluginExtensions(
    pluginId: string,
    type?: UIExtensionType,
  ): Promise<PluginUIExtension[]> {
    const where: any = { pluginId, enabled: true };

    if (type) {
      where.type = type;
    }

    return this.uiExtensionRepository.find({
      where,
      order: { menuOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  /**
   * Récupère toutes les extensions UI de tous les plugins activés
   */
  async getAllExtensions(type?: UIExtensionType): Promise<PluginUIExtension[]> {
    // Récupérer tous les plugins activés
    const enabledPlugins = await this.pluginRepository.find({
      where: { status: PluginStatus.ENABLED },
    });

    const pluginIds = enabledPlugins.map((p) => p.id);

    if (pluginIds.length === 0) {
      return [];
    }

    return this.uiExtensionRepository
      .createQueryBuilder('extension')
      .where('extension.pluginId IN (:...pluginIds)', { pluginIds })
      .andWhere('extension.enabled = :enabled', { enabled: true })
      .andWhere(type ? 'extension.type = :type' : '1=1', { type })
      .orderBy('extension.menuOrder', 'ASC')
      .addOrderBy('extension.createdAt', 'ASC')
      .getMany();
  }

  /**
   * Récupère toutes les pages disponibles
   */
  async getAvailablePages(): Promise<PluginUIExtension[]> {
    return this.getAllExtensions(UIExtensionType.PAGE);
  }

  /**
   * Récupère tous les widgets disponibles
   */
  async getAvailableWidgets(): Promise<PluginUIExtension[]> {
    return this.getAllExtensions(UIExtensionType.WIDGET);
  }

  /**
   * Récupère tous les éléments de menu disponibles
   */
  async getAvailableMenuItems(): Promise<PluginUIExtension[]> {
    return this.getAllExtensions(UIExtensionType.MENU_ITEM);
  }

  /**
   * Récupère toutes les extensions de type composant
   */
  async getAvailableComponents(): Promise<PluginUIExtension[]> {
    return this.getAllExtensions(UIExtensionType.COMPONENT);
  }

  /**
   * Récupère une extension par son ID
   */
  async getExtension(id: string): Promise<PluginUIExtension> {
    const extension = await this.uiExtensionRepository.findOne({
      where: { id },
      relations: ['plugin'],
    });

    if (!extension) {
      throw new NotFoundException(`Extension UI ${id} non trouvée`);
    }

    return extension;
  }

  /**
   * Active ou désactive une extension
   */
  async setExtensionEnabled(
    id: string,
    enabled: boolean,
  ): Promise<PluginUIExtension> {
    const extension = await this.getExtension(id);
    extension.enabled = enabled;
    return this.uiExtensionRepository.save(extension);
  }

  /**
   * Supprime une extension UI
   */
  async removeExtension(id: string): Promise<void> {
    const extension = await this.getExtension(id);
    await this.uiExtensionRepository.remove(extension);

    this.logger.log(
      `Extension UI "${extension.name}" supprimée`,
      'PluginUIExtensionService',
    );
  }

  /**
   * Supprime toutes les extensions d'un plugin
   */
  async removePluginExtensions(pluginId: string): Promise<void> {
    const extensions = await this.uiExtensionRepository.find({
      where: { pluginId },
    });

    if (extensions.length > 0) {
      await this.uiExtensionRepository.remove(extensions);

      this.logger.log(
        `${extensions.length} extension(s) UI supprimée(s) pour le plugin ${pluginId}`,
        'PluginUIExtensionService',
      );
    }
  }

  /**
   * Valide la définition d'une extension
   */
  private validateExtensionDefinition(extension: UIExtensionDefinition): void {
    if (!extension.type) {
      throw new BadRequestException('Le type d\'extension est requis');
    }

    if (!extension.name) {
      throw new BadRequestException('Le nom de l\'extension est requis');
    }

    if (!extension.displayName) {
      throw new BadRequestException('Le nom d\'affichage est requis');
    }

    // Validation selon le type
    switch (extension.type) {
      case UIExtensionType.PAGE:
        if (!extension.route) {
          throw new BadRequestException(
            'La route est requise pour une extension de type PAGE',
          );
        }
        if (!extension.componentPath) {
          throw new BadRequestException(
            'Le chemin du composant est requis pour une extension de type PAGE',
          );
        }
        break;

      case UIExtensionType.COMPONENT:
        if (!extension.componentPath) {
          throw new BadRequestException(
            'Le chemin du composant est requis pour une extension de type COMPONENT',
          );
        }
        break;

      case UIExtensionType.WIDGET:
        if (!extension.componentPath) {
          throw new BadRequestException(
            'Le chemin du composant est requis pour une extension de type WIDGET',
          );
        }
        break;

      case UIExtensionType.MENU_ITEM:
        if (!extension.menuPath) {
          throw new BadRequestException(
            'Le chemin du menu est requis pour une extension de type MENU_ITEM',
          );
        }
        break;
    }

    // Valider le format du nom (slug)
    const nameRegex = /^[a-z0-9-]+$/;
    if (!nameRegex.test(extension.name)) {
      throw new BadRequestException(
        'Le nom de l\'extension doit être un slug valide (lettres minuscules, chiffres et tirets uniquement)',
      );
    }
  }
}

