import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PluginAutomationExtension,
  ExtensionType,
} from './plugin-automation-extension.entity';
import { Plugin } from '../entities/plugin.entity';
import { LoggerService } from '../../logger/logger.service';
import { PluginHooksService } from '../hooks/plugin-hooks.service';
import * as fs from 'fs';
import * as path from 'path';

export interface TriggerHandler {
  (config: any, context: any): Promise<boolean>;
}

export interface ActionHandler {
  (config: any, context: any): Promise<void>;
}

@Injectable()
export class PluginAutomationExtensionService {
  private readonly logger: Logger;
  private readonly triggerHandlers: Map<string, TriggerHandler> = new Map();
  private readonly actionHandlers: Map<string, ActionHandler> = new Map();

  constructor(
    @InjectRepository(PluginAutomationExtension)
    private extensionRepository: Repository<PluginAutomationExtension>,
    @InjectRepository(Plugin)
    private pluginRepository: Repository<Plugin>,
    private loggerService: LoggerService,
    private hooksService: PluginHooksService,
  ) {
    this.logger = new Logger(PluginAutomationExtensionService.name);
  }

  /**
   * Enregistre une extension d'automation (trigger ou action)
   */
  async registerExtension(
    pluginId: string,
    type: ExtensionType,
    name: string,
    displayName: string,
    configSchema: any,
    handlerPath?: string,
    description?: string,
    metadata?: Record<string, any>,
  ): Promise<PluginAutomationExtension> {
    // Vérifier que le plugin existe
    const plugin = await this.pluginRepository.findOne({
      where: { id: pluginId },
    });

    if (!plugin) {
      throw new NotFoundException(`Plugin ${pluginId} non trouvé`);
    }

    // Vérifier que le nom est unique
    const existing = await this.extensionRepository.findOne({
      where: { name },
    });

    if (existing) {
      throw new BadRequestException(
        `Une extension avec le nom "${name}" existe déjà`,
      );
    }

    // Valider le schéma de configuration
    if (!configSchema || typeof configSchema !== 'object') {
      throw new BadRequestException('Le schéma de configuration est requis');
    }

    // Vérifier que le handler existe si fourni
    if (handlerPath) {
      const pluginPath = plugin.installPath;
      if (!pluginPath) {
        throw new BadRequestException(
          'Le plugin doit être installé pour utiliser un handler',
        );
      }

      const fullHandlerPath = path.join(pluginPath, handlerPath);
      if (!fs.existsSync(fullHandlerPath)) {
        throw new NotFoundException(
          `Handler non trouvé: ${handlerPath}`,
        );
      }
    }

    // Créer l'extension
    const extension = this.extensionRepository.create({
      pluginId,
      type,
      name,
      displayName,
      description,
      configSchema,
      handlerPath,
      metadata: metadata || {},
      enabled: true,
    });

    const saved = await this.extensionRepository.save(extension);

    // Charger le handler si fourni
    if (handlerPath && plugin.status === 'enabled') {
      await this.loadHandler(saved);
    }

    this.logger.log(
      `Extension ${type} "${name}" enregistrée pour le plugin ${plugin.name}`,
      'PluginAutomationExtensionService',
    );

    return saved;
  }

  /**
   * Charge un handler depuis le plugin
   */
  private async loadHandler(
    extension: PluginAutomationExtension,
  ): Promise<void> {
    if (!extension.handlerPath) {
      return;
    }

    const plugin = await this.pluginRepository.findOne({
      where: { id: extension.pluginId },
    });

    if (!plugin || !plugin.installPath) {
      return;
    }

    const fullHandlerPath = path.join(plugin.installPath, extension.handlerPath);

    try {
      // TODO: Implémenter le chargement sécurisé du handler
      // Pour l'instant, on enregistre juste le chemin
      this.logger.log(
        `Handler enregistré pour l'extension ${extension.name}: ${extension.handlerPath}`,
        'PluginAutomationExtensionService',
      );
    } catch (error) {
      this.logger.error(
        `Erreur lors du chargement du handler pour ${extension.name}: ${error.message}`,
        error.stack,
        'PluginAutomationExtensionService',
      );
    }
  }

  /**
   * Désenregistre une extension
   */
  async unregisterExtension(extensionId: string): Promise<void> {
    const extension = await this.extensionRepository.findOne({
      where: { id: extensionId },
    });

    if (!extension) {
      throw new NotFoundException('Extension non trouvée');
    }

    // Supprimer les handlers enregistrés
    if (extension.type === ExtensionType.TRIGGER) {
      this.triggerHandlers.delete(extension.name);
    } else {
      this.actionHandlers.delete(extension.name);
    }

    await this.extensionRepository.remove(extension);

    this.logger.log(
      `Extension ${extension.name} désenregistrée`,
      'PluginAutomationExtensionService',
    );
  }

