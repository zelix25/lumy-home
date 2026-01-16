import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LoggerService } from '../logger/logger.service';
import { ConfigService } from '../config/config.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import axios, { AxiosInstance, AxiosError } from 'axios';

export interface UpdaterStatus {
  ok: boolean;
  updater: string;
  composeFile: string;
  composeExists: boolean;
  services: string[];
  mode: string;
  systemMode: 'beta' | 'stable';
  imageTag: string;
}

export interface ServiceUpdateInfo {
  service: string;
  currentImage: string;
  currentDigest?: string;
  lastDigest?: string;
  lastImage?: string;
  hasUpdate: boolean;
  error?: string;
}

export interface CheckResult {
  ok: boolean;
  targetComposeFile: string;
  services: string[];
  notes: string[];
  mode?: 'beta' | 'stable';
  updates?: ServiceUpdateInfo[];
  hasUpdates?: boolean;
}

export interface UpdateResult {
  ok: boolean;
  updated: string[];
  logs: string[];
  mode?: 'beta' | 'stable';
}

@Injectable()
export class UpdaterService implements OnModuleInit {
  private axiosInstance: AxiosInstance;
  private axiosInstanceLongTimeout: AxiosInstance; // Pour les opérations longues (update)
  private lastCheckResult: CheckResult | null = null;

  constructor(
    private readonly logger: LoggerService,
    private readonly config: ConfigService,
    private readonly websocketGateway: WebsocketGateway,
  ) {
    const updaterUrl = this.config.get<string>(
      'UPDATER_URL',
      'http://lumy-updater:3411',
    );
    
    // Instance avec timeout court pour les opérations rapides (status, check)
    this.axiosInstance = axios.create({
      baseURL: updaterUrl,
      timeout: 30000, // 30 secondes
    });

    // Instance avec timeout long pour les opérations longues (update)
    // L'application de mises à jour peut prendre plusieurs minutes (pull d'images, redémarrage)
    this.axiosInstanceLongTimeout = axios.create({
      baseURL: updaterUrl,
      timeout: 600000, // 10 minutes (600000 ms)
    });
  }

  async onModuleInit() {
    this.logger.log('Service Updater initialisé', 'UpdaterService');
    
    // Vérifier la disponibilité de lumy-updater au démarrage
    try {
      const status = await this.getStatus();
      this.logger.log(
        `Lumy Updater disponible - Mode: ${status.systemMode}, Tag: ${status.imageTag}`,
        'UpdaterService',
      );
    } catch (error: any) {
      this.logger.warn(
        `Lumy Updater non disponible: ${error.message}`,
        'UpdaterService',
      );
    }
  }

  /**
   * Vérifie les mises à jour disponibles toutes les heures
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkForUpdatesScheduled() {
    this.logger.log('Vérification automatique des mises à jour...', 'UpdaterService');
    
    try {
      const result = await this.checkForUpdates();
      this.lastCheckResult = result;

      if (result.hasUpdates) {
        const servicesWithUpdates = result.updates
          ?.filter((u) => u.hasUpdate)
          .map((u) => u.service) || [];

        this.logger.log(
          `Mises à jour disponibles pour: ${servicesWithUpdates.join(', ')}`,
          'UpdaterService',
        );

        // Notifier via WebSocket
        this.websocketGateway.broadcast('update:available', {
          hasUpdates: true,
          services: servicesWithUpdates,
          updates: result.updates,
          mode: result.mode,
          timestamp: new Date().toISOString(),
        });
      } else {
        this.logger.debug('Aucune mise à jour disponible', 'UpdaterService');
      }
    } catch (error: any) {
      // Ne pas faire échouer le cron job si le service n'est pas disponible
      // Logger l'erreur mais continuer l'exécution
      const errorMessage = this.getErrorMessage(error);
      this.logger.warn(
        `Service de mise à jour non disponible: ${errorMessage}. La vérification sera réessayée à la prochaine heure.`,
        'UpdaterService',
      );
    }
  }

  /**
   * Extrait un message d'erreur lisible depuis une erreur axios ou autre
   */
  private getErrorMessage(error: any): string {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      
      // Erreurs de connexion réseau
      if (axiosError.code === 'ECONNREFUSED') {
        return 'Service non accessible (connexion refusée). Vérifiez que lumy-updater est démarré.';
      }
      if (axiosError.code === 'ETIMEDOUT' || axiosError.code === 'ECONNABORTED') {
        return 'Timeout de connexion. Le service ne répond pas dans les délais.';
      }
      if (axiosError.code === 'ENOTFOUND' || axiosError.code === 'EAI_AGAIN') {
        return `Service introuvable (DNS). Vérifiez l'URL configurée: ${this.config.get<string>('UPDATER_URL', 'http://lumy-updater:3411')}`;
      }
      if (axiosError.code === 'ECONNRESET') {
        return 'Connexion réinitialisée par le serveur.';
      }
      
      // Erreur HTTP
      if (axiosError.response) {
        return `Erreur HTTP ${axiosError.response.status}: ${axiosError.response.statusText}`;
      }
      
      // Message d'erreur par défaut
      return axiosError.message || 'Erreur de connexion inconnue';
    }
    
