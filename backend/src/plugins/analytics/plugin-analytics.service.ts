import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan } from 'typeorm';
import { PluginAnalytics, AnalyticsEventType } from './plugin-analytics.entity';
import { Plugin } from '../entities/plugin.entity';
import { LoggerService } from '../../logger/logger.service';

export interface AnalyticsStats {
  totalInstalls: number;
  totalUninstalls: number;
  activeInstalls: number;
  totalUsage: number;
  totalErrors: number;
  averageExecutionTime: number;
  successRate: number;
  uniqueUsers: number;
  popularityScore: number;
}

export interface TimeSeriesData {
  date: string;
  installs: number;
  uninstalls: number;
  usage: number;
  errors: number;
}

@Injectable()
export class PluginAnalyticsService implements OnModuleInit {
  private readonly logger: Logger;
  private readonly popularityCache = new Map<string, number>();
  private readonly cacheExpiry = 5 * 60 * 1000; // 5 minutes

  constructor(
    @InjectRepository(PluginAnalytics)
    private analyticsRepository: Repository<PluginAnalytics>,
    @InjectRepository(Plugin)
    private pluginRepository: Repository<Plugin>,
    private loggerService: LoggerService,
  ) {
    this.logger = new Logger(PluginAnalyticsService.name);
  }

