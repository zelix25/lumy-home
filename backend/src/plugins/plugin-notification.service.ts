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
import { Repository, DataSource, Table } from 'typeorm';
import {
  PluginNotification,
  NotificationType,
  NotificationStatus,
} from './entities/plugin-notification.entity';
import { Plugin, PluginStatus } from './entities/plugin.entity';
import { LoggerService } from '../logger/logger.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { PluginAnalyticsService } from './plugin-analytics.service';
import { AnalyticsEventType } from './entities/plugin-analytics.entity';

export interface CreateNotificationDto {
  title: string;
  message: string;
  type?: NotificationType;
  userId?: string;
  metadata?: Record<string, any>;
  expiresAt?: Date;
}

@Injectable()
export class PluginNotificationService implements OnModuleInit {
  private readonly logger: Logger;

  constructor(
    @InjectRepository(PluginNotification)
    private notificationRepository: Repository<PluginNotification>,
    @InjectRepository(Plugin)
    private pluginRepository: Repository<Plugin>,
    private loggerService: LoggerService,
    private websocketGateway: WebsocketGateway,
    @Inject(forwardRef(() => PluginAnalyticsService))
    private analyticsService: PluginAnalyticsService,
    private dataSource: DataSource,
  ) {
    this.logger = new Logger(PluginNotificationService.name);
  }

  async onModuleInit() {
    // Vérifier si la table existe, sinon la créer
    await this.ensureTableExists();
    // Nettoyer les notifications expirées au démarrage
    await this.cleanupExpiredNotifications();
    this.logger.log('Service de notifications de plugins initialisé', 'PluginNotificationService');
  }

  /**
   * Vérifie si la table existe et la crée si nécessaire
   */
  private async ensureTableExists(): Promise<void> {
    try {
      const queryRunner = this.dataSource.createQueryRunner();
      const tableExists = await queryRunner.hasTable('plugin_notifications');
      
      if (!tableExists) {
        this.logger.warn(
          'La table plugin_notifications n\'existe pas. Création en cours...',
          'PluginNotificationService',
        );
        // Créer la table en utilisant le schéma de l'entité
        const metadata = this.dataSource.getMetadata(PluginNotification);
        const table = Table.create(metadata, this.dataSource.driver);
        await queryRunner.createTable(table);
        this.logger.log(
          'Table plugin_notifications créée avec succès',
          'PluginNotificationService',
        );
      }
      
      await queryRunner.release();
    } catch (error: any) {
      // Si la table existe déjà ou si une autre erreur survient, on log mais on continue
      if (error?.message?.includes('already exists')) {
        this.logger.debug(
          'La table plugin_notifications existe déjà',
          'PluginNotificationService',
        );
      } else {
        this.logger.error(
          `Erreur lors de la vérification/création de la table plugin_notifications: ${error?.message || error}`,
          'PluginNotificationService',
        );
      }
    }
  }

  /**
   * Nettoie les notifications expirées toutes les heures
   */
  @Cron(CronExpression.EVERY_HOUR)
  async scheduledCleanup() {
    const count = await this.cleanupExpiredNotifications();
    if (count > 0) {
      this.logger.log(
        `${count} notification(s) expirée(s) nettoyée(s)`,
        'PluginNotificationService',
      );
    }
  }

  /**
   * Crée et envoie une notification depuis un plugin
   */
  async sendNotification(
    pluginId: string,
    notificationDto: CreateNotificationDto,
  ): Promise<PluginNotification> {
    const plugin = await this.pluginRepository.findOne({
      where: { id: pluginId },
    });

    if (!plugin) {
      throw new NotFoundException(`Plugin ${pluginId} non trouvé`);
    }

    // Vérifier que le plugin est activé
    if (plugin.status !== PluginStatus.ENABLED) {
      throw new BadRequestException(
        `Le plugin ${plugin.name} doit être activé pour envoyer des notifications`,
      );
    }

    // Valider les champs requis
    if (!notificationDto.title || !notificationDto.message) {
      throw new BadRequestException(
        'Le titre et le message sont requis pour une notification',
      );
    }

    // Créer la notification
    const notification = this.notificationRepository.create({
      pluginId,
      userId: notificationDto.userId || null,
      title: notificationDto.title,
      message: notificationDto.message,
      type: notificationDto.type || NotificationType.INFO,
      status: NotificationStatus.PENDING,
      metadata: notificationDto.metadata || null,
      expiresAt: notificationDto.expiresAt
        ? typeof notificationDto.expiresAt === 'string'
          ? new Date(notificationDto.expiresAt)
          : notificationDto.expiresAt
        : null,
    });

    const saved = await this.notificationRepository.save(notification);

    // Envoyer la notification via WebSocket
    await this.deliverNotification(saved);

    // Enregistrer l'événement analytics
    try {
      await this.analyticsService.trackEvent(pluginId, {
        eventType: AnalyticsEventType.NOTIFICATION_SENT,
        metadata: { notificationId: saved.id },
      });
    } catch (error: any) {
      // Ignorer les erreurs d'analytics
    }

    this.logger.log(
      `Notification envoyée par le plugin ${plugin.name}: ${saved.title}`,
      'PluginNotificationService',
    );

    return saved;
  }