  /**
   * Active/désactive une extension
   */
  async setExtensionEnabled(
    extensionId: string,
    enabled: boolean,
  ): Promise<PluginAutomationExtension> {
    const extension = await this.extensionRepository.findOne({
      where: { id: extensionId },
    });

    if (!extension) {
      throw new NotFoundException('Extension non trouvée');
    }

    extension.enabled = enabled;
    const saved = await this.extensionRepository.save(extension);

    // Charger/décharger le handler
    if (enabled) {
      await this.loadHandler(saved);
    } else {
      if (extension.type === ExtensionType.TRIGGER) {
        this.triggerHandlers.delete(extension.name);
      } else {
        this.actionHandlers.delete(extension.name);
      }
    }

    return saved;
  }

  /**
   * Récupère toutes les extensions
   */
  async findAll(filters?: {
    pluginId?: string;
    type?: ExtensionType;
    enabled?: boolean;
  }): Promise<PluginAutomationExtension[]> {
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
      .orderBy('extension.displayName', 'ASC')
      .getMany();
  }

  /**
   * Récupère une extension par son nom
   */
  async findByName(name: string): Promise<PluginAutomationExtension | null> {
    return this.extensionRepository.findOne({
      where: { name },
      relations: ['plugin'],
    });
  }

  /**
   * Récupère une extension par son ID
   */
  async findOne(id: string): Promise<PluginAutomationExtension> {
    const extension = await this.extensionRepository.findOne({
      where: { id },
      relations: ['plugin'],
    });

    if (!extension) {
      throw new NotFoundException('Extension non trouvée');
    }

    return extension;
  }

  /**
   * Récupère toutes les extensions de triggers disponibles
   */
  async getAvailableTriggers(): Promise<PluginAutomationExtension[]> {
    return this.findAll({
      type: ExtensionType.TRIGGER,
      enabled: true,
    });
  }

  /**
   * Récupère toutes les extensions d'actions disponibles
   */
  async getAvailableActions(): Promise<PluginAutomationExtension[]> {
    return this.findAll({
      type: ExtensionType.ACTION,
      enabled: true,
    });
  }

  /**
   * Vérifie si un trigger personnalisé est satisfait
   */
  async checkCustomTrigger(
    triggerName: string,
    config: any,
    context: any,
  ): Promise<boolean> {
    const handler = this.triggerHandlers.get(triggerName);

    if (!handler) {
      // Si le handler n'est pas chargé, essayer de le charger
      const extension = await this.findByName(triggerName);
      if (extension && extension.enabled && extension.handlerPath) {
        await this.loadHandler(extension);
        const reloadedHandler = this.triggerHandlers.get(triggerName);
        if (reloadedHandler) {
          return reloadedHandler(config, context);
        }
      }

      this.logger.warn(
        `Handler non trouvé pour le trigger personnalisé: ${triggerName}`,
        'PluginAutomationExtensionService',
      );
      return false;
    }

    try {
      return await handler(config, context);
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'exécution du trigger ${triggerName}: ${error.message}`,
        error.stack,
        'PluginAutomationExtensionService',
      );
      return false;
    }
  }

  /**
   * Exécute une action personnalisée
   */
  async executeCustomAction(
    actionName: string,
    config: any,
    context: any,
  ): Promise<void> {
    const handler = this.actionHandlers.get(actionName);

    if (!handler) {
      // Si le handler n'est pas chargé, essayer de le charger
      const extension = await this.findByName(actionName);
      if (extension && extension.enabled && extension.handlerPath) {
        await this.loadHandler(extension);
        const reloadedHandler = this.actionHandlers.get(actionName);
        if (reloadedHandler) {
          return reloadedHandler(config, context);
        }
      }

      throw new NotFoundException(
        `Handler non trouvé pour l'action personnalisée: ${actionName}`,
      );
    }

    try {
      await handler(config, context);
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'exécution de l'action ${actionName}: ${error.message}`,
        error.stack,
        'PluginAutomationExtensionService',
      );
      throw error;
    }
  }

  /**
   * Charge tous les handlers pour un plugin
   */
  async loadPluginHandlers(pluginId: string): Promise<void> {
    const extensions = await this.findAll({
      pluginId,
      enabled: true,
    });

    for (const extension of extensions) {
      await this.loadHandler(extension);
    }
  }

  /**
   * Décharge tous les handlers pour un plugin
   */
  async unloadPluginHandlers(pluginId: string): Promise<void> {
    const extensions = await this.findAll({ pluginId });

    for (const extension of extensions) {
      if (extension.type === ExtensionType.TRIGGER) {
        this.triggerHandlers.delete(extension.name);
      } else {
        this.actionHandlers.delete(extension.name);
      }
    }
  }
}

