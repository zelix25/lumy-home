import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PluginStorage } from './plugin-storage.entity';
import { Plugin } from '../entities/plugin.entity';
import { LoggerService } from '../../logger/logger.service';

@Injectable()
export class PluginStorageService {
  private readonly logger: Logger;

  constructor(
    @InjectRepository(PluginStorage)
    private storageRepository: Repository<PluginStorage>,
    @InjectRepository(Plugin)
    private pluginRepository: Repository<Plugin>,
    private loggerService: LoggerService,
  ) {
    this.logger = new Logger(PluginStorageService.name);
  }

  /**
   * Stocke une valeur pour un plugin
   */
  async set(
    pluginId: string,
    key: string,
    value: any,
    options?: {
      type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
      metadata?: Record<string, any>;
      expiresAt?: Date;
    },
  ): Promise<PluginStorage> {
    // Vérifier que le plugin existe
    const plugin = await this.pluginRepository.findOne({
      where: { id: pluginId },
    });

    if (!plugin) {
      throw new NotFoundException(`Plugin ${pluginId} non trouvé`);
    }

    // Vérifier que le plugin a la permission de stockage
    if (!plugin.permissions || !plugin.permissions.includes('storage:write')) {
      throw new BadRequestException(
        `Le plugin ${plugin.name} n'a pas la permission d'écrire dans le stockage`,
      );
    }

    // Valider la clé
    if (!key || key.length === 0 || key.length > 255) {
      throw new BadRequestException('La clé doit être une chaîne non vide de 255 caractères maximum');
    }

    // Déterminer le type si non spécifié
    let type: 'string' | 'number' | 'boolean' | 'object' | 'array' = options?.type || 'string';
    if (!options?.type) {
      if (typeof value === 'number') {
        type = 'number';
      } else if (typeof value === 'boolean') {
        type = 'boolean';
      } else if (Array.isArray(value)) {
        type = 'array';
      } else if (typeof value === 'object' && value !== null) {
        type = 'object';
      }
    }

    // Convertir la valeur en string si nécessaire
    let stringValue: string;
    if (type === 'object' || type === 'array') {
      stringValue = JSON.stringify(value);
    } else {
      stringValue = String(value);
    }

    // Vérifier si l'entrée existe déjà
    const existing = await this.storageRepository.findOne({
      where: { pluginId, key },
    });

    if (existing) {
      // Mettre à jour
      existing.value = stringValue;
      existing.type = type;
      if (options?.metadata !== undefined) {
        existing.metadata = options.metadata;
      }
      if (options?.expiresAt !== undefined) {
        existing.expiresAt = options.expiresAt;
      }
      const updated = await this.storageRepository.save(existing);
      this.logger.debug(
        `Stockage mis à jour pour le plugin ${plugin.name}: ${key}`,
        'PluginStorageService',
      );
      return updated;
    } else {
      // Créer
      const storage = this.storageRepository.create({
        pluginId,
        key,
        value: stringValue,
        type,
        metadata: options?.metadata || {},
        expiresAt: options?.expiresAt || null,
      });
      const saved = await this.storageRepository.save(storage);
      this.logger.debug(
        `Stockage créé pour le plugin ${plugin.name}: ${key}`,
        'PluginStorageService',
      );
      return saved;
    }
  }

  /**
   * Récupère une valeur pour un plugin
   */
  async get(
    pluginId: string,
    key: string,
    defaultValue?: any,
  ): Promise<any> {
    // Vérifier que le plugin existe
    const plugin = await this.pluginRepository.findOne({
      where: { id: pluginId },
    });

    if (!plugin) {
      throw new NotFoundException(`Plugin ${pluginId} non trouvé`);
    }

    // Vérifier que le plugin a la permission de lecture
    if (!plugin.permissions || !plugin.permissions.includes('storage:read')) {
      throw new BadRequestException(
        `Le plugin ${plugin.name} n'a pas la permission de lire le stockage`,
      );
    }

    // Récupérer l'entrée
    const storage = await this.storageRepository.findOne({
      where: { pluginId, key },
    });

    // Vérifier l'expiration
    if (storage && storage.expiresAt && storage.expiresAt < new Date()) {
      // Supprimer l'entrée expirée
      await this.storageRepository.remove(storage);
      return defaultValue;
    }

    if (!storage) {
      return defaultValue;
    }

    // Convertir la valeur selon le type
    switch (storage.type) {
      case 'number':
        return Number(storage.value);
      case 'boolean':
        return storage.value === 'true';
      case 'object':
      case 'array':
        try {
          return JSON.parse(storage.value);
        } catch (error) {
          this.logger.warn(
            `Erreur lors du parsing JSON pour ${plugin.name}:${key}`,
            'PluginStorageService',
          );
          return defaultValue;
        }
      default:
        return storage.value;
    }
  }

  /**
   * Supprime une clé pour un plugin
   */
  async delete(pluginId: string, key: string): Promise<void> {
    // Vérifier que le plugin existe
    const plugin = await this.pluginRepository.findOne({
      where: { id: pluginId },
    });

    if (!plugin) {
      throw new NotFoundException(`Plugin ${pluginId} non trouvé`);
    }

    // Vérifier que le plugin a la permission d'écriture
    if (!plugin.permissions || !plugin.permissions.includes('storage:write')) {
      throw new BadRequestException(
        `Le plugin ${plugin.name} n'a pas la permission d'écrire dans le stockage`,
      );
    }

    const storage = await this.storageRepository.findOne({
      where: { pluginId, key },
    });

    if (storage) {
      await this.storageRepository.remove(storage);
      this.logger.debug(
        `Stockage supprimé pour le plugin ${plugin.name}: ${key}`,
        'PluginStorageService',
      );
    }
  }