  async onModuleInit() {
    // Nettoyer les anciennes données (plus de 1 an)
    await this.cleanupOldData();

    // Planifier le nettoyage périodique (tous les jours)
    setInterval(() => {
      this.cleanupOldData();
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Enregistre un événement d'analytics
   */
  async recordEvent(
    pluginId: string,
    eventType: AnalyticsEventType,
    metadata?: Record<string, any>,
    userId?: string,
    duration?: number,
    success: boolean = true,
  ): Promise<PluginAnalytics> {
    const analytics = this.analyticsRepository.create({
      pluginId,
      eventType,
      userId,
      metadata: metadata || {},
      duration,
      success,
    });

    const saved = await this.analyticsRepository.save(analytics);

    // Invalider le cache de popularité
    this.popularityCache.delete(pluginId);

    return saved;
  }

  /**
   * Récupère les statistiques pour un plugin
   */
  async getStats(
    pluginId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<AnalyticsStats> {
    const query = this.analyticsRepository.createQueryBuilder('analytics');

    query.where('analytics.pluginId = :pluginId', { pluginId });

    if (startDate && endDate) {
      query.andWhere('analytics.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    // Compter les installations
    const installs = await query
      .clone()
      .andWhere('analytics.eventType = :type', { type: AnalyticsEventType.INSTALL })
      .getCount();

    // Compter les désinstallations
    const uninstalls = await query
      .clone()
      .andWhere('analytics.eventType = :type', { type: AnalyticsEventType.UNINSTALL })
      .getCount();

    // Compter les utilisations
    const usage = await query
      .clone()
      .andWhere('analytics.eventType = :type', { type: AnalyticsEventType.USAGE })
      .getCount();

    // Compter les erreurs
    const errors = await query
      .clone()
      .andWhere('analytics.eventType = :type', { type: AnalyticsEventType.ERROR })
      .getCount();

    // Calculer le temps d'exécution moyen
    const executionEvents = await query
      .clone()
      .andWhere('analytics.duration IS NOT NULL')
      .getMany();

    const averageExecutionTime =
      executionEvents.length > 0
        ? executionEvents.reduce((sum, e) => sum + (e.duration || 0), 0) /
          executionEvents.length
        : 0;

    // Calculer le taux de réussite
    const totalEvents = await query.clone().getCount();
    const successfulEvents = await query
      .clone()
      .andWhere('analytics.success = :success', { success: true })
      .getCount();

    const successRate = totalEvents > 0 ? (successfulEvents / totalEvents) * 100 : 0;

    // Compter les utilisateurs uniques
    const uniqueUsersResult = await query
      .clone()
      .select('COUNT(DISTINCT analytics.userId)', 'count')
      .where('analytics.userId IS NOT NULL')
      .getRawOne();

    const uniqueUsers = parseInt(uniqueUsersResult?.count || '0', 10);

    // Calculer le score de popularité
    const popularityScore = await this.calculatePopularityScore(pluginId);

    // Installations actives = installations - désinstallations
    const activeInstalls = Math.max(0, installs - uninstalls);

    return {
      totalInstalls: installs,
      totalUninstalls: uninstalls,
      activeInstalls,
      totalUsage: usage,
      totalErrors: errors,
      averageExecutionTime: Math.round(averageExecutionTime),
      successRate: Math.round(successRate * 100) / 100,
      uniqueUsers,
      popularityScore,
    };
  }

  /**
   * Récupère les données de série temporelle
   */
  async getTimeSeries(
    pluginId: string,
    days: number = 30,
  ): Promise<TimeSeriesData[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const events = await this.analyticsRepository.find({
      where: {
        pluginId,
        createdAt: Between(startDate, endDate),
      },
      order: { createdAt: 'ASC' },
    });

    // Grouper par jour
    const groupedByDay = new Map<string, TimeSeriesData>();

    for (const event of events) {
      const dateKey = event.createdAt.toISOString().split('T')[0];

      if (!groupedByDay.has(dateKey)) {
        groupedByDay.set(dateKey, {
          date: dateKey,
          installs: 0,
          uninstalls: 0,
          usage: 0,
          errors: 0,
        });
      }

      const dayData = groupedByDay.get(dateKey)!;

      switch (event.eventType) {
        case AnalyticsEventType.INSTALL:
          dayData.installs++;
          break;
        case AnalyticsEventType.UNINSTALL:
          dayData.uninstalls++;
          break;
        case AnalyticsEventType.USAGE:
        case AnalyticsEventType.HOOK_EXECUTION:
        case AnalyticsEventType.ACTION_EXECUTION:
          dayData.usage++;
          break;
        case AnalyticsEventType.ERROR:
          dayData.errors++;
          break;
      }
    }

    return Array.from(groupedByDay.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }

  /**
   * Récupère les plugins les plus populaires
   */
  async getPopularPlugins(limit: number = 10): Promise<
    Array<{
      pluginId: string;
      pluginName: string;
      popularityScore: number;
      activeInstalls: number;
      totalUsage: number;
    }>
  > {
    const plugins = await this.pluginRepository.find();

    const pluginScores = await Promise.all(
      plugins.map(async (plugin) => {
        const stats = await this.getStats(plugin.id);
        return {
          pluginId: plugin.id,
          pluginName: plugin.name,
          popularityScore: stats.popularityScore,
          activeInstalls: stats.activeInstalls,
          totalUsage: stats.totalUsage,
        };
      }),
    );

    // Trier par score de popularité
    pluginScores.sort((a, b) => b.popularityScore - a.popularityScore);

    return pluginScores.slice(0, limit);
  }

  /**
   * Calcule le score de popularité d'un plugin
   */
  private async calculatePopularityScore(pluginId: string): Promise<number> {
    // Vérifier le cache
    const cached = this.popularityCache.get(pluginId);
    if (cached !== undefined) {
      return cached;
    }

    const stats = await this.getStats(pluginId);

    // Formule de popularité :
    // - Installations actives : 40%
    // - Utilisation : 30%
    // - Taux de réussite : 20%
    // - Utilisateurs uniques : 10%

    const installScore = Math.min(stats.activeInstalls * 10, 100); // Max 100 points
    const usageScore = Math.min(stats.totalUsage / 100, 100); // Max 100 points
    const successScore = stats.successRate; // 0-100
    const userScore = Math.min(stats.uniqueUsers * 5, 100); // Max 100 points

    const popularityScore =
      installScore * 0.4 +
      usageScore * 0.3 +
      successScore * 0.2 +
      userScore * 0.1;

    const roundedScore = Math.round(popularityScore * 100) / 100;

    // Mettre en cache
    this.popularityCache.set(pluginId, roundedScore);

    // Expirer le cache après 5 minutes
    setTimeout(() => {
      this.popularityCache.delete(pluginId);
    }, this.cacheExpiry);

    return roundedScore;
  }

  /**
   * Récupère les statistiques globales
   */
  async getGlobalStats(): Promise<{
    totalPlugins: number;
    totalInstalls: number;
    totalUsage: number;
    averagePopularity: number;
    topPlugins: Array<{
      pluginId: string;
      pluginName: string;
      popularityScore: number;
    }>;
  }> {
    const plugins = await this.pluginRepository.find();
    const allStats = await Promise.all(
      plugins.map((p) => this.getStats(p.id)),
    );

    const totalInstalls = allStats.reduce((sum, s) => sum + s.totalInstalls, 0);
    const totalUsage = allStats.reduce((sum, s) => sum + s.totalUsage, 0);
    const averagePopularity =
      allStats.length > 0
        ? allStats.reduce((sum, s) => sum + s.popularityScore, 0) /
          allStats.length
        : 0;

    const topPlugins = await this.getPopularPlugins(5);

    return {
      totalPlugins: plugins.length,
      totalInstalls,
      totalUsage,
      averagePopularity: Math.round(averagePopularity * 100) / 100,
      topPlugins: topPlugins.map((p) => ({
        pluginId: p.pluginId,
        pluginName: p.pluginName,
        popularityScore: p.popularityScore,
      })),
    };
  }

  /**
   * Nettoie les anciennes données
   */
  private async cleanupOldData(): Promise<void> {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const result = await this.analyticsRepository
      .createQueryBuilder()
      .delete()
      .where('createdAt < :date', { date: oneYearAgo })
      .execute();

    if (result.affected && result.affected > 0) {
      this.logger.debug(
        `${result.affected} anciennes entrées d'analytics supprimées`,
        'PluginAnalyticsService',
      );
    }
  }

  /**
   * Récupère les événements récents pour un plugin
   */
  async getRecentEvents(
    pluginId: string,
    limit: number = 50,
  ): Promise<PluginAnalytics[]> {
    return this.analyticsRepository.find({
      where: { pluginId },
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['plugin'],
    });
  }

  /**
   * Récupère les statistiques d'utilisation par type d'événement
   */
  async getStatsByEventType(pluginId: string): Promise<
    Record<AnalyticsEventType, number>
  > {
    const events = await this.analyticsRepository.find({
      where: { pluginId },
    });

    const stats: Record<string, number> = {};

    for (const eventType of Object.values(AnalyticsEventType)) {
      stats[eventType] = events.filter((e) => e.eventType === eventType).length;
    }

    return stats as Record<AnalyticsEventType, number>;
  }
}

