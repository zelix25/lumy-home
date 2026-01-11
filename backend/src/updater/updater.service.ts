import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LoggerService } from '../logger/logger.service';
import { ConfigService } from '../config/config.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import axios, { AxiosInstance } from 'axios';

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
    
    this.axiosInstance = axios.create({
      baseURL: updaterUrl,
      timeout: 30000, // 30 secondes
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
  @Cron(CronExpression.EVERY_10_MINUTES)
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
      this.logger.error(
        `Erreur lors de la vérification des mises à jour: ${error.message}`,
        error.stack,
        'UpdaterService',
      );
    }
  }

  /**
   * Récupère le statut du service updater
   */
  async getStatus(): Promise<UpdaterStatus> {
    try {
      const response = await this.axiosInstance.get('/updater/status');
      return response.data;
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de la récupération du statut: ${error.message}`,
        error.stack,
        'UpdaterService',
      );
      throw new Error(`Impossible de contacter le service de mise à jour: ${error.message}`);
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
      this.logger.error(
        `Erreur lors de la vérification des mises à jour: ${error.message}`,
        error.stack,
        'UpdaterService',
      );
      throw new Error(`Impossible de vérifier les mises à jour: ${error.message}`);
    }
  }

  /**
   * Applique les mises à jour
   */
  async applyUpdate(services?: string[]): Promise<UpdateResult> {
    this.logger.log(
      `Application des mises à jour${services ? ` pour: ${services.join(', ')}` : ''}`,
      'UpdaterService',
    );

    try {
      const response = await this.axiosInstance.post('/updater/update', {
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
      this.logger.error(
        `Erreur lors de l'application des mises à jour: ${error.message}`,
        error.stack,
        'UpdaterService',
      );

      // Notifier via WebSocket
      this.websocketGateway.broadcast('update:failed', {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });

      throw new Error(`Impossible d'appliquer les mises à jour: ${error.message}`);
    }
  }

  /**
   * Récupère le dernier résultat de vérification
   */
  getLastCheckResult(): CheckResult | null {
    return this.lastCheckResult;
  }
}