    // Erreur non-Axios
    return error?.message || 'Erreur inconnue';
  }

  /**
   * Récupère le statut du service updater
   */
  async getStatus(): Promise<UpdaterStatus> {
    try {
      const response = await this.axiosInstance.get('/updater/status');
      return response.data;
    } catch (error: any) {
      const errorMessage = this.getErrorMessage(error);
      this.logger.error(
        `Erreur lors de la récupération du statut: ${errorMessage}`,
        error.stack,
        'UpdaterService',
      );
      throw new Error(`Impossible de contacter le service de mise à jour: ${errorMessage}`);
    }
  }

  /**
   * Vérifie les mises à jour disponibles
   */
  async checkForUpdates(): Promise<CheckResult> {
    try {
      const response = await this.axiosInstance.post('/updater/check');
      const result = response.data as CheckResult;
      this.lastCheckResult = result;
      return result;
    } catch (error: any) {
      const errorMessage = this.getErrorMessage(error);
      this.logger.error(
        `Erreur lors de la vérification des mises à jour: ${errorMessage}`,
        error.stack,
        'UpdaterService',
      );
      throw new Error(`Impossible de vérifier les mises à jour: ${errorMessage}`);
    }
  }

  /**
   * Applique les mises à jour
   * Note: Cette opération peut prendre plusieurs minutes (pull d'images Docker, redémarrage de conteneurs)
   */
  async applyUpdate(services?: string[]): Promise<UpdateResult> {
    this.logger.log(
      `Application des mises à jour${services ? ` pour: ${services.join(', ')}` : ''} (cette opération peut prendre plusieurs minutes)...`,
      'UpdaterService',
    );

    try {
      // Utiliser l'instance avec timeout long pour cette opération
      const response = await this.axiosInstanceLongTimeout.post('/updater/update', {
        services,
      });
      const result = response.data as UpdateResult;

      if (result.ok) {
        this.logger.log(
          `Mises à jour appliquées avec succès: ${result.updated.join(', ')}`,
          'UpdaterService',
        );

        // Notifier via WebSocket
        this.websocketGateway.broadcast('update:completed', {
          success: true,
          updated: result.updated,
          mode: result.mode,
          timestamp: new Date().toISOString(),
        });

        // Réinitialiser le dernier résultat de vérification
        this.lastCheckResult = null;
      } else {
        this.logger.warn(
          `Échec de la mise à jour: ${result.logs.join('; ')}`,
          'UpdaterService',
        );

        // Notifier via WebSocket
        this.websocketGateway.broadcast('update:failed', {
          success: false,
          logs: result.logs,
          mode: result.mode,
          timestamp: new Date().toISOString(),
        });
      }

      return result;
    } catch (error: any) {
      const errorMessage = this.getErrorMessage(error);
      this.logger.error(
        `Erreur lors de l'application des mises à jour: ${errorMessage}`,
        error.stack,
        'UpdaterService',
      );

      // Notifier via WebSocket
      this.websocketGateway.broadcast('update:failed', {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });

      throw new Error(`Impossible d'appliquer les mises à jour: ${errorMessage}`);
    }
  }

  /**
   * Récupère le dernier résultat de vérification
   */
  getLastCheckResult(): CheckResult | null {
    return this.lastCheckResult;
  }
}
