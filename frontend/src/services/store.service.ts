import { apiService } from './api.service';

export interface ConnectStoreDto {
  email: string;
  password: string;
}

export interface StoreConnectionStatus {
  connected: boolean;
}

export interface ConnectStoreResponse {
  message: string;
  storeEmail: string;
}

class StoreService {
  /**
   * Connecte l'utilisateur au Lumy Store
   */
  async connectStore(credentials: ConnectStoreDto): Promise<ConnectStoreResponse> {
    return apiService.post<ConnectStoreResponse>('/store/auth/connect', credentials);
  }

  /**
   * Déconnecte l'utilisateur du Lumy Store
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

