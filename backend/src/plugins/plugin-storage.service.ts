import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, DataSource, Table } from 'typeorm';
import { PluginStorage } from './entities/plugin-storage.entity';
import { Plugin, PluginStatus } from './entities/plugin.entity';
import { LoggerService } from '../logger/logger.service';
import { PluginAnalyticsService } from './plugin-analytics.service';
import { AnalyticsEventType } from './entities/plugin-analytics.entity';

@Injectable()
export class PluginStorageService implements OnModuleInit {
  private readonly logger: Logger;

  constructor(
    @InjectRepository(PluginStorage)
    private storageRepository: Repository<PluginStorage>,
    @InjectRepository(Plugin)
    private pluginRepository: Repository<Plugin>,
    private loggerService: LoggerService,
    @Inject(forwardRef(() => PluginAnalyticsService))
    private analyticsService: PluginAnalyticsService,
    private dataSource: DataSource,
  ) {
    this.logger = new Logger(PluginStorageService.name);
  }

  async onModuleInit() {
    // Vérifier si la table existe, sinon la créer
    await this.ensureTableExists();
    // Nettoyer les données expirées au démarrage
    await this.cleanupExpiredData();
    this.logger.log('Service de stockage de plugins initialisé', 'PluginStorageService');
  }

  /**
   * Vérifie si la table existe et la crée si nécessaire
   */
  private async ensureTableExists(): Promise<void> {
    try {
      const queryRunner = this.dataSource.createQueryRunner();
      const tableExists = await queryRunner.hasTable('plugin_storage');
      
      if (!tableExists) {
        this.logger.warn(
          'La table plugin_storage n\'existe pas. Création en cours...',
          'PluginStorageService',
        );
        // Créer la table en utilisant le schéma de l'entité
        const metadata = this.dataSource.getMetadata(PluginStorage);
        const table = Table.create(metadata, this.dataSource.driver);
        await queryRunner.createTable(table);
        this.logger.log(
          'Table plugin_storage créée avec succès',
          'PluginStorageService',
        );
      }
      
      await queryRunner.release();
    } catch (error: any) {
      // Si la table existe déjà ou si une autre erreur survient, on log mais on continue
      if (error?.message?.includes('already exists')) {
        this.logger.debug(
          'La table plugin_storage existe déjà',
          'PluginStorageService',
        );
      } else {
        this.logger.error(
          `Erreur lors de la vérification/création de la table plugin_storage: ${error?.message || error}`,
          'PluginStorageService',
        );
      }
    }
  }

  /**
   * Stocke une valeur pour un plugin
   */
  async set(
    pluginId: string,
    key: string,
    value: any,
    ttl?: number, // Time to live en secondes
  ): Promise<PluginStorage> {
    const plugin = await this.pluginRepository.findOne({
      where: { id: pluginId },
    });

    if (!plugin) {
      throw new NotFoundException(`Plugin ${pluginId} non trouvé`);
    }

    // Vérifier que le plugin est activé
    if (plugin.status !== PluginStatus.ENABLED) {
      throw new BadRequestException(
        `Le plugin ${plugin.name} doit être activé pour utiliser le stockage`,
      );
    }

    // Valider la clé
    if (!key || key.trim().length === 0) {
      throw new BadRequestException('La clé ne peut pas être vide');
    }

    // Limiter la longueur de la clé
    if (key.length > 255) {
      throw new BadRequestException('La clé ne peut pas dépasser 255 caractères');
    }

    // Sérialiser la valeur
    const serializedValue = JSON.stringify(value);
    const valueSize = Buffer.byteLength(serializedValue, 'utf8');

    // Limiter la taille de la valeur (par exemple 1 MB)
    const maxSize = 1024 * 1024; // 1 MB
    if (valueSize > maxSize) {
      throw new BadRequestException(
        `La valeur est trop grande (${valueSize} octets). Maximum: ${maxSize} octets`,
      );
    }

    // Déterminer le type
    const valueType = this.determineType(value);

    // Calculer la date d'expiration si TTL fourni
    const expiresAt = ttl ? new Date(Date.now() + ttl * 1000) : null;

    // Vérifier si la clé existe déjà
    const existing = await this.storageRepository.findOne({
      where: { pluginId, key },
    });

    if (existing) {
      // Mettre à jour
      existing.value = serializedValue;
      existing.type = valueType;
      existing.size = valueSize;
      existing.expiresAt = expiresAt;

      const updated = await this.storageRepository.save(existing);

      this.logger.debug(
        `Clé "${key}" mise à jour pour le plugin ${plugin.name}`,
        'PluginStorageService',
      );

      return updated;
    }

    // Créer une nouvelle entrée
    const storage = this.storageRepository.create({
      pluginId,
      key,
      value: serializedValue,
      type: valueType,
      size: valueSize,
      expiresAt,
    });

    const saved = await this.storageRepository.save(storage);

      // Enregistrer l'événement analytics
      try {
        await this.analyticsService.trackEvent(pluginId, {
          eventType: AnalyticsEventType.STORAGE_ACCESS,
          context: 'set',
          metadata: { key, size: valueSize },
        });
      } catch (error: any) {
        // Ignorer les erreurs d'analytics
      }

      this.logger.debug(
        `Clé "${key}" créée pour le plugin ${plugin.name}`,
        'PluginStorageService',
      );

      return saved;
  }