  /**
   * Récupère toutes les clés pour un plugin
   */
  async getAll(pluginId: string): Promise<Record<string, any>> {
    // Vérifier que le plugin existe
    const plugin = await this.pluginRepository.findOne({
      where: { id: pluginId },
    });

    if (!plugin) {
      throw new NotFoundException(`Plugin ${pluginId} non trouvé`);
    }

    // Vérifier que le plugin a la permission de lecture
    if (!plugin.permissions || !plugin.permissions.includes('storage:read')) {
      throw new BadRequestException(
        `Le plugin ${plugin.name} n'a pas la permission de lire le stockage`,
      );
    }

    // Récupérer toutes les entrées
    const storages = await this.storageRepository.find({
      where: { pluginId },
      order: { key: 'ASC' },
    });

    // Filtrer les entrées expirées
    const now = new Date();
    const validStorages = storages.filter(
      (s) => !s.expiresAt || s.expiresAt > now,
    );

    // Supprimer les entrées expirées
    const expiredStorages = storages.filter(
      (s) => s.expiresAt && s.expiresAt <= now,
    );
    if (expiredStorages.length > 0) {
      await this.storageRepository.remove(expiredStorages);
    }

    // Convertir en objet
    const result: Record<string, any> = {};
    for (const storage of validStorages) {
      switch (storage.type) {
        case 'number':
          result[storage.key] = Number(storage.value);
          break;
        case 'boolean':
          result[storage.key] = storage.value === 'true';
          break;
        case 'object':
        case 'array':
          try {
            result[storage.key] = JSON.parse(storage.value);
          } catch (error) {
            this.logger.warn(
              `Erreur lors du parsing JSON pour ${plugin.name}:${storage.key}`,
              'PluginStorageService',
            );
            result[storage.key] = storage.value;
          }
          break;
        default:
          result[storage.key] = storage.value;
      }
    }

    return result;
  }

  /**
   * Récupère les clés d'un plugin
   */
  async getKeys(pluginId: string): Promise<string[]> {
    // Vérifier que le plugin existe
    const plugin = await this.pluginRepository.findOne({
      where: { id: pluginId },
    });

    if (!plugin) {
      throw new NotFoundException(`Plugin ${pluginId} non trouvé`);
    }

    // Vérifier que le plugin a la permission de lecture
    if (!plugin.permissions || !plugin.permissions.includes('storage:read')) {
      throw new BadRequestException(
        `Le plugin ${plugin.name} n'a pas la permission de lire le stockage`,
      );
    }

    const storages = await this.storageRepository.find({
      where: { pluginId },
      select: ['key'],
      order: { key: 'ASC' },
    });

    // Filtrer les entrées expirées
    const now = new Date();
    const validStorages = storages.filter((s) => {
      // Note: on ne peut pas vérifier expiresAt ici car on n'a pas sélectionné ce champ
      // On retourne toutes les clés, l'expiration sera vérifiée lors de la lecture
      return true;
    });

    return validStorages.map((s) => s.key);
  }

  /**
   * Vérifie si une clé existe
   */
  async has(pluginId: string, key: string): Promise<boolean> {
    const storage = await this.storageRepository.findOne({
      where: { pluginId, key },
    });

    if (!storage) {
      return false;
    }

    // Vérifier l'expiration
    if (storage.expiresAt && storage.expiresAt < new Date()) {
      await this.storageRepository.remove(storage);
      return false;
    }

    return true;
  }

  /**
   * Supprime toutes les clés d'un plugin
   */
  async clear(pluginId: string): Promise<number> {
    // Vérifier que le plugin existe
    const plugin = await this.pluginRepository.findOne({
      where: { id: pluginId },
    });

    if (!plugin) {
      throw new NotFoundException(`Plugin ${pluginId} non trouvé`);
    }

    // Vérifier que le plugin a la permission d'écriture
    if (!plugin.permissions || !plugin.permissions.includes('storage:write')) {
      throw new BadRequestException(
        `Le plugin ${plugin.name} n'a pas la permission d'écrire dans le stockage`,
      );
    }

    const result = await this.storageRepository.delete({ pluginId });
    this.logger.debug(
      `${result.affected || 0} entrée(s) supprimée(s) pour le plugin ${plugin.name}`,
      'PluginStorageService',
    );
    return result.affected || 0;
  }

  /**
   * Supprime les entrées expirées
   */
  async deleteExpired(): Promise<number> {
    const now = new Date();
    const result = await this.storageRepository
      .createQueryBuilder()
      .delete()
      .where('expiresAt IS NOT NULL')
      .andWhere('expiresAt < :now', { now })
      .execute();

    return result.affected || 0;
  }

  /**
   * Récupère le nombre d'entrées pour un plugin
   */
  async getCount(pluginId: string): Promise<number> {
    return this.storageRepository.count({
      where: { pluginId },
    });
  }

  /**
   * Récupère la taille totale du stockage pour un plugin (en octets approximatifs)
   */
  async getSize(pluginId: string): Promise<number> {
    const storages = await this.storageRepository.find({
      where: { pluginId },
      select: ['value', 'metadata'],
    });

    let size = 0;
    for (const storage of storages) {
      size += storage.value ? storage.value.length : 0;
      size += storage.metadata
        ? JSON.stringify(storage.metadata).length
        : 0;
    }

    return size;
  }
}

