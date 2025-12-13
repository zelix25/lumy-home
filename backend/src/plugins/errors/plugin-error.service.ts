import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { PluginError, ErrorType, ErrorSeverity } from './plugin-error.entity';
import { Plugin } from '../entities/plugin.entity';
import { LoggerService } from '../../logger/logger.service';
import { PluginsService } from '../plugins.service';
import { forwardRef, Inject } from '@nestjs/common';

interface ErrorContext {
  hook?: string;
  action?: string;
  trigger?: string;
  extension?: string;
  [key: string]: any;
}

@Injectable()
export class PluginErrorService implements OnModuleInit {
  private readonly logger: Logger;
  private readonly errorCounts = new Map<string, number>(); // pluginId -> nombre d'erreurs récentes
  private readonly lastErrorTime = new Map<string, Date>(); // pluginId -> dernière erreur
  private readonly circuitBreakers = new Map<string, boolean>(); // pluginId -> circuit ouvert/fermé

  // Configuration
  private readonly MAX_ERRORS_PER_MINUTE = 10; // Nombre max d'erreurs par minute avant désactivation
  private readonly ERROR_WINDOW_MS = 60 * 1000; // Fenêtre de 1 minute
  private readonly CIRCUIT_BREAKER_RESET_MS = 5 * 60 * 1000; // Réinitialisation après 5 minutes
  private readonly MAX_ERRORS_TO_KEEP = 1000; // Nombre max d'erreurs à conserver par plugin

  constructor(
    @InjectRepository(PluginError)
    private errorRepository: Repository<PluginError>,
    @InjectRepository(Plugin)
    private pluginRepository: Repository<Plugin>,
    private loggerService: LoggerService,
    @Inject(forwardRef(() => PluginsService))
    private pluginsService: PluginsService,
  ) {
    this.logger = new Logger(PluginErrorService.name);
  }

  async onModuleInit() {
    // Nettoyer les anciennes erreurs au démarrage
    await this.cleanupOldErrors();
    
    // Planifier le nettoyage périodique (toutes les heures)
    setInterval(() => {
      this.cleanupOldErrors();
    }, 60 * 60 * 1000);
  }

  /**
   * Enregistre une erreur pour un plugin
   */
  async recordError(
    pluginId: string,
    error: Error | string,
    context?: ErrorContext,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
  ): Promise<PluginError> {
    // Vérifier que le plugin existe
    const plugin = await this.pluginRepository.findOne({
      where: { id: pluginId },
    });

    if (!plugin) {
      this.logger.warn(
        `Tentative d'enregistrement d'erreur pour un plugin inexistant: ${pluginId}`,
        'PluginErrorService',
      );
      return null as any;
    }

    // Extraire les informations de l'erreur
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    const errorType = this.determineErrorType(error);

    // Créer l'entrée d'erreur
    const pluginError = this.errorRepository.create({
      pluginId,
      type: errorType,
      severity,
      message,
      stack,
      context: context ? JSON.stringify(context) : undefined,
      metadata: {
        pluginName: plugin.name,
        pluginVersion: plugin.version,
        ...context,
      },
      resolved: false,
    });

    const saved = await this.errorRepository.save(pluginError) as PluginError;

    // Logger l'erreur
    this.logger.error(
      `[${plugin.name}] ${message}`,
      stack,
      'PluginErrorService',
    );

    // Mettre à jour les compteurs
    await this.updateErrorCounters(pluginId);

    // Vérifier le circuit breaker
    await this.checkCircuitBreaker(pluginId);

    // Limiter le nombre d'erreurs stockées
    await this.limitStoredErrors(pluginId);

    return saved;
  }

  /**
   * Détermine le type d'erreur
   */
  private determineErrorType(error: Error | string): ErrorType {
    if (typeof error === 'string') {
      return ErrorType.UNKNOWN;
    }

    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    if (message.includes('permission') || message.includes('access denied')) {
      return ErrorType.PERMISSION;
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorType.VALIDATION;
    }
    if (message.includes('network') || message.includes('fetch') || message.includes('http')) {
      return ErrorType.NETWORK;
    }
    if (message.includes('timeout') || message.includes('timed out')) {
      return ErrorType.TIMEOUT;
    }
    if (message.includes('memory') || stack.includes('out of memory')) {
      return ErrorType.MEMORY;
    }

    return ErrorType.RUNTIME;
  }

