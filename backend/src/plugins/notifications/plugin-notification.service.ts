import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PluginNotification,
  NotificationLevel,
  NotificationStatus,
} from './plugin-notification.entity';
import { Plugin } from '../entities/plugin.entity';
import { LoggerService } from '../../logger/logger.service';
import { WebsocketGateway } from '../../websocket/websocket.gateway';

export interface SendNotificationOptions {
  title: string;
  message: string;
  level?: NotificationLevel;
  actions?: Array<{
    label: string;
    action: string;
    data?: Record<string, any>;
  }>;
  metadata?: Record<string, any>;
  priority?: number;
  expiresAt?: Date;
  userId?: string; // Si null, notification pour tous les utilisateurs
}

@Injectable()
export class PluginNotificationService {
  private readonly logger: Logger;

  constructor(
    @InjectRepository(PluginNotification)
    private notificationRepository: Repository<PluginNotification>,
    @InjectRepository(Plugin)
    private pluginRepository: Repository<Plugin>,
    private loggerService: LoggerService,
    private websocketGateway: WebsocketGateway,
  ) {
    this.logger = new Logger(PluginNotificationService.name);
  }

  /**
   * Envoie une notification depuis un plugin
   */
  async sendNotification(
    pluginId: string,
    options: SendNotificationOptions,
  ): Promise<PluginNotification> {
    // Vérifier que le plugin existe
    const plugin = await this.pluginRepository.findOne({
      where: { id: pluginId },
    });

    if (!plugin) {
      throw new NotFoundException(`Plugin ${pluginId} non trouvé`);
    }

    // Vérifier que le plugin a la permission de notification
    if (!plugin.permissions || !plugin.permissions.includes('notifications:send')) {
      throw new BadRequestException(
        `Le plugin ${plugin.name} n'a pas la permission d'envoyer des notifications`,
      );
    }

    // Valider les options
    if (!options.title || !options.message) {
      throw new BadRequestException('Le titre et le message sont requis');
    }

    // Créer la notification
    const notification = this.notificationRepository.create({
      pluginId,
      title: options.title,
      message: options.message,
      level: options.level || NotificationLevel.INFO,
      actions: options.actions || [],
      metadata: options.metadata || {},
      priority: options.priority || 0,
      expiresAt: options.expiresAt || null,
      status: NotificationStatus.PENDING,
    });

    const saved = await this.notificationRepository.save(notification);

    // Envoyer via WebSocket
    try {
      this.websocketGateway.broadcast('notification', {
        id: saved.id,
        pluginId: plugin.id,
        pluginName: plugin.name,
        title: saved.title,
        message: saved.message,
        level: saved.level,
        actions: saved.actions,
        metadata: saved.metadata,
        priority: saved.priority,
        createdAt: saved.createdAt,
        userId: options.userId, // Si spécifié, envoyer uniquement à cet utilisateur
      });

      // Marquer comme envoyée
      saved.status = NotificationStatus.SENT;
      await this.notificationRepository.save(saved);

      this.logger.log(
        `Notification envoyée par le plugin ${plugin.name}: ${saved.title}`,
        'PluginNotificationService',
      );
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'envoi de la notification: ${error.message}`,
        error.stack,
        'PluginNotificationService',
      );
      // La notification reste en PENDING
    }

    return saved;
  }

  /**
   * Récupère toutes les notifications
   */
  async findAll(filters?: {
    pluginId?: string;
    level?: NotificationLevel;
    status?: NotificationStatus;
    userId?: string;
    unreadOnly?: boolean;
  }): Promise<PluginNotification[]> {
    const query = this.notificationRepository.createQueryBuilder('notification');

    if (filters?.pluginId) {
      query.andWhere('notification.pluginId = :pluginId', {
        pluginId: filters.pluginId,
      });
    }

    if (filters?.level) {
      query.andWhere('notification.level = :level', { level: filters.level });
    }

    if (filters?.status) {
      query.andWhere('notification.status = :status', {
        status: filters.status,
      });
    }

    if (filters?.unreadOnly) {
      query.andWhere('notification.status != :readStatus', {
        readStatus: NotificationStatus.READ,
      });
    }

    // Filtrer les notifications expirées
    query.andWhere(
      '(notification.expiresAt IS NULL OR notification.expiresAt > :now)',
      { now: new Date() },
    );

    return query
      .leftJoinAndSelect('notification.plugin', 'plugin')
      .orderBy('notification.priority', 'DESC')
      .addOrderBy('notification.createdAt', 'DESC')
      .getMany();
  }

  /**
   * Récupère une notification par son ID
   */
  async findOne(id: string): Promise<PluginNotification> {
    const notification = await this.notificationRepository.findOne({
      where: { id },
      relations: ['plugin'],
    });

    if (!notification) {
      throw new NotFoundException('Notification non trouvée');
    }

    return notification;
  }

  /**
   * Marque une notification comme lue
   */
  async markAsRead(id: string): Promise<PluginNotification> {
    const notification = await this.findOne(id);
    notification.status = NotificationStatus.READ;
    notification.readAt = new Date();
    return this.notificationRepository.save(notification);
  }

  /**
   * Archive une notification
   */
  async archive(id: string): Promise<PluginNotification> {
    const notification = await this.findOne(id);
    notification.status = NotificationStatus.ARCHIVED;
    return this.notificationRepository.save(notification);
  }

  /**
   * Supprime une notification
   */
  async delete(id: string): Promise<void> {
    const notification = await this.findOne(id);
    await this.notificationRepository.remove(notification);
  }

  /**
   * Supprime toutes les notifications d'un plugin
   */
  async deleteByPlugin(pluginId: string): Promise<void> {
    await this.notificationRepository.delete({ pluginId });
  }

  /**
   * Supprime les notifications expirées
   */
  async deleteExpired(): Promise<number> {
    const result = await this.notificationRepository
      .createQueryBuilder()
      .delete()
      .where('expiresAt IS NOT NULL')
      .andWhere('expiresAt < :now', { now: new Date() })
      .execute();

    return result.affected || 0;
  }

  /**
   * Récupère le nombre de notifications non lues
   */
  async getUnreadCount(pluginId?: string): Promise<number> {
    const query = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.status != :readStatus', {
        readStatus: NotificationStatus.READ,
      })
      .andWhere(
        '(notification.expiresAt IS NULL OR notification.expiresAt > :now)',
        { now: new Date() },
      );

    if (pluginId) {
      query.andWhere('notification.pluginId = :pluginId', { pluginId });
    }

    return query.getCount();
  }

  /**
   * Marque toutes les notifications comme lues
   */
  async markAllAsRead(pluginId?: string): Promise<number> {
    const query = this.notificationRepository
      .createQueryBuilder()
      .update(PluginNotification)
      .set({
        status: NotificationStatus.READ,
        readAt: () => "datetime('now')",
      })
      .where('status != :readStatus', { readStatus: NotificationStatus.READ });

    if (pluginId) {
      query.andWhere('pluginId = :pluginId', { pluginId });
    }

    const result = await query.execute();
    return result.affected || 0;
  }
}

