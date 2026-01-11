import { apiService } from './api.service';

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

class UpdaterService {
  /**
   * Récupère le statut du service updater
   */
  async getStatus(): Promise<UpdaterStatus> {
    const response = await apiService.get<UpdaterStatus>('/updater/status');
    return response;
  }

  /**
   * Vérifie les mises à jour disponibles
   */
  async checkForUpdates(): Promise<CheckResult> {
    const response = await apiService.post<CheckResult>('/updater/check');
    return response;
  }

  /**
   * Applique les mises à jour
   */
  async applyUpdate(services?: string[]): Promise<UpdateResult> {
    const response = await apiService.post<UpdateResult>('/updater/update', {
      services,
    });
    return response;
  }

  /**
   * Récupère le dernier résultat de vérification
   */
  async getLastCheck(): Promise<CheckResult | { message: string }> {
    const response = await apiService.get<CheckResult | { message: string }>(
      '/updater/last-check',
    );
    return response;
  }
}

export const updaterService = new UpdaterService();
