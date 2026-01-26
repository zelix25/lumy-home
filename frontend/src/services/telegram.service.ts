import { apiService } from './api.service';

export interface TelegramConfig {
  id: string;
  chatId: string | null;
  token_bot: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

class TelegramService {
  async getTelegramConfig(): Promise<TelegramConfig> {
    return apiService.get<TelegramConfig>('/telegram');
  }

  async updateTelegramConfig(config: Partial<TelegramConfig>): Promise<TelegramConfig> {
    return apiService.put<TelegramConfig>('/telegram', config);
  }
}

export const telegramService = new TelegramService();
