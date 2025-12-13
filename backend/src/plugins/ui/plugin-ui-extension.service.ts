import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PluginUIExtension,
  UIExtensionType,
  UIComponentType,
} from './plugin-ui-extension.entity';
import { Plugin } from '../entities/plugin.entity';
import { LoggerService } from '../../logger/logger.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PluginUIExtensionService {
  private readonly logger: Logger;

  constructor(
    @InjectRepository(PluginUIExtension)
    private extensionRepository: Repository<PluginUIExtension>,
    @InjectRepository(Plugin)
    private pluginRepository: Repository<Plugin>,
    private loggerService: LoggerService,
  ) {
    this.logger = new Logger(PluginUIExtensionService.name);
  }

  /**
   * Enregistre une extension UI (page, composant, widget, menu)
   */
  async registerExtension(
    pluginId: string,
    type: UIExtensionType,
    name: string,
    displayName: string,
    options?: {
      description?: string;
      route?: string;
      icon?: string;
      componentType?: UIComponentType;
      componentPath?: string;
      iframeUrl?: string;
      props?: Record<string, any>;
      permissions?: string[];
      metadata?: Record<string, any>;
      order?: number;
    },
  ): Promise<PluginUIExtension> {
    // Vérifier que le plugin existe
    const plugin = await this.pluginRepository.findOne({
      where: { id: pluginId },
    });

    if (!plugin) {
      throw new NotFoundException(`Plugin ${pluginId} non trouvé`);
    }

    // Vérifier que le nom est unique pour ce plugin
    const existing = await this.extensionRepository.findOne({
      where: { pluginId, name },
    });

    if (existing) {
      throw new BadRequestException(
        `Une extension UI avec le nom "${name}" existe déjà pour ce plugin`,
      );
    }

    // Valider selon le type
    if (type === UIExtensionType.PAGE) {
      if (!options?.route) {
        throw new BadRequestException('La route est requise pour une page');
      }
      if (!options?.componentPath && !options?.iframeUrl) {
        throw new BadRequestException(
          'componentPath ou iframeUrl est requis pour une page',
        );
      }
    }

    if (type === UIExtensionType.COMPONENT || type === UIExtensionType.WIDGET) {
      if (!options?.componentPath && !options?.iframeUrl) {
        throw new BadRequestException(
          'componentPath ou iframeUrl est requis pour un composant/widget',
        );
      }
    }

    // Vérifier que le composant existe si componentPath est fourni
    if (options?.componentPath) {
      const pluginPath = plugin.installPath;
      if (!pluginPath) {
        throw new BadRequestException(
          'Le plugin doit être installé pour utiliser un composant local',
        );
      }

      const fullComponentPath = path.join(pluginPath, options.componentPath);
      if (!fs.existsSync(fullComponentPath)) {
        throw new NotFoundException(
          `Composant non trouvé: ${options.componentPath}`,
        );
      }
    }

    // Créer l'extension
    const extension = this.extensionRepository.create({
      pluginId,
      type,
      name,
      displayName,
      description: options?.description,
      route: options?.route,
      icon: options?.icon,
      componentType: options?.componentType || UIComponentType.REACT,
      componentPath: options?.componentPath,
      iframeUrl: options?.iframeUrl,
      props: options?.props || {},
      permissions: options?.permissions || [],
      metadata: options?.metadata || {},
      enabled: true,
      order: options?.order || 0,
    });

    const saved = await this.extensionRepository.save(extension);

    this.logger.log(
      `Extension UI ${type} "${name}" enregistrée pour le plugin ${plugin.name}`,
      'PluginUIExtensionService',
    );

    return saved;
  }

  /**
   * Désenregistre une extension UI
   */
  async unregisterExtension(extensionId: string): Promise<void> {
    const extension = await this.extensionRepository.findOne({
      where: { id: extensionId },
    });

    if (!extension) {
      throw new NotFoundException('Extension UI non trouvée');
    }

    await this.extensionRepository.remove(extension);

    this.logger.log(
      `Extension UI ${extension.name} désenregistrée`,
      'PluginUIExtensionService',
    );
  }

  /**
   * Active/désactive une extension UI
   */
  async setExtensionEnabled(
    extensionId: string,
    enabled: boolean,
  ): Promise<PluginUIExtension> {
    const extension = await this.extensionRepository.findOne({
      where: { id: extensionId },
    });

    if (!extension) {
      throw new NotFoundException('Extension UI non trouvée');
    }

    extension.enabled = enabled;
    return this.extensionRepository.save(extension);
  }

  /**
   * Récupère toutes les extensions UI
   */
  async findAll(filters?: {
    pluginId?: string;
    type?: UIExtensionType;
    enabled?: boolean;
  }): Promise<PluginUIExtension[]> {
    const query = this.extensionRepository.createQueryBuilder('extension');

    if (filters?.pluginId) {
      query.andWhere('extension.pluginId = :pluginId', {
        pluginId: filters.pluginId,
      });
    }

    if (filters?.type) {
      query.andWhere('extension.type = :type', { type: filters.type });
    }

    if (filters?.enabled !== undefined) {
      query.andWhere('extension.enabled = :enabled', {
        enabled: filters.enabled,
      });
    }

    return query
      .leftJoinAndSelect('extension.plugin', 'plugin')
      .orderBy('extension.order', 'ASC')
      .addOrderBy('extension.displayName', 'ASC')
      .getMany();
  }

  /**
   * Récupère une extension UI par son ID
   */
  async findOne(id: string): Promise<PluginUIExtension> {
    const extension = await this.extensionRepository.findOne({
      where: { id },
      relations: ['plugin'],
    });

    if (!extension) {
      throw new NotFoundException('Extension UI non trouvée');
    }

    return extension;
  }

  /**
   * Récupère toutes les pages disponibles
   */
  async getAvailablePages(): Promise<PluginUIExtension[]> {
    return this.findAll({
      type: UIExtensionType.PAGE,
      enabled: true,
    });
  }

  /**
   * Récupère tous les composants disponibles
   */
  async getAvailableComponents(): Promise<PluginUIExtension[]> {
    return this.findAll({
      type: UIExtensionType.COMPONENT,
      enabled: true,
    });
  }

  /**
   * Récupère tous les widgets disponibles
   */
  async getAvailableWidgets(): Promise<PluginUIExtension[]> {
    return this.findAll({
      type: UIExtensionType.WIDGET,
      enabled: true,
    });
  }

  /**
   * Récupère tous les éléments de menu disponibles
   */
  async getAvailableMenuItems(): Promise<PluginUIExtension[]> {
    return this.findAll({
      type: UIExtensionType.MENU_ITEM,
      enabled: true,
    });
  }

  /**
   * Récupère une extension par sa route
   */
  async findByRoute(route: string): Promise<PluginUIExtension | null> {
    return this.extensionRepository.findOne({
      where: { route, enabled: true },
      relations: ['plugin'],
    });
  }

  /**
   * Met à jour l'ordre d'affichage
   */
  async updateOrder(extensionId: string, order: number): Promise<PluginUIExtension> {
    const extension = await this.findOne(extensionId);
    extension.order = order;
    return this.extensionRepository.save(extension);
  }

  /**
   * Récupère le chemin complet d'un composant
   */
  async getComponentPath(extensionId: string): Promise<string | null> {
    const extension = await this.findOne(extensionId);

    if (!extension.componentPath) {
      return null;
    }

    const plugin = extension.plugin;
    if (!plugin.installPath) {
      return null;
    }

    return path.join(plugin.installPath, extension.componentPath);
  }

  /**
   * Vérifie si un composant existe et est accessible
   */
  async validateComponent(extensionId: string): Promise<boolean> {
    const extension = await this.findOne(extensionId);

    if (extension.iframeUrl) {
      // Pour les iframes, on ne peut pas valider localement
      return true;
    }

    if (!extension.componentPath) {
      return false;
    }

    const componentPath = await this.getComponentPath(extensionId);
    if (!componentPath) {
      return false;
    }

    return fs.existsSync(componentPath);
  }
}

