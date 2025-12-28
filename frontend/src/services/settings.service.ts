import { apiService } from './api.service';

export interface Settings {
  id: string;
  logout_delay: number;
  hostname: string;
  setup: boolean;
  createdAt: string;
  updatedAt: string;
}

class SettingsService {
  async getSettings(): Promise<Settings> {
    return apiService.get<Settings>('/settings');
  }

  /**
   * Vérifie le statut du setup (route publique, ne nécessite pas d'authentification)
   */
  async getSetupStatus(): Promise<{ setup: boolean }> {
    return apiService.get<{ setup: boolean }>('/settings/setup-status');
  }

  /**
   * Récupère les informations système (RAM, CPU) - route publique
   */
  async getSystemInfo(): Promise<{ ram: number; cpuArch: string; cpuType: string }> {
    return apiService.get<{ ram: number; cpuArch: string; cpuType: string }>('/settings/system-info');
  }

  async updateSettings(settings: Partial<Settings>): Promise<Settings> {
    return apiService.put<Settings>('/settings', settings);
  }
}

export const settingsService = new SettingsService();