  /**
   * Met à jour les compteurs d'erreurs
   */
  private async updateErrorCounters(pluginId: string): Promise<void> {
    const now = new Date();
    const lastError = this.lastErrorTime.get(pluginId);

    // Réinitialiser le compteur si la fenêtre de temps est passée
    if (!lastError || now.getTime() - lastError.getTime() > this.ERROR_WINDOW_MS) {
      this.errorCounts.set(pluginId, 1);
    } else {
      const count = this.errorCounts.get(pluginId) || 0;
      this.errorCounts.set(pluginId, count + 1);
    }

    this.lastErrorTime.set(pluginId, now);
  }

  /**
   * Vérifie le circuit breaker et désactive le plugin si nécessaire
   */
  private async checkCircuitBreaker(pluginId: string): Promise<void> {
    const errorCount = this.errorCounts.get(pluginId) || 0;

    if (errorCount >= this.MAX_ERRORS_PER_MINUTE) {
      const plugin = await this.pluginRepository.findOne({
        where: { id: pluginId },
      });

      if (plugin && plugin.status === 'enabled') {
        // Ouvrir le circuit breaker
        this.circuitBreakers.set(pluginId, true);

        // Désactiver le plugin
        try {
          await this.pluginsService.disable(pluginId);
          this.logger.warn(
            `Plugin ${plugin.name} désactivé automatiquement après ${errorCount} erreurs en 1 minute`,
            'PluginErrorService',
          );

          // Enregistrer une erreur critique pour cette désactivation
          await this.recordError(
            pluginId,
            new Error(
              `Plugin désactivé automatiquement après ${errorCount} erreurs en 1 minute`,
            ),
            { action: 'auto_disable' },
            ErrorSeverity.CRITICAL,
          );
        } catch (error) {
          this.logger.error(
            `Erreur lors de la désactivation automatique du plugin ${plugin.name}`,
            error instanceof Error ? error.stack : String(error),
            'PluginErrorService',
          );
        }
      }
    }
  }

  /**
   * Limite le nombre d'erreurs stockées par plugin
   */
  private async limitStoredErrors(pluginId: string): Promise<void> {
    const count = await this.errorRepository.count({
      where: { pluginId },
    });

    if (count > this.MAX_ERRORS_TO_KEEP) {
      // Supprimer les erreurs les plus anciennes
      const errorsToDelete = await this.errorRepository.find({
        where: { pluginId },
        order: { createdAt: 'ASC' },
        take: count - this.MAX_ERRORS_TO_KEEP,
      });

      if (errorsToDelete.length > 0) {
        await this.errorRepository.remove(errorsToDelete);
      }
    }
  }

  /**
   * Récupère toutes les erreurs d'un plugin
   */
  async getPluginErrors(
    pluginId: string,
    filters?: {
      type?: ErrorType;
      severity?: ErrorSeverity;
      resolved?: boolean;
      limit?: number;
    },
  ): Promise<PluginError[]> {
    const query = this.errorRepository.createQueryBuilder('error');

    query.where('error.pluginId = :pluginId', { pluginId });

    if (filters?.type) {
      query.andWhere('error.type = :type', { type: filters.type });
    }

    if (filters?.severity) {
      query.andWhere('error.severity = :severity', { severity: filters.severity });
    }

    if (filters?.resolved !== undefined) {
      query.andWhere('error.resolved = :resolved', { resolved: filters.resolved });
    }

    query
      .orderBy('error.createdAt', 'DESC')
      .leftJoinAndSelect('error.plugin', 'plugin');

    if (filters?.limit) {
      query.limit(filters.limit);
    }

    return query.getMany();
  }

  /**
   * Récupère une erreur par son ID
   */
  async getError(id: string): Promise<PluginError> {
    const error = await this.errorRepository.findOne({
      where: { id },
      relations: ['plugin'],
    });

    if (!error) {
      throw new Error(`Erreur ${id} non trouvée`);
    }

    return error;
  }

