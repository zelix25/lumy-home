import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { Plugin } from './entities/plugin.entity';
import { PluginError, ErrorSeverity } from './entities/plugin-error.entity';
import { PluginTestRun } from './entities/plugin-test-run.entity';
import { TestStatus } from './entities/plugin-test.entity';
import { PluginAnalytics, AnalyticsEventType } from './entities/plugin-analytics.entity';
import { PluginStorage } from './entities/plugin-storage.entity';
import { LoggerService } from '../logger/logger.service';
import { PluginCircuitBreakerService, CircuitState } from './plugin-circuit-breaker.service';

export interface PluginMetrics {
  pluginId: string;
  pluginName: string;
  status: string;
  uptime: number; // En secondes
  errorRate: number; // Pourcentage d'erreurs
  averageResponseTime: number; // En millisecondes
  memoryUsage: number; // En octets
  cpuUsage: number; // Pourcentage
  requestCount: number;
  successCount: number;
  failureCount: number;
  circuitBreakerState: CircuitState | null;
  lastError?: Date;
  lastSuccess?: Date;
}

export interface ExecutionStats {
  pluginId: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number; // En millisecondes
  minExecutionTime: number;
  maxExecutionTime: number;
  executionsByHour: Record<string, number>; // Heure -> nombre d'exécutions
}

@Injectable()
export class PluginMonitoringService implements OnModuleInit {
  private readonly logger: Logger;
  private readonly executionMetrics: Map<
    string,
    {
      executions: Array<{ timestamp: Date; duration: number; success: boolean }>;
      lastExecution?: Date;
    }
  > = new Map();

  constructor(
    @InjectRepository(Plugin)
    private pluginRepository: Repository<Plugin>,
    @InjectRepository(PluginError)
    private errorRepository: Repository<PluginError>,
    @InjectRepository(PluginTestRun)
    private testRunRepository: Repository<PluginTestRun>,
    @InjectRepository(PluginAnalytics)
    private analyticsRepository: Repository<PluginAnalytics>,
    @InjectRepository(PluginStorage)
    private storageRepository: Repository<PluginStorage>,
    private loggerService: LoggerService,
    private circuitBreakerService: PluginCircuitBreakerService,
  ) {
    this.logger = new Logger(PluginMonitoringService.name);
  }

  async onModuleInit() {
    this.logger.log('Service de monitoring de plugins initialisé', 'PluginMonitoringService');
  }

  /**
   * Enregistre une exécution de plugin
   */
  recordExecution(
    pluginId: string,
    duration: number,
    success: boolean,
  ): void {
    if (!this.executionMetrics.has(pluginId)) {
      this.executionMetrics.set(pluginId, {
        executions: [],
      });
    }

    const metrics = this.executionMetrics.get(pluginId)!;
    metrics.executions.push({
      timestamp: new Date(),
      duration,
      success,
    });
    metrics.lastExecution = new Date();

    // Garder seulement les 1000 dernières exécutions
    if (metrics.executions.length > 1000) {
      metrics.executions = metrics.executions.slice(-1000);
    }
  }

