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
  AutomationExtensionType,
} from './entities/plugin-automation-extension.entity';
import { Plugin, PluginStatus } from './entities/plugin.entity';
import { LoggerService } from '../logger/logger.service';

export interface AutomationExtensionDefinition {
  type: AutomationExtensionType;
  name: string;
  displayName: string;
  description?: string;
  handlerPath?: string;
  configSchema?: Record<string, any>;
  metadata?: Record<string, any>;
}

@Injectable()
export class PluginAutomationExtensionService {
  private readonly logger: Logger;

  constructor(
    @InjectRepository(PluginAutomationExtension)
    private automationExtensionRepository: Repository<PluginAutomationExtension>,
    @InjectRepository(Plugin)
    private pluginRepository: Repository<Plugin>,
    private loggerService: LoggerService,
  ) {
    this.logger = new Logger(PluginAutomationExtensionService.name);
  }

  /**
   * Enregistre une extension d'automatisation pour un plugin
   */
  async registerExtension(
    pluginId: string,
    extension: AutomationExtensionDefinition,
  ): Promise<PluginAutomationExtension> {
    const plugin = await this.pluginRepository.findOne({
      where: { id: pluginId },
    });

    if (!plugin) {
      throw new NotFoundException(`Plugin ${pluginId} non trouvé`);
    }

    // Vérifier que le plugin est activé
    if (plugin.status !== PluginStatus.ENABLED) {
      throw new BadRequestException(
        `Le plugin ${plugin.name} doit être activé pour enregistrer des extensions d'automatisation`,
      );
    }

    // Vérifier les champs requis
    this.validateExtensionDefinition(extension);

    // Vérifier si l'extension existe déjà
    const existing = await this.automationExtensionRepository.findOne({
      where: {
        pluginId,
        name: extension.name,
      },
    });

    if (existing) {
      // Mettre à jour l'extension existante
      existing.displayName = extension.displayName;
      existing.description = extension.description ?? null;
      existing.handlerPath = extension.handlerPath ?? null;
      existing.configSchema = extension.configSchema ?? null;
      existing.metadata = extension.metadata ?? null;

      const updated = await this.automationExtensionRepository.save(existing);

      this.logger.log(
        `Extension d'automatisation "${extension.name}" mise à jour pour le plugin ${plugin.name}`,
        'PluginAutomationExtensionService',
      );

      return updated;
    }

    // Créer une nouvelle extension
    const automationExtension = this.automationExtensionRepository.create({
      pluginId,
      type: extension.type,
      name: extension.name,
      displayName: extension.displayName,
      description: extension.description ?? null,
      handlerPath: extension.handlerPath ?? null,
      configSchema: extension.configSchema ?? null,
      metadata: extension.metadata ?? null,
      enabled: true,
    });

    const saved = await this.automationExtensionRepository.save(
      automationExtension,
    );

    this.logger.log(
      `Extension d'automatisation "${extension.name}" enregistrée pour le plugin ${plugin.name}`,
      'PluginAutomationExtensionService',
    );

    return saved;
  }

  /**
   * Enregistre plusieurs extensions d'automatisation pour un plugin
   */
  async registerExtensions(
    pluginId: string,
    extensions: AutomationExtensionDefinition[],
  ): Promise<PluginAutomationExtension[]> {
    const results: PluginAutomationExtension[] = [];

    for (const extension of extensions) {
      const result = await this.registerExtension(pluginId, extension);
      results.push(result);
    }

    return results;
  }

  /**
   * Récupère toutes les extensions d'automatisation d'un plugin
   */
  async getPluginExtensions(
    pluginId: string,
    type?: AutomationExtensionType,
  ): Promise<PluginAutomationExtension[]> {
    const where: any = { pluginId, enabled: true };

    if (type) {
      where.type = type;
    }

    return this.automationExtensionRepository.find({
      where,
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Récupère toutes les extensions d'automatisation de tous les plugins activés
   */
  async getAllExtensions(
    type?: AutomationExtensionType,
  ): Promise<PluginAutomationExtension[]> {
    // Récupérer tous les plugins activés
    const enabledPlugins = await this.pluginRepository.find({
      where: { status: PluginStatus.ENABLED },
    });

    const pluginIds = enabledPlugins.map((p) => p.id);

    if (pluginIds.length === 0) {
      return [];
    }

    return this.automationExtensionRepository
      .createQueryBuilder('extension')
      .where('extension.pluginId IN (:...pluginIds)', { pluginIds })
      .andWhere('extension.enabled = :enabled', { enabled: true })
      .andWhere(type ? 'extension.type = :type' : '1=1', { type })
      .orderBy('extension.createdAt', 'ASC')
      .getMany();
  }

  /**
   * Récupère toutes les extensions de type trigger
   */
  async getAvailableTriggers(): Promise<PluginAutomationExtension[]> {
    return this.getAllExtensions(AutomationExtensionType.TRIGGER);
  }

  /**
   * Récupère toutes les extensions de type condition
   */
  async getAvailableConditions(): Promise<PluginAutomationExtension[]> {
    return this.getAllExtensions(AutomationExtensionType.CONDITION);
  }

  /**
   * Récupère toutes les extensions de type action
   */
  async getAvailableActions(): Promise<PluginAutomationExtension[]> {
    return this.getAllExtensions(AutomationExtensionType.ACTION);
  }

  /**
   * Récupère une extension par son ID
   */
  async getExtension(id: string): Promise<PluginAutomationExtension> {
    const extension = await this.automationExtensionRepository.findOne({
      where: { id },
      relations: ['plugin'],
    });

    if (!extension) {
      throw new NotFoundException(
        `Extension d'automatisation ${id} non trouvée`,
      );
    }

    return extension;
  }

  /**
   * Active ou désactive une extension
   */
  async setExtensionEnabled(
    id: string,
    enabled: boolean,
  ): Promise<PluginAutomationExtension> {
    const extension = await this.getExtension(id);
    extension.enabled = enabled;
    return this.automationExtensionRepository.save(extension);
  }

  /**
   * Supprime une extension d'automatisation
   */
  async removeExtension(id: string): Promise<void> {
    const extension = await this.getExtension(id);
    await this.automationExtensionRepository.remove(extension);

    this.logger.log(
      `Extension d'automatisation "${extension.name}" supprimée`,
      'PluginAutomationExtensionService',
    );
  }

  /**
   * Supprime toutes les extensions d'un plugin
   */
  async removePluginExtensions(pluginId: string): Promise<void> {
    const extensions = await this.automationExtensionRepository.find({
      where: { pluginId },
    });

    if (extensions.length > 0) {
      await this.automationExtensionRepository.remove(extensions);

      this.logger.log(
        `${extensions.length} extension(s) d'automatisation supprimée(s) pour le plugin ${pluginId}`,
        'PluginAutomationExtensionService',
      );
    }
  }

  /**
   * Valide la définition d'une extension
   */
  private validateExtensionDefinition(
    extension: AutomationExtensionDefinition,
  ): void {
    if (!extension.type) {
      throw new BadRequestException('Le type d\'extension est requis');
    }

    if (!extension.name) {
      throw new BadRequestException('Le nom de l\'extension est requis');
    }

    if (!extension.displayName) {
      throw new BadRequestException('Le nom d\'affichage est requis');
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