  /**
   * Récupère une valeur pour un plugin
   */
  async get(pluginId: string, key: string): Promise<any | null> {
    const storage = await this.storageRepository.findOne({
      where: { pluginId, key },
    });

    if (!storage) {
      return null;
    }

    // Vérifier si la donnée a expiré
    if (storage.expiresAt && storage.expiresAt < new Date()) {
      // Supprimer la donnée expirée
      await this.storageRepository.remove(storage);
      return null;
    }

    // Désérialiser la valeur
    try {
      return JSON.parse(storage.value);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la désérialisation de la valeur pour ${pluginId}:${key}`,
        'PluginStorageService',
      );
      return null;
    }
  }

  /**
   * Supprime une clé pour un plugin
   */
  async delete(pluginId: string, key: string): Promise<boolean> {
    const storage = await this.storageRepository.findOne({
      where: { pluginId, key },
    });

    if (!storage) {
      return false;
    }

    await this.storageRepository.remove(storage);

    this.logger.debug(
      `Clé "${key}" supprimée pour le plugin ${pluginId}`,
      'PluginStorageService',
    );

    return true;
  }

  /**
   * Vérifie si une clé existe pour un plugin
   */
  async has(pluginId: string, key: string): Promise<boolean> {
    const storage = await this.storageRepository.findOne({
      where: { pluginId, key },
    });

    if (!storage) {
      return false;
    }

    // Vérifier si la donnée a expiré
    if (storage.expiresAt && storage.expiresAt < new Date()) {
      await this.storageRepository.remove(storage);
      return false;
    }

    return true;
  }

  /**
   * Récupère toutes les clés d'un plugin
   */
  async keys(pluginId: string): Promise<string[]> {
    const storages = await this.storageRepository.find({
      where: { pluginId },
      select: ['key', 'expiresAt'],
    });

    // Filtrer les données expirées
    const now = new Date();
    const validKeys: string[] = [];
    const expiredIds: string[] = [];

    for (const storage of storages) {
      if (storage.expiresAt && storage.expiresAt < now) {
        expiredIds.push((storage as any).id);
      } else {
        validKeys.push(storage.key);
      }
    }

    // Supprimer les données expirées
    if (expiredIds.length > 0) {
      await this.storageRepository.delete(expiredIds);
    }

    return validKeys;
  }

  /**
   * Récupère toutes les entrées d'un plugin
   */
  async getAll(pluginId: string): Promise<Record<string, any>> {
    const storages = await this.storageRepository.find({
      where: { pluginId },
    });

    const result: Record<string, any> = {};
    const now = new Date();
    const expiredIds: string[] = [];

    for (const storage of storages) {
      // Vérifier si la donnée a expiré
      if (storage.expiresAt && storage.expiresAt < now) {
        expiredIds.push(storage.id);
        continue;
      }

      try {
        result[storage.key] = JSON.parse(storage.value);
      } catch (error) {
        this.logger.warn(
          `Erreur lors de la désérialisation de ${pluginId}:${storage.key}`,
          'PluginStorageService',
        );
      }
    }

    // Supprimer les données expirées
    if (expiredIds.length > 0) {
      await this.storageRepository.delete(expiredIds);
    }

    return result;
  }

  /**
   * Supprime toutes les données d'un plugin
   */
  async clear(pluginId: string): Promise<number> {
    const result = await this.storageRepository.delete({ pluginId });
    const count = result.affected || 0;

    this.logger.log(
      `${count} entrée(s) supprimée(s) pour le plugin ${pluginId}`,
      'PluginStorageService',
    );

    return count;
  }

  /**
   * Compte le nombre d'entrées pour un plugin
   */
  async count(pluginId: string): Promise<number> {
    // Nettoyer d'abord les données expirées
    await this.cleanupExpiredDataForPlugin(pluginId);

    return this.storageRepository.count({
      where: { pluginId },
    });
  }

  /**
   * Calcule la taille totale des données pour un plugin
   */
  async getTotalSize(pluginId: string): Promise<number> {
    // Nettoyer d'abord les données expirées
    await this.cleanupExpiredDataForPlugin(pluginId);

    const storages = await this.storageRepository.find({
      where: { pluginId },
      select: ['size'],
    });

    return storages.reduce((total, storage) => total + (storage.size || 0), 0);
  }

  /**
   * Récupère les statistiques de stockage d'un plugin
   */
  async getStats(pluginId: string): Promise<{
    count: number;
    totalSize: number;
    averageSize: number;
    expiredCount: number;
  }> {
    const allStorages = await this.storageRepository.find({
      where: { pluginId },
    });

    const now = new Date();
    let expiredCount = 0;
    let totalSize = 0;
    let validCount = 0;

    for (const storage of allStorages) {
      if (storage.expiresAt && storage.expiresAt < now) {
        expiredCount++;
      } else {
        validCount++;
        totalSize += storage.size || 0;
      }
    }

    return {
      count: validCount,
      totalSize,
      averageSize: validCount > 0 ? totalSize / validCount : 0,
      expiredCount,
    };
  }

  /**
   * Nettoie les données expirées pour un plugin
   */
  async cleanupExpiredDataForPlugin(pluginId: string): Promise<number> {
    try {
      const now = new Date();
      const result = await this.storageRepository
        .createQueryBuilder()
        .delete()
        .from(PluginStorage)
        .where('pluginId = :pluginId', { pluginId })
        .andWhere('expiresAt IS NOT NULL')
        .andWhere('expiresAt < :now', { now })
        .execute();

      return result.affected || 0;
    } catch (error: any) {
      // Si la table n'existe pas encore, on ignore l'erreur
      if (error?.code === 'SQLITE_ERROR' && error?.message?.includes('no such table')) {
        return 0;
      }
      this.logger.error(
        `Erreur lors du nettoyage des données expirées pour le plugin ${pluginId}: ${error?.message || error}`,
        'PluginStorageService',
      );
      return 0;
    }
  }

  /**
   * Nettoie toutes les données expirées
   */
  async cleanupExpiredData(): Promise<number> {
    try {
      const now = new Date();
      const result = await this.storageRepository
        .createQueryBuilder()
        .delete()
        .from(PluginStorage)
        .where('expiresAt IS NOT NULL')
        .andWhere('expiresAt < :now', { now })
        .execute();

      const count = result.affected || 0;

      if (count > 0) {
        this.logger.log(
          `${count} entrée(s) expirée(s) supprimée(s)`,
          'PluginStorageService',
        );
      }

      return count;
    } catch (error: any) {
      // Si la table n'existe pas encore (en production avec synchronize=false),
      // on ignore l'erreur et on retourne 0
      if (error?.code === 'SQLITE_ERROR' && error?.message?.includes('no such table')) {
        this.logger.warn(
          'La table plugin_storage n\'existe pas encore. Ignoré.',
          'PluginStorageService',
        );
        return 0;
      }
      // Pour les autres erreurs, on les log mais on ne fait pas planter l'application
      this.logger.error(
        `Erreur lors du nettoyage des données expirées: ${error?.message || error}`,
        'PluginStorageService',
      );
      return 0;
    }
  }

  /**
   * Nettoie les données expirées toutes les heures
   */
  @Cron(CronExpression.EVERY_HOUR)
  async scheduledCleanup() {
    await this.cleanupExpiredData();
  }

  /**
   * Supprime toutes les données d'un plugin (appelé lors de la désinstallation)
   */
  async removePluginData(pluginId: string): Promise<number> {
    const result = await this.storageRepository.delete({ pluginId });
    const count = result.affected || 0;

    if (count > 0) {
      this.logger.log(
        `${count} entrée(s) de stockage supprimée(s) pour le plugin ${pluginId}`,
        'PluginStorageService',
      );
    }

    return count;
  }

  /**
   * Détermine le type d'une valeur
   */
  private determineType(value: any): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }
}