  /**
   * Récupère les métriques d'un plugin
   */
  async getPluginMetrics(pluginId: string): Promise<PluginMetrics> {
    const plugin = await this.pluginRepository.findOne({
      where: { id: pluginId },
    });

    if (!plugin) {
      throw new Error(`Plugin ${pluginId} non trouvé`);
    }

    // Récupérer les erreurs récentes (30 derniers jours)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentErrors = await this.errorRepository.count({
      where: {
        pluginId,
        createdAt: MoreThan(thirtyDaysAgo),
      },
    });

    // Récupérer les analytics récentes
    const recentAnalytics = await this.analyticsRepository.find({
      where: {
        pluginId,
        timestamp: MoreThan(thirtyDaysAgo),
      },
      take: 1000,
    });

    const requestCount = recentAnalytics.filter(
      (a) => a.eventType === AnalyticsEventType.API_CALL,
    ).length;

    const successCount = requestCount - recentErrors;
    const failureCount = recentErrors;

    // Calculer le taux d'erreur
    const errorRate =
      requestCount > 0 ? (failureCount / requestCount) * 100 : 0;

    // Récupérer les métriques d'exécution
    const executionMetrics = this.executionMetrics.get(pluginId);
    const averageResponseTime = executionMetrics
      ? executionMetrics.executions.length > 0
        ? executionMetrics.executions.reduce(
            (sum, e) => sum + e.duration,
            0,
          ) / executionMetrics.executions.length
        : 0
      : 0;

    // Récupérer l'état du circuit breaker
    const circuitBreakerState = this.circuitBreakerService.getCircuitState(
      pluginId,
    );

    // Calculer l'uptime (simplifié - basé sur la dernière erreur)
    const lastError = await this.errorRepository.findOne({
      where: { pluginId },
      order: { createdAt: 'DESC' },
    });

    const uptime = lastError
      ? Math.floor(
          (Date.now() - lastError.createdAt.getTime()) / 1000,
        )
      : 0;

    return {
      pluginId,
      pluginName: plugin.displayName || plugin.name,
      status: plugin.status,
      uptime,
      errorRate,
      averageResponseTime,
      memoryUsage: 0, // À implémenter avec des outils de monitoring système
      cpuUsage: 0, // À implémenter avec des outils de monitoring système
      requestCount,
      successCount,
      failureCount,
      circuitBreakerState,
      lastError: lastError?.createdAt,
      lastSuccess: executionMetrics?.lastExecution,
    };
  }

  /**
   * Récupère les statistiques d'exécution d'un plugin
   */
  async getExecutionStats(pluginId: string): Promise<ExecutionStats> {
    const executionMetrics = this.executionMetrics.get(pluginId);

    if (!executionMetrics || executionMetrics.executions.length === 0) {
      return {
        pluginId,
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageExecutionTime: 0,
        minExecutionTime: 0,
        maxExecutionTime: 0,
        executionsByHour: {},
      };
    }

    const executions = executionMetrics.executions;
    const successfulExecutions = executions.filter((e) => e.success).length;
    const failedExecutions = executions.filter((e) => !e.success).length;

    const durations = executions.map((e) => e.duration);
    const averageExecutionTime =
      durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const minExecutionTime = Math.min(...durations);
    const maxExecutionTime = Math.max(...durations);

    // Grouper par heure
    const executionsByHour: Record<string, number> = {};
    for (const execution of executions) {
      const hour = execution.timestamp.toISOString().substring(0, 13); // YYYY-MM-DDTHH
      executionsByHour[hour] = (executionsByHour[hour] || 0) + 1;
    }

    return {
      pluginId,
      totalExecutions: executions.length,
      successfulExecutions,
      failedExecutions,
      averageExecutionTime,
      minExecutionTime,
      maxExecutionTime,
      executionsByHour,
    };
  }

  /**
   * Récupère les métriques de tous les plugins
   */
  async getAllPluginsMetrics(): Promise<PluginMetrics[]> {
    const plugins = await this.pluginRepository.find();
    const metrics: PluginMetrics[] = [];

    for (const plugin of plugins) {
      try {
        const pluginMetrics = await this.getPluginMetrics(plugin.id);
        metrics.push(pluginMetrics);
      } catch (error: any) {
        this.logger.warn(
          `Erreur lors de la récupération des métriques pour ${plugin.name}: ${error.message}`,
          'PluginMonitoringService',
        );
      }
    }

    return metrics;
  }

  /**
   * Récupère un rapport de santé pour un plugin
   */
  async getHealthReport(pluginId: string): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    score: number; // 0-100
    issues: string[];
    recommendations: string[];
  }> {
    const plugin = await this.pluginRepository.findOne({
      where: { id: pluginId },
    });

    if (!plugin) {
      throw new Error(`Plugin ${pluginId} non trouvé`);
    }

    const metrics = await this.getPluginMetrics(pluginId);
    const executionStats = await this.getExecutionStats(pluginId);

    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    // Vérifier le statut du plugin
    if (plugin.status === 'error') {
      issues.push('Le plugin est en état d\'erreur');
      score -= 30;
    }

    // Vérifier le taux d'erreur
    if (metrics.errorRate > 10) {
      issues.push(`Taux d'erreur élevé: ${metrics.errorRate.toFixed(2)}%`);
      score -= 20;
      recommendations.push('Vérifier les logs d\'erreur et corriger les problèmes');
    }

    // Vérifier le circuit breaker
    if (metrics.circuitBreakerState === CircuitState.OPEN) {
      issues.push('Circuit breaker ouvert - le plugin est temporairement désactivé');
      score -= 25;
      recommendations.push('Attendre la récupération automatique ou réinitialiser le circuit breaker');
    }

    // Vérifier les performances
    if (metrics.averageResponseTime > 5000) {
      issues.push(`Temps de réponse moyen élevé: ${metrics.averageResponseTime.toFixed(2)}ms`);
      score -= 15;
      recommendations.push('Optimiser les performances du plugin');
    }

    // Vérifier le taux de succès
    const successRate =
      metrics.requestCount > 0
        ? (metrics.successCount / metrics.requestCount) * 100
        : 100;

    if (successRate < 80) {
      issues.push(`Taux de succès faible: ${successRate.toFixed(2)}%`);
      score -= 20;
      recommendations.push('Améliorer la fiabilité du plugin');
    }

    // Déterminer le statut global
    let status: 'healthy' | 'warning' | 'critical';
    if (score >= 80) {
      status = 'healthy';
    } else if (score >= 50) {
      status = 'warning';
    } else {
      status = 'critical';
    }

    return {
      status,
      score: Math.max(0, Math.min(100, score)),
      issues,
      recommendations,
    };
  }

  /**
   * Nettoie les métriques d'exécution anciennes (plus de 7 jours)
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExecutionMetrics(): Promise<void> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    for (const [pluginId, metrics] of this.executionMetrics.entries()) {
      metrics.executions = metrics.executions.filter(
        (e) => e.timestamp >= sevenDaysAgo,
      );

      if (metrics.executions.length === 0) {
        this.executionMetrics.delete(pluginId);
      }
    }
  }
}