  /**
   * Marque une erreur comme résolue
   */
  async resolveError(id: string): Promise<PluginError> {
    const error = await this.getError(id);
    error.resolved = true;
    error.resolvedAt = new Date();
    return this.errorRepository.save(error);
  }

  /**
   * Récupère les statistiques d'erreurs pour un plugin
   */
  async getErrorStats(pluginId: string): Promise<{
    total: number;
    byType: Record<ErrorType, number>;
    bySeverity: Record<ErrorSeverity, number>;
    unresolved: number;
    recentErrors: number; // Erreurs dans les dernières 24h
    errorRate: number; // Erreurs par heure
  }> {
    const allErrors = await this.errorRepository.find({
      where: { pluginId },
    });

    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recentErrors = allErrors.filter(
      (e) => e.createdAt >= last24Hours,
    );

    const byType: Record<ErrorType, number> = {
      [ErrorType.RUNTIME]: 0,
      [ErrorType.PERMISSION]: 0,
      [ErrorType.VALIDATION]: 0,
      [ErrorType.NETWORK]: 0,
      [ErrorType.TIMEOUT]: 0,
      [ErrorType.MEMORY]: 0,
      [ErrorType.UNKNOWN]: 0,
    };

    const bySeverity: Record<ErrorSeverity, number> = {
      [ErrorSeverity.LOW]: 0,
      [ErrorSeverity.MEDIUM]: 0,
      [ErrorSeverity.HIGH]: 0,
      [ErrorSeverity.CRITICAL]: 0,
    };

    for (const error of allErrors) {
      byType[error.type]++;
      bySeverity[error.severity]++;
    }

    // Calculer le taux d'erreurs par heure
    const plugin = await this.pluginRepository.findOne({
      where: { id: pluginId },
    });
    let errorRate = 0;
    if (plugin && plugin.createdAt) {
      const hoursSinceInstallation =
        (now.getTime() - plugin.createdAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceInstallation > 0) {
        errorRate = allErrors.length / hoursSinceInstallation;
      }
    }

    return {
      total: allErrors.length,
      byType,
      bySeverity,
      unresolved: allErrors.filter((e) => !e.resolved).length,
      recentErrors: recentErrors.length,
      errorRate: Math.round(errorRate * 100) / 100,
    };
  }

  /**
   * Vérifie si le circuit breaker est ouvert pour un plugin
   */
  isCircuitBreakerOpen(pluginId: string): boolean {
    return this.circuitBreakers.get(pluginId) === true;
  }

  /**
   * Réinitialise le circuit breaker pour un plugin
   */
  async resetCircuitBreaker(pluginId: string): Promise<void> {
    this.circuitBreakers.set(pluginId, false);
    this.errorCounts.set(pluginId, 0);
    this.lastErrorTime.delete(pluginId);
  }

  /**
   * Nettoie les anciennes erreurs résolues
   */
  private async cleanupOldErrors(): Promise<void> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await this.errorRepository.delete({
      resolved: true,
      resolvedAt: LessThan(thirtyDaysAgo),
    });

    if (result.affected && result.affected > 0) {
      this.logger.debug(
        `${result.affected} anciennes erreurs supprimées`,
        'PluginErrorService',
      );
    }
  }

  /**
   * Wrapper pour exécuter du code plugin avec gestion d'erreurs
   */
  async executeWithErrorHandling<T>(
    pluginId: string,
    fn: () => Promise<T>,
    context?: ErrorContext,
  ): Promise<T | null> {
    // Vérifier le circuit breaker
    if (this.isCircuitBreakerOpen(pluginId)) {
      this.logger.warn(
        `Circuit breaker ouvert pour le plugin ${pluginId}, exécution ignorée`,
        'PluginErrorService',
      );
      return null;
    }

    try {
      return await fn();
    } catch (error) {
      await this.recordError(
        pluginId,
        error instanceof Error ? error : new Error(String(error)),
        context,
      );
      return null;
    }
  }

  /**
   * Supprime toutes les erreurs d'un plugin
   */
  async clearPluginErrors(pluginId: string): Promise<number> {
    const result = await this.errorRepository.delete({ pluginId });
    return result.affected || 0;
  }
}

