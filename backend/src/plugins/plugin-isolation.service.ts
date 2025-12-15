import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { PluginErrorService } from './plugin-error.service';
import { PluginCircuitBreakerService } from './plugin-circuit-breaker.service';
import { Plugin, PluginStatus } from './entities/plugin.entity';
import { ErrorSeverity } from './entities/plugin-error.entity';

@Injectable()
export class PluginIsolationService {
  private readonly logger: Logger;

  constructor(
    private errorService: PluginErrorService,
    private circuitBreakerService: PluginCircuitBreakerService,
  ) {
    this.logger = new Logger(PluginIsolationService.name);
  }

  /**
   * Exécute une fonction de manière isolée pour éviter que les crashes n'affectent le système
   */
  async executeIsolated<T>(
    plugin: Plugin,
    fn: () => Promise<T>,
    context?: string,
  ): Promise<T | null> {
    // Vérifier si le circuit breaker est ouvert
    if (this.circuitBreakerService.isCircuitOpen(plugin.id)) {
      this.logger.warn(
        `Tentative d'exécution bloquée pour le plugin ${plugin.name} (circuit breaker ouvert)`,
        'PluginIsolationService',
      );
      return null;
    }

    try {
      // Exécuter avec protection du circuit breaker
      const result = await this.circuitBreakerService.execute(
        plugin.id,
        async () => {
          return await fn();
        },
        (error) => {
          // Gérer l'erreur sans faire planter le système
          this.handleError(plugin, error, context);
        },
      );

      return result;
    } catch (error: any) {
      // Erreur capturée par le circuit breaker
      this.handleError(plugin, error, context);

      // Si le circuit est maintenant ouvert, désactiver le plugin
      if (this.circuitBreakerService.isCircuitOpen(plugin.id)) {
        await this.handleCircuitOpen(plugin);
      }

      return null;
    }
  }

  /**
   * Exécute une fonction de manière isolée avec gestion d'erreur personnalisée
   */
  async executeIsolatedWithErrorHandler<T>(
    plugin: Plugin,
    fn: () => Promise<T>,
    errorHandler: (error: Error) => T | null,
    context?: string,
  ): Promise<T | null> {
    // Vérifier si le circuit breaker est ouvert
    if (this.circuitBreakerService.isCircuitOpen(plugin.id)) {
      this.logger.warn(
        `Tentative d'exécution bloquée pour le plugin ${plugin.name} (circuit breaker ouvert)`,
        'PluginIsolationService',
      );
      return errorHandler(
        new Error('Circuit breaker ouvert pour ce plugin'),
      );
    }

    try {
      // Exécuter avec protection du circuit breaker
      const result = await this.circuitBreakerService.execute(
        plugin.id,
        async () => {
          return await fn();
        },
        (error) => {
          // Gérer l'erreur sans faire planter le système
          this.handleError(plugin, error, context);
        },
      );

      return result;
    } catch (error: any) {
      // Erreur capturée par le circuit breaker
      this.handleError(plugin, error, context);

      // Si le circuit est maintenant ouvert, désactiver le plugin
      if (this.circuitBreakerService.isCircuitOpen(plugin.id)) {
        await this.handleCircuitOpen(plugin);
      }

      return errorHandler(error);
    }
  }

  /**
   * Gère une erreur de plugin
   */
  private async handleError(
    plugin: Plugin,
    error: Error,
    context?: string,
  ): Promise<void> {
    try {
      // Enregistrer l'erreur
      await this.errorService.logError(plugin.id, {
        errorType: error.name || 'Error',
        message: error.message,
        stack: error.stack,
        context: context || 'plugin-execution',
        severity: this.determineSeverity(error),
      });

      this.logger.error(
        `Erreur isolée pour le plugin ${plugin.name}${context ? ` (${context})` : ''}: ${error.message}`,
        error.stack,
        'PluginIsolationService',
      );
    } catch (logError: any) {
      // Même l'enregistrement d'erreur peut échouer, on log dans la console
      console.error(
        `Erreur critique lors de l'enregistrement d'erreur pour le plugin ${plugin.name}:`,
        logError,
      );
    }
  }

  /**
   * Gère l'ouverture du circuit breaker
   */
  private async handleCircuitOpen(plugin: Plugin): Promise<void> {
    try {
      // Marquer le plugin comme en erreur
      if (plugin.status !== PluginStatus.ERROR) {
        plugin.status = PluginStatus.ERROR;
        plugin.error = `Circuit breaker ouvert après plusieurs échecs. Le plugin a été automatiquement désactivé.`;
        // Note: On devrait sauvegarder le plugin, mais on n'a pas accès au repository ici
        // Ce sera géré par le service appelant
      }

      this.logger.error(
        `Plugin ${plugin.name} désactivé automatiquement (circuit breaker ouvert)`,
        'PluginIsolationService',
      );
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de la désactivation du plugin ${plugin.name}: ${error.message}`,
        'PluginIsolationService',
      );
    }
  }

  /**
   * Détermine la sévérité d'une erreur
   */
  private determineSeverity(error: Error): ErrorSeverity {
    // Erreurs critiques
    if (
      error.name === 'TypeError' ||
      error.name === 'ReferenceError' ||
      error.name === 'SyntaxError'
    ) {
      return ErrorSeverity.CRITICAL;
    }

    // Erreurs élevées
    if (
      error.name === 'RangeError' ||
      error.name === 'EvalError' ||
      error.message.includes('circuit breaker')
    ) {
      return ErrorSeverity.HIGH;
    }

    // Erreurs moyennes par défaut
    return ErrorSeverity.MEDIUM;
  }

  /**
   * Vérifie si un plugin peut être exécuté (circuit breaker fermé)
   */
  canExecute(pluginId: string): boolean {
    return !this.circuitBreakerService.isCircuitOpen(pluginId);
  }

  /**
   * Réinitialise l'isolation pour un plugin (après correction)
   */
  resetIsolation(pluginId: string): void {
    this.circuitBreakerService.resetCircuit(pluginId);
    this.logger.log(
      `Isolation réinitialisée pour le plugin ${pluginId}`,
      'PluginIsolationService',
    );
  }
}

