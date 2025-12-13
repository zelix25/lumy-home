import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../logger/logger.service';
import { Plugin } from '../entities/plugin.entity';
import { PluginLoggerService } from './plugin-logger.service';

export interface PluginMetrics {
  pluginId: string;
  pluginName: string;
  startTime: Date;
  lastActivity: Date;
  executionCount: number;
  errorCount: number;
  averageExecutionTime: number;
  totalExecutionTime: number;
  memoryUsage?: number;
  cpuUsage?: number;
}

export interface PluginPerformanceEntry {
  timestamp: Date;
  pluginId: string;
  pluginName: string;
  operation: string;
  duration: number;
  success: boolean;
  error?: string;
}

@Injectable()
export class PluginMonitoringService {
  private metrics: Map<string, PluginMetrics> = new Map();
  private performanceHistory: Map<string, PluginPerformanceEntry[]> = new Map();
  private readonly maxHistorySize = 1000;

  constructor(
    private loggerService: LoggerService,
    private pluginLogger: PluginLoggerService,
  ) {}

  /**
   * Initialise les métriques pour un plugin
   */
  initializeMetrics(plugin: Plugin): void {
    const metrics: PluginMetrics = {
      pluginId: plugin.id,
      pluginName: plugin.name,
      startTime: new Date(),
      lastActivity: new Date(),
      executionCount: 0,
      errorCount: 0,
      averageExecutionTime: 0,
      totalExecutionTime: 0,
    };

    this.metrics.set(plugin.id, metrics);
    this.performanceHistory.set(plugin.id, []);

    this.pluginLogger.log(plugin.id, plugin.name, 'info', 'Plugin monitoring initialized');
  }

  /**
   * Enregistre l'exécution d'une opération
   */
  recordExecution(
    pluginId: string,
    pluginName: string,
    operation: string,
    duration: number,
    success: boolean,
    error?: string,
  ): void {
    const metrics = this.metrics.get(pluginId);
    if (!metrics) {
      return;
    }

    metrics.executionCount++;
    metrics.lastActivity = new Date();
    metrics.totalExecutionTime += duration;
    metrics.averageExecutionTime = metrics.totalExecutionTime / metrics.executionCount;

    if (!success) {
      metrics.errorCount++;
      this.pluginLogger.log(pluginId, pluginName, 'error', `Operation ${operation} failed`, { error, duration });
    } else {
      this.pluginLogger.log(pluginId, pluginName, 'debug', `Operation ${operation} completed`, { duration });
    }

    // Enregistrer dans l'historique de performance
    const history = this.performanceHistory.get(pluginId) || [];
    history.push({
      timestamp: new Date(),
      pluginId,
      pluginName,
      operation,
      duration,
      success,
      error,
    });

    // Limiter la taille de l'historique
    if (history.length > this.maxHistorySize) {
      history.shift();
    }

    this.performanceHistory.set(pluginId, history);
  }

  /**
   * Récupère les métriques d'un plugin
   */
  getMetrics(pluginId: string): PluginMetrics | null {
    return this.metrics.get(pluginId) || null;
  }

  /**
   * Récupère toutes les métriques
   */
  getAllMetrics(): PluginMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Récupère l'historique de performance d'un plugin
   */
  getPerformanceHistory(
    pluginId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      operation?: string;
      limit?: number;
    },
  ): PluginPerformanceEntry[] {
    const history = this.performanceHistory.get(pluginId) || [];
    const { startDate, endDate, operation, limit = 100 } = options || {};

    let filtered = history;

    // Filtrer par date
    if (startDate || endDate) {
      filtered = filtered.filter((entry) => {
        const entryDate = new Date(entry.timestamp);
        if (startDate && entryDate < startDate) {
          return false;
        }
        if (endDate && entryDate > endDate) {
          return false;
        }
        return true;
      });
    }

    // Filtrer par opération
    if (operation) {
      filtered = filtered.filter((entry) => entry.operation === operation);
    }

    // Trier par timestamp (plus récent en premier)
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Limiter le nombre de résultats
    return filtered.slice(0, limit);
  }

  /**
   * Réinitialise les métriques d'un plugin
   */
  resetMetrics(pluginId: string): void {
    const metrics = this.metrics.get(pluginId);
    if (metrics) {
      metrics.executionCount = 0;
      metrics.errorCount = 0;
      metrics.averageExecutionTime = 0;
      metrics.totalExecutionTime = 0;
      metrics.lastActivity = new Date();
    }

    this.performanceHistory.set(pluginId, []);
  }

  /**
   * Supprime les métriques d'un plugin
   */
  removeMetrics(pluginId: string): void {
    this.metrics.delete(pluginId);
    this.performanceHistory.delete(pluginId);
  }

  /**
   * Récupère les statistiques agrégées
   */
  getAggregatedStats(): {
    totalPlugins: number;
    totalExecutions: number;
    totalErrors: number;
    averageExecutionTime: number;
    pluginsWithErrors: number;
  } {
    const allMetrics = Array.from(this.metrics.values());

    const totalExecutions = allMetrics.reduce((sum, m) => sum + m.executionCount, 0);
    const totalErrors = allMetrics.reduce((sum, m) => sum + m.errorCount, 0);
    const totalExecutionTime = allMetrics.reduce((sum, m) => sum + m.totalExecutionTime, 0);
    const pluginsWithErrors = allMetrics.filter((m) => m.errorCount > 0).length;

    return {
      totalPlugins: allMetrics.length,
      totalExecutions,
      totalErrors,
      averageExecutionTime: totalExecutions > 0 ? totalExecutionTime / totalExecutions : 0,
      pluginsWithErrors,
    };
  }

  /**
   * Mesure le temps d'exécution d'une opération
   */
  async measureExecution<T>(
    pluginId: string,
    pluginName: string,
    operation: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const startTime = Date.now();
    let success = true;
    let error: string | undefined;

    try {
      const result = await fn();
      return result;
    } catch (err: any) {
      success = false;
      error = err.message;
      throw err;
    } finally {
      const duration = Date.now() - startTime;
      this.recordExecution(pluginId, pluginName, operation, duration, success, error);
    }
  }
}

