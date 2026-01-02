import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, DataSource, Table } from 'typeorm';
import {
  PluginError,
  ErrorSeverity,
  ErrorStatus,
} from './entities/plugin-error.entity';
import { Plugin } from './entities/plugin.entity';
import { LoggerService } from '../logger/logger.service';

export interface LogErrorDto {
  errorType: string;
  message: string;
  stack?: string;
  context?: string;
  severity?: ErrorSeverity;
  metadata?: Record<string, any>;
}

@Injectable()
export class PluginErrorService implements OnModuleInit {
  private readonly logger: Logger;

  constructor(
    @InjectRepository(PluginError)
    private errorRepository: Repository<PluginError>,
    @InjectRepository(Plugin)
    private pluginRepository: Repository<Plugin>,
    private loggerService: LoggerService,
    private dataSource: DataSource,
  ) {
    this.logger = new Logger(PluginErrorService.name);
  }

  async onModuleInit() {
    // Vérifier si la table existe, sinon la créer
    await this.ensureTableExists();
    // Nettoyer les anciennes erreurs au démarrage
    await this.cleanupOldErrors();
    this.logger.log('Service de gestion d\'erreurs de plugins initialisé', 'PluginErrorService');
  }

  /**
   * Vérifie si la table existe et la crée si nécessaire
   */
  private async ensureTableExists(): Promise<void> {
    try {
      const queryRunner = this.dataSource.createQueryRunner();
      const tableExists = await queryRunner.hasTable('plugin_errors');
      
      if (!tableExists) {
        this.logger.warn(
          'La table plugin_errors n\'existe pas. Création en cours...',
          'PluginErrorService',
        );
        // Créer la table en utilisant le schéma de l'entité
        const metadata = this.dataSource.getMetadata(PluginError);
        const table = Table.create(metadata, this.dataSource.driver);
        await queryRunner.createTable(table);
        this.logger.log(
          'Table plugin_errors créée avec succès',
          'PluginErrorService',
        );
      }
      
      await queryRunner.release();
    } catch (error: any) {
      // Si la table existe déjà ou si une autre erreur survient, on log mais on continue
      if (error?.message?.includes('already exists')) {
        this.logger.debug(
          'La table plugin_errors existe déjà',
          'PluginErrorService',
        );
      } else {
        this.logger.error(
          `Erreur lors de la vérification/création de la table plugin_errors: ${error?.message || error}`,
          'PluginErrorService',
        );
      }
    }
  }

  /**
   * Enregistre une erreur pour un plugin
   */
  async logError(pluginId: string, errorDto: LogErrorDto): Promise<PluginError> {
    const plugin = await this.pluginRepository.findOne({
      where: { id: pluginId },
    });

    if (!plugin) {
      this.logger.warn(
        `Tentative d'enregistrement d'erreur pour un plugin inexistant: ${pluginId}`,
        'PluginErrorService',
      );
      throw new Error(`Plugin ${pluginId} non trouvé`);
    }

    // Vérifier si une erreur similaire existe déjà (même type et message)
    const existingError = await this.errorRepository.findOne({
      where: {
        pluginId,
        errorType: errorDto.errorType,
        message: errorDto.message,
        status: ErrorStatus.NEW,
      },
    });

    if (existingError) {
      // Incrémenter le compteur d'occurrences
      existingError.occurrenceCount += 1;
      existingError.lastOccurredAt = new Date();
      const updated = await this.errorRepository.save(existingError);

      this.logger.warn(
        `Erreur récurrente pour le plugin ${plugin.name}: ${errorDto.message} (${updated.occurrenceCount} occurrences)`,
        'PluginErrorService',
      );

      return updated;
    }

    // Créer une nouvelle entrée d'erreur
    const error = this.errorRepository.create({
      pluginId,
      errorType: errorDto.errorType,
      message: errorDto.message,
      stack: errorDto.stack || null,
      context: errorDto.context || null,
      severity: errorDto.severity || ErrorSeverity.MEDIUM,
      status: ErrorStatus.NEW,
      metadata: errorDto.metadata || null,
      occurrenceCount: 1,
      lastOccurredAt: new Date(),
    });

    const saved = await this.errorRepository.save(error);

    this.logger.error(
      `Nouvelle erreur pour le plugin ${plugin.name}: ${errorDto.message}`,
      errorDto.stack || '',
      'PluginErrorService',
    );

    return saved;
  }

  /**
   * Récupère les erreurs d'un plugin
   */
  async getPluginErrors(
    pluginId: string,
    limit: number = 50,
    severity?: ErrorSeverity,
    status?: ErrorStatus,
  ): Promise<PluginError[]> {
    const query = this.errorRepository
      .createQueryBuilder('error')
      .where('error.pluginId = :pluginId', { pluginId })
      .orderBy('error.createdAt', 'DESC')
      .limit(limit);

    if (severity) {
      query.andWhere('error.severity = :severity', { severity });
    }

    if (status) {
      query.andWhere('error.status = :status', { status });
    }

    return query.getMany();
  }

