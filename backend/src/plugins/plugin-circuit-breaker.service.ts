import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { Plugin } from './entities/plugin.entity';
import { PluginErrorService } from './plugin-error.service';
import { ErrorSeverity } from './entities/plugin-error.entity';
import { PluginStatus } from './entities/plugin.entity';

export enum CircuitState {
  CLOSED = 'closed', // Normal, les requêtes passent
  OPEN = 'open', // Circuit ouvert, les requêtes sont bloquées
  HALF_OPEN = 'half_open', // Test de récupération
}

export interface CircuitBreakerConfig {
  failureThreshold: number; // Nombre d'échecs avant ouverture (défaut: 5)
  successThreshold: number; // Nombre de succès pour fermer (défaut: 2)
  timeout: number; // Délai avant tentative de récupération en ms (défaut: 60000)
  resetTimeout: number; // Délai avant réinitialisation complète en ms (défaut: 300000)
}

interface PluginCircuitState {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: Date | null;
  lastSuccessTime: Date | null;
  openedAt: Date | null;
}

@Injectable()
export class PluginCircuitBreakerService implements OnModuleInit {
  private readonly logger: Logger;
  private readonly circuits: Map<string, PluginCircuitState> = new Map();
  private readonly defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 60000, // 1 minute
    resetTimeout: 300000, // 5 minutes
  };

  constructor(
    private errorService: PluginErrorService,
  ) {
    this.logger = new Logger(PluginCircuitBreakerService.name);
  }

  async onModuleInit() {
    this.logger.log('Service de circuit breaker de plugins initialisé', 'PluginCircuitBreakerService');
  }

  /**
   * Vérifie si le circuit est ouvert pour un plugin
   */
  isCircuitOpen(pluginId: string): boolean {
    const circuit = this.circuits.get(pluginId);
    if (!circuit) {
      return false; // Pas de circuit = circuit fermé
    }

    // Vérifier si le circuit doit être réinitialisé
    if (circuit.state === CircuitState.OPEN && circuit.openedAt) {
      const timeSinceOpen = Date.now() - circuit.openedAt.getTime();
      if (timeSinceOpen >= this.defaultConfig.resetTimeout) {
        this.resetCircuit(pluginId);
        return false;
      }
    }

    return circuit.state === CircuitState.OPEN;
  }

  /**
   * Enregistre un succès pour un plugin
   */
  recordSuccess(pluginId: string): void {
    const circuit = this.getOrCreateCircuit(pluginId);

    if (circuit.state === CircuitState.HALF_OPEN) {
      circuit.successCount++;
      if (circuit.successCount >= this.defaultConfig.successThreshold) {
        // Circuit fermé avec succès
        circuit.state = CircuitState.CLOSED;
        circuit.failureCount = 0;
        circuit.successCount = 0;
        circuit.lastSuccessTime = new Date();
        circuit.openedAt = null;

        this.logger.log(
          `Circuit breaker fermé pour le plugin ${pluginId}`,
          'PluginCircuitBreakerService',
        );
      }
    } else if (circuit.state === CircuitState.CLOSED) {
      // Réinitialiser le compteur d'échecs en cas de succès
      circuit.failureCount = 0;
      circuit.lastSuccessTime = new Date();
    }
  }

  /**
   * Enregistre un échec pour un plugin
   */
  async recordFailure(pluginId: string, error: Error): Promise<void> {
    const circuit = this.getOrCreateCircuit(pluginId);

    circuit.failureCount++;
    circuit.lastFailureTime = new Date();

    // Enregistrer l'erreur
    await this.errorService.logError(pluginId, {
      errorType: error.name || 'Error',
      message: error.message,
      stack: error.stack,
      severity: ErrorSeverity.HIGH,
      context: 'circuit-breaker',
    });

    // Vérifier si le seuil d'échecs est atteint
    if (circuit.failureCount >= this.defaultConfig.failureThreshold) {
      if (circuit.state === CircuitState.CLOSED || circuit.state === CircuitState.HALF_OPEN) {
        circuit.state = CircuitState.OPEN;
        circuit.openedAt = new Date();
        circuit.successCount = 0;

        this.logger.error(
          `Circuit breaker ouvert pour le plugin ${pluginId} après ${circuit.failureCount} échecs`,
          'PluginCircuitBreakerService',
        );
      }
    }
  }

  /**
   * Tente de passer en mode HALF_OPEN pour tester la récupération
   */
  attemptRecovery(pluginId: string): boolean {
    const circuit = this.circuits.get(pluginId);
    if (!circuit || circuit.state !== CircuitState.OPEN) {
      return false;
    }

    if (!circuit.openedAt) {
      return false;
    }

    const timeSinceOpen = Date.now() - circuit.openedAt.getTime();
    if (timeSinceOpen >= this.defaultConfig.timeout) {
      circuit.state = CircuitState.HALF_OPEN;
      circuit.successCount = 0;

      this.logger.log(
        `Circuit breaker en mode HALF_OPEN pour le plugin ${pluginId}`,
        'PluginCircuitBreakerService',
      );

      return true;
    }

    return false;
  }

  /**
   * Réinitialise le circuit pour un plugin
   */
  resetCircuit(pluginId: string): void {
    this.circuits.delete(pluginId);
    this.logger.debug(
      `Circuit breaker réinitialisé pour le plugin ${pluginId}`,
      'PluginCircuitBreakerService',
    );
  }

  /**
   * Récupère l'état du circuit pour un plugin
   */
  getCircuitState(pluginId: string): CircuitState | null {
    const circuit = this.circuits.get(pluginId);
    return circuit ? circuit.state : null;
  }

  /**
   * Récupère les statistiques du circuit pour un plugin
   */
  getCircuitStats(pluginId: string): {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastFailureTime: Date | null;
    lastSuccessTime: Date | null;
  } | null {
    const circuit = this.circuits.get(pluginId);
    if (!circuit) {
      return null;
    }

    return {
      state: circuit.state,
      failureCount: circuit.failureCount,
      successCount: circuit.successCount,
      lastFailureTime: circuit.lastFailureTime,
      lastSuccessTime: circuit.lastSuccessTime,
    };
  }

  /**
   * Exécute une fonction avec protection du circuit breaker
   */
  async execute<T>(
    pluginId: string,
    fn: () => Promise<T>,
    errorHandler?: (error: Error) => void,
  ): Promise<T> {
    // Vérifier si le circuit est ouvert
    if (this.isCircuitOpen(pluginId)) {
      // Tenter une récupération
      if (!this.attemptRecovery(pluginId)) {
        throw new Error(
          `Circuit breaker ouvert pour le plugin ${pluginId}. Le plugin est temporairement désactivé.`,
        );
      }
    }

    try {
      const result = await fn();
      this.recordSuccess(pluginId);
      return result;
    } catch (error: any) {
      await this.recordFailure(pluginId, error);

      if (errorHandler) {
        errorHandler(error);
      }

      throw error;
    }
  }

  /**
   * Récupère ou crée un circuit pour un plugin
   */
  private getOrCreateCircuit(pluginId: string): PluginCircuitState {
    let circuit = this.circuits.get(pluginId);
    if (!circuit) {
      circuit = {
        state: CircuitState.CLOSED,
        failureCount: 0,
        successCount: 0,
        lastFailureTime: null,
        lastSuccessTime: null,
        openedAt: null,
      };
      this.circuits.set(pluginId, circuit);
    }
    return circuit;
  }
}

