import { apiService } from './api.service';

export interface ConnectStoreDto {
  apiKey: string;
}

export interface StoreConnectionStatus {
  connected: boolean;
  storeEmail?: string;
  apiKeyMasked?: string;
}

export interface ConnectStoreResponse {
  message: string;
  storeEmail: string | null;
  apiKeyMasked: string;
}

class StoreService {
  /**
   * Connecte la box au Lumy Store via une clé API (stockée côté serveur uniquement)
   */
  async connectStore(credentials: ConnectStoreDto): Promise<ConnectStoreResponse> {
    return apiService.post<ConnectStoreResponse>('/store/auth/connect', credentials);
  }

  /**
   * Déconnecte la box du Lumy Store
   */
  async disconnectStore(): Promise<{ message: string }> {
    return apiService.delete<{ message: string }>('/store/auth/disconnect');
  }

  /**
   * Vérifie le statut de connexion au store
   */
  async getConnectionStatus(): Promise<StoreConnectionStatus> {
    return apiService.get<StoreConnectionStatus>('/store/auth/status');
  }
}

export const storeService = new StoreService();
