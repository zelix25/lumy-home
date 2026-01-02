import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan, DataSource, Table } from 'typeorm';
import {
  PluginAnalytics,
  AnalyticsEventType,
} from './entities/plugin-analytics.entity';
import { Plugin } from './entities/plugin.entity';
import { LoggerService } from '../logger/logger.service';

export interface TrackEventDto {
  eventType: AnalyticsEventType;
  userId?: string;
  metadata?: Record<string, any>;
  context?: string;
}

@Injectable()
export class PluginAnalyticsService implements OnModuleInit {
  private readonly logger: Logger;

  constructor(
    @InjectRepository(PluginAnalytics)
    private analyticsRepository: Repository<PluginAnalytics>,
    @InjectRepository(Plugin)
    private pluginRepository: Repository<Plugin>,
    private loggerService: LoggerService,
    private dataSource: DataSource,
  ) {
    this.logger = new Logger(PluginAnalyticsService.name);
  }

  async onModuleInit() {
    // Vérifier si la table existe, sinon la créer
    await this.ensureTableExists();
    // Nettoyer les anciennes analytics au démarrage
    await this.cleanupOldAnalytics();
    this.logger.log('Service d\'analytics de plugins initialisé', 'PluginAnalyticsService');
  }

  /**
   * Vérifie si la table existe et la crée si nécessaire
   */
  private async ensureTableExists(): Promise<void> {
    try {
      const queryRunner = this.dataSource.createQueryRunner();
      const tableExists = await queryRunner.hasTable('plugin_analytics');
      
      if (!tableExists) {
        this.logger.warn(
          'La table plugin_analytics n\'existe pas. Création en cours...',
          'PluginAnalyticsService',
        );
        // Créer la table en utilisant le schéma de l'entité
        const metadata = this.dataSource.getMetadata(PluginAnalytics);
        const table = Table.create(metadata, this.dataSource.driver);
        await queryRunner.createTable(table);
        this.logger.log(
          'Table plugin_analytics créée avec succès',
          'PluginAnalyticsService',
        );
      }
      
      await queryRunner.release();
    } catch (error: any) {
      // Si la table existe déjà ou si une autre erreur survient, on log mais on continue
      if (error?.message?.includes('already exists')) {
        this.logger.debug(
          'La table plugin_analytics existe déjà',
          'PluginAnalyticsService',
        );
      } else {
        this.logger.error(
          `Erreur lors de la vérification/création de la table plugin_analytics: ${error?.message || error}`,
          'PluginAnalyticsService',
        );
      }
    }
  }

  /**
   * Enregistre un événement d'analytics pour un plugin
   */
  async trackEvent(
    pluginId: string,
    eventDto: TrackEventDto,
  ): Promise<PluginAnalytics> {
    const plugin = await this.pluginRepository.findOne({
      where: { id: pluginId },
    });

    if (!plugin) {
      this.logger.warn(
        `Tentative d'enregistrement d'analytics pour un plugin inexistant: ${pluginId}`,
        'PluginAnalyticsService',
      );
      throw new Error(`Plugin ${pluginId} non trouvé`);
    }

    const analytics = this.analyticsRepository.create({
      pluginId,
      eventType: eventDto.eventType,
      userId: eventDto.userId || null,
      timestamp: new Date(),
      metadata: eventDto.metadata || null,
      context: eventDto.context || null,
    });

    const saved = await this.analyticsRepository.save(analytics);

    this.logger.debug(
      `Événement ${eventDto.eventType} enregistré pour le plugin ${plugin.name}`,
      'PluginAnalyticsService',
    );

    return saved;
  }

