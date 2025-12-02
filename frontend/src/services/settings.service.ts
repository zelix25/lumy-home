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

  async updateSettings(settings: Partial<Settings>): Promise<Settings> {
    return apiService.put<Settings>('/settings', settings);
  }
}

export const settingsService = new SettingsService();