  /**
   * Récupère toutes les erreurs non résolues
   */
  async getUnresolvedErrors(limit: number = 100): Promise<PluginError[]> {
    return this.errorRepository.find({
      where: {
        status: ErrorStatus.NEW,
      },
      order: {
        createdAt: 'DESC',
        severity: 'DESC',
      },
      take: limit,
    });
  }

  /**
   * Marque une erreur comme résolue
   */
  async markAsResolved(errorId: string): Promise<PluginError> {
    const error = await this.errorRepository.findOne({
      where: { id: errorId },
    });

    if (!error) {
      throw new Error(`Erreur ${errorId} non trouvée`);
    }

    error.status = ErrorStatus.RESOLVED;
    error.resolvedAt = new Date();
    return this.errorRepository.save(error);
  }

  /**
   * Marque une erreur comme ignorée
   */
  async markAsIgnored(errorId: string): Promise<PluginError> {
    const error = await this.errorRepository.findOne({
      where: { id: errorId },
    });

    if (!error) {
      throw new Error(`Erreur ${errorId} non trouvée`);
    }

    error.status = ErrorStatus.IGNORED;
    return this.errorRepository.save(error);
  }

  /**
   * Récupère les statistiques d'erreurs d'un plugin
   */
  async getPluginErrorStats(pluginId: string): Promise<{
    total: number;
    bySeverity: Record<ErrorSeverity, number>;
    byStatus: Record<ErrorStatus, number>;
    unresolved: number;
    recentErrors: number; // Erreurs des dernières 24h
  }> {
    const errors = await this.errorRepository.find({
      where: { pluginId },
    });

    const bySeverity: Record<ErrorSeverity, number> = {
      [ErrorSeverity.LOW]: 0,
      [ErrorSeverity.MEDIUM]: 0,
      [ErrorSeverity.HIGH]: 0,
      [ErrorSeverity.CRITICAL]: 0,
    };

    const byStatus: Record<ErrorStatus, number> = {
      [ErrorStatus.NEW]: 0,
      [ErrorStatus.ACKNOWLEDGED]: 0,
      [ErrorStatus.RESOLVED]: 0,
      [ErrorStatus.IGNORED]: 0,
    };

    let unresolved = 0;
    let recentErrors = 0;

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    for (const error of errors) {
      bySeverity[error.severity]++;
      byStatus[error.status]++;

      if (error.status === ErrorStatus.NEW) {
        unresolved++;
      }

      if (error.createdAt >= oneDayAgo) {
        recentErrors++;
      }
    }

    return {
      total: errors.length,
      bySeverity,
      byStatus,
      unresolved,
      recentErrors,
    };
  }

  /**
   * Nettoie les anciennes erreurs résolues (plus de 30 jours)
   */
  async cleanupOldErrors(): Promise<number> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await this.errorRepository
        .createQueryBuilder()
        .delete()
        .from(PluginError)
        .where('status = :status', { status: ErrorStatus.RESOLVED })
        .andWhere('resolvedAt < :date', { date: thirtyDaysAgo })
        .execute();

      const count = result.affected || 0;

      if (count > 0) {
        this.logger.log(
          `${count} erreur(s) ancienne(s) supprimée(s)`,
          'PluginErrorService',
        );
      }

      return count;
    } catch (error: any) {
      // Si la table n'existe pas encore (en production avec synchronize=false),
      // on ignore l'erreur et on retourne 0
      if (error?.code === 'SQLITE_ERROR' && error?.message?.includes('no such table')) {
        this.logger.warn(
          'La table plugin_errors n\'existe pas encore. Ignoré.',
          'PluginErrorService',
        );
        return 0;
      }
      // Pour les autres erreurs, on les log mais on ne fait pas planter l'application
      this.logger.error(
        `Erreur lors du nettoyage des anciennes erreurs: ${error?.message || error}`,
        'PluginErrorService',
      );
      return 0;
    }
  }

  /**
   * Nettoie les anciennes erreurs toutes les semaines
   */
  @Cron(CronExpression.EVERY_WEEK)
  async scheduledCleanup() {
    await this.cleanupOldErrors();
  }

  /**
   * Supprime toutes les erreurs d'un plugin
   */
  async removePluginErrors(pluginId: string): Promise<number> {
    const result = await this.errorRepository.delete({ pluginId });
    const count = result.affected || 0;

    if (count > 0) {
      this.logger.log(
        `${count} erreur(s) supprimée(s) pour le plugin ${pluginId}`,
        'PluginErrorService',
      );
    }

    return count;
  }
}