  /**
   * Livre une notification aux utilisateurs via WebSocket
   */
  private async deliverNotification(
    notification: PluginNotification,
  ): Promise<void> {
    try {
      // Si la notification a un userId spécifique, l'envoyer uniquement à cet utilisateur
      // Sinon, l'envoyer à tous les utilisateurs connectés
      const notificationData = {
        id: notification.id,
        pluginId: notification.pluginId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        metadata: notification.metadata,
        createdAt: notification.createdAt,
      };

      if (notification.userId) {
        // Envoyer à un utilisateur spécifique
        // Note: Dans une implémentation complète, on devrait mapper userId -> socketId
        // Pour l'instant, on envoie à tous les clients
        this.websocketGateway.broadcast('plugin:notification', notificationData);
      } else {
        // Envoyer à tous les utilisateurs
        this.websocketGateway.broadcast('plugin:notification', notificationData);
      }

      // Marquer la notification comme envoyée
      notification.status = NotificationStatus.SENT;
      await this.notificationRepository.save(notification);
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de la livraison de la notification ${notification.id}: ${error.message}`,
        'PluginNotificationService',
      );
    }
  }

  /**
   * Récupère les notifications d'un utilisateur
   */
  async getUserNotifications(
    userId: string,
    limit: number = 50,
    unreadOnly: boolean = false,
  ): Promise<PluginNotification[]> {
    const query = this.notificationRepository
      .createQueryBuilder('notification')
      .where('(notification.userId = :userId OR notification.userId IS NULL)', {
        userId,
      })
      .andWhere('notification.status != :expired', {
        expired: NotificationStatus.EXPIRED,
      });

    if (unreadOnly) {
      query.andWhere('notification.status = :pending', {
        pending: NotificationStatus.PENDING,
      });
    }

    // Filtrer les notifications expirées
    query.andWhere(
      '(notification.expiresAt IS NULL OR notification.expiresAt > :now)',
      { now: new Date() },
    );

    return query
      .orderBy('notification.createdAt', 'DESC')
      .limit(limit)
      .getMany();
  }

  /**
   * Marque une notification comme lue
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException(
        `Notification ${notificationId} non trouvée`,
      );
    }

    // Vérifier que la notification est destinée à cet utilisateur
    if (notification.userId && notification.userId !== userId) {
      throw new BadRequestException(
        'Vous n\'avez pas accès à cette notification',
      );
    }

    notification.status = NotificationStatus.READ;
    notification.readAt = new Date();
    await this.notificationRepository.save(notification);
  }

  /**
   * Supprime une notification
   */
  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException(
        `Notification ${notificationId} non trouvée`,
      );
    }

    // Vérifier que la notification est destinée à cet utilisateur
    if (notification.userId && notification.userId !== userId) {
      throw new BadRequestException(
        'Vous n\'avez pas accès à cette notification',
      );
    }

    await this.notificationRepository.remove(notification);
  }

  /**
   * Nettoie les notifications expirées
   */
  async cleanupExpiredNotifications(): Promise<number> {
    try {
      const result = await this.notificationRepository
        .createQueryBuilder()
        .update(PluginNotification)
        .set({ status: NotificationStatus.EXPIRED })
        .where('expiresAt IS NOT NULL')
        .andWhere('expiresAt < :now', { now: new Date() })
        .andWhere('status != :expired', { expired: NotificationStatus.EXPIRED })
        .execute();

      return result.affected || 0;
    } catch (error: any) {
      // Si la table n'existe pas encore (en production avec synchronize=false),
      // on ignore l'erreur et on retourne 0
      if (error?.code === 'SQLITE_ERROR' && error?.message?.includes('no such table')) {
        this.logger.warn(
          'La table plugin_notifications n\'existe pas encore. Ignoré.',
          'PluginNotificationService',
        );
        return 0;
      }
      // Pour les autres erreurs, on les log mais on ne fait pas planter l'application
      this.logger.error(
        `Erreur lors du nettoyage des notifications expirées: ${error?.message || error}`,
        'PluginNotificationService',
      );
      return 0;
    }
  }

  /**
   * Supprime toutes les notifications d'un plugin
   */
  async removePluginNotifications(pluginId: string): Promise<void> {
    const notifications = await this.notificationRepository.find({
      where: { pluginId },
    });

    if (notifications.length > 0) {
      await this.notificationRepository.remove(notifications);

      this.logger.log(
        `${notifications.length} notification(s) supprimée(s) pour le plugin ${pluginId}`,
        'PluginNotificationService',
      );
    }
  }

  /**
   * Récupère les statistiques de notifications d'un plugin
   */
  async getPluginNotificationStats(pluginId: string): Promise<{
    total: number;
    sent: number;
    read: number;
    pending: number;
    expired: number;
  }> {
    const notifications = await this.notificationRepository.find({
      where: { pluginId },
    });

    return {
      total: notifications.length,
      sent: notifications.filter((n) => n.status === NotificationStatus.SENT)
        .length,
      read: notifications.filter((n) => n.status === NotificationStatus.READ)
        .length,
      pending: notifications.filter(
        (n) => n.status === NotificationStatus.PENDING,
      ).length,
      expired: notifications.filter(
        (n) => n.status === NotificationStatus.EXPIRED,
      ).length,
    };
  }
}

