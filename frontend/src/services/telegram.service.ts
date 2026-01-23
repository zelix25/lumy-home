import { apiService } from './api.service';

export interface TelegramConfig {
  id: string;
  setup: boolean;
  uuid: string | null;
  chatId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterChatDto {
  chatId: string;
  chatType?: string;
  chatTitle?: string;
}

class TelegramService {
  /**
   * Récupère la configuration Telegram
   */
  async getConfig(): Promise<TelegramConfig> {
    return apiService.get<TelegramConfig>('/telegram');
  }

  /**
   * Génère un UUID pour l'instance
   */
  async generateUuid(): Promise<TelegramConfig> {
    return apiService.post<TelegramConfig>('/telegram/generate-uuid');
  }

  /**
   * Enregistre le chat Telegram sur le relais
   */
  async registerChat(dto: RegisterChatDto): Promise<TelegramConfig> {
    return apiService.post<TelegramConfig>('/telegram/register-chat', dto);
  }

  /**
   * Réinitialise la configuration Telegram
   */
  async reset(): Promise<TelegramConfig> {
    return apiService.post<TelegramConfig>('/telegram/reset');
  }
}

export const telegramService = new TelegramService();
