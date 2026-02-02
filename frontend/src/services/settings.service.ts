import { apiService } from './api.service';

export interface Settings {
  id: string;
  logout_delay: number;
  hostname: string;
  setup: boolean;
  city?: string | null;
  zipCode?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
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

  /**
   * Récupère l'adresse IP du serveur
   */
  async getServerIp(): Promise<{ ip: string }> {
    return apiService.get<{ ip: string }>('/settings/server-ip');
  }

  async updateSettings(settings: Partial<Settings>): Promise<Settings> {
    return apiService.put<Settings>('/settings', settings);
  }
}

export const settingsService = new SettingsService();