  /**
   * Récupère les statistiques d'un plugin
   */
  async getPluginStats(
    pluginId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalEvents: number;
    byEventType: Record<AnalyticsEventType, number>;
    installCount: number;
    activeUsers: number;
    errorCount: number;
    hookExecutions: number;
    notificationsSent: number;
    storageAccesses: number;
    apiCalls: number;
    popularity: number; // Score de popularité (0-100)
  }> {
    const where: any = { pluginId };

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp = Between(startDate, endDate || new Date());
      } else if (endDate) {
        where.timestamp = LessThan(endDate);
      }
    }

    const events = await this.analyticsRepository.find({
      where,
      order: { timestamp: 'DESC' },
    });

    const byEventType: Record<AnalyticsEventType, number> = {
      [AnalyticsEventType.INSTALL]: 0,
      [AnalyticsEventType.UNINSTALL]: 0,
      [AnalyticsEventType.ENABLE]: 0,
      [AnalyticsEventType.DISABLE]: 0,
      [AnalyticsEventType.ERROR]: 0,
      [AnalyticsEventType.HOOK_EXECUTED]: 0,
      [AnalyticsEventType.NOTIFICATION_SENT]: 0,
      [AnalyticsEventType.STORAGE_ACCESS]: 0,
      [AnalyticsEventType.API_CALL]: 0,
    };

    const uniqueUsers = new Set<string>();

    for (const event of events) {
      byEventType[event.eventType]++;
      if (event.userId) {
        uniqueUsers.add(event.userId);
      }
    }

    // Calculer le score de popularité (basé sur les installations, utilisations actives, etc.)
    const popularity = this.calculatePopularityScore(events, uniqueUsers.size);

    return {
      totalEvents: events.length,
      byEventType,
      installCount: byEventType[AnalyticsEventType.INSTALL],
      activeUsers: uniqueUsers.size,
      errorCount: byEventType[AnalyticsEventType.ERROR],
      hookExecutions: byEventType[AnalyticsEventType.HOOK_EXECUTED],
      notificationsSent: byEventType[AnalyticsEventType.NOTIFICATION_SENT],
      storageAccesses: byEventType[AnalyticsEventType.STORAGE_ACCESS],
      apiCalls: byEventType[AnalyticsEventType.API_CALL],
      popularity,
    };
  }

  /**
   * Récupère les événements d'un plugin
   */
  async getPluginEvents(
    pluginId: string,
    limit: number = 100,
    eventType?: AnalyticsEventType,
    startDate?: Date,
    endDate?: Date,
  ): Promise<PluginAnalytics[]> {
    const where: any = { pluginId };

    if (eventType) {
      where.eventType = eventType;
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate && endDate) {
        where.timestamp = Between(startDate, endDate);
      } else if (startDate) {
        where.timestamp = Between(startDate, new Date());
      } else if (endDate) {
        where.timestamp = LessThan(endDate);
      }
    }

    return this.analyticsRepository.find({
      where,
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  /**
   * Récupère les statistiques globales (tous les plugins)
   */
  async getGlobalStats(startDate?: Date, endDate?: Date): Promise<{
    totalPlugins: number;
    totalInstalls: number;
    totalActiveUsers: number;
    mostPopularPlugins: Array<{
      pluginId: string;
      pluginName: string;
      popularity: number;
      installCount: number;
    }>;
    recentActivity: number; // Événements des dernières 24h
  }> {
    const where: any = {};

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate && endDate) {
        where.timestamp = Between(startDate, endDate);
      } else if (startDate) {
        where.timestamp = Between(startDate, new Date());
      } else if (endDate) {
        where.timestamp = LessThan(endDate);
      }
    }

    const allEvents = await this.analyticsRepository.find({ where });
    const plugins = await this.pluginRepository.find();

    // Calculer les statistiques par plugin
    const pluginStats = new Map<string, {
      installCount: number;
      uniqueUsers: Set<string>;
      totalEvents: number;
    }>();

    for (const event of allEvents) {
      if (!pluginStats.has(event.pluginId)) {
        pluginStats.set(event.pluginId, {
          installCount: 0,
          uniqueUsers: new Set(),
          totalEvents: 0,
        });
      }

      const stats = pluginStats.get(event.pluginId)!;
      stats.totalEvents++;

      if (event.eventType === AnalyticsEventType.INSTALL) {
        stats.installCount++;
      }

      if (event.userId) {
        stats.uniqueUsers.add(event.userId);
      }
    }

    // Calculer la popularité de chaque plugin
    const pluginPopularities = Array.from(pluginStats.entries()).map(
      ([pluginId, stats]) => {
        const plugin = plugins.find((p) => p.id === pluginId);
        const popularity = this.calculatePopularityScore(
          allEvents.filter((e) => e.pluginId === pluginId),
          stats.uniqueUsers.size,
        );

        return {
          pluginId,
          pluginName: plugin?.displayName || plugin?.name || 'Unknown',
          popularity,
          installCount: stats.installCount,
        };
      },
    );

    // Trier par popularité
    pluginPopularities.sort((a, b) => b.popularity - a.popularity);

    // Événements des dernières 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentEvents = allEvents.filter(
      (e) => e.timestamp >= oneDayAgo,
    ).length;

    // Utilisateurs uniques
    const allUniqueUsers = new Set<string>();
    allEvents.forEach((e) => {
      if (e.userId) allUniqueUsers.add(e.userId);
    });

    return {
      totalPlugins: plugins.length,
      totalInstalls: Array.from(pluginStats.values()).reduce(
        (sum, stats) => sum + stats.installCount,
        0,
      ),
      totalActiveUsers: allUniqueUsers.size,
      mostPopularPlugins: pluginPopularities.slice(0, 10),
      recentActivity: recentEvents,
    };
  }

  /**
   * Calcule le score de popularité d'un plugin (0-100)
   */
  private calculatePopularityScore(
    events: PluginAnalytics[],
    uniqueUsers: number,
  ): number {
    if (events.length === 0) return 0;

    const installCount = events.filter(
      (e) => e.eventType === AnalyticsEventType.INSTALL,
    ).length;

    const errorCount = events.filter(
      (e) => e.eventType === AnalyticsEventType.ERROR,
    ).length;

    const usageCount =
      events.filter(
        (e) =>
          e.eventType === AnalyticsEventType.HOOK_EXECUTED ||
          e.eventType === AnalyticsEventType.API_CALL ||
          e.eventType === AnalyticsEventType.STORAGE_ACCESS,
      ).length;

    // Score basé sur :
    // - Installations (40%)
    // - Utilisateurs uniques (30%)
    // - Utilisations (20%)
    // - Taux d'erreur (10% - pénalité)
    const installScore = Math.min(installCount * 10, 40);
    const userScore = Math.min(uniqueUsers * 5, 30);
    const usageScore = Math.min(usageCount / 10, 20);
    const errorPenalty = Math.min((errorCount / events.length) * 100, 10);

    const score = installScore + userScore + usageScore - errorPenalty;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Nettoie les anciennes analytics (plus de 90 jours)
   */
  async cleanupOldAnalytics(): Promise<number> {
    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const result = await this.analyticsRepository
        .createQueryBuilder()
        .delete()
        .from(PluginAnalytics)
        .where('timestamp < :date', { date: ninetyDaysAgo })
        .execute();

      const count = result.affected || 0;

      if (count > 0) {
        this.logger.log(
          `${count} événement(s) d'analytics ancien(s) supprimé(s)`,
          'PluginAnalyticsService',
        );
      }

      return count;
    } catch (error: any) {
      // Si la table n'existe pas encore (en production avec synchronize=false),
      // on ignore l'erreur et on retourne 0
      if (error?.code === 'SQLITE_ERROR' && error?.message?.includes('no such table')) {
        this.logger.warn(
          'La table plugin_analytics n\'existe pas encore. Ignoré.',
          'PluginAnalyticsService',
        );
        return 0;
      }
      // Pour les autres erreurs, on les log mais on ne fait pas planter l'application
      this.logger.error(
        `Erreur lors du nettoyage des anciennes analytics: ${error?.message || error}`,
        'PluginAnalyticsService',
      );
      return 0;
    }
  }

  /**
   * Nettoie les anciennes analytics toutes les semaines
   */
  @Cron(CronExpression.EVERY_WEEK)
  async scheduledCleanup() {
    await this.cleanupOldAnalytics();
  }

  /**
   * Supprime toutes les analytics d'un plugin
   */
  async removePluginAnalytics(pluginId: string): Promise<number> {
    const result = await this.analyticsRepository.delete({ pluginId });
    const count = result.affected || 0;

    if (count > 0) {
      this.logger.log(
        `${count} événement(s) d'analytics supprimé(s) pour le plugin ${pluginId}`,
        'PluginAnalyticsService',
      );
    }

    return count;
  }
}

