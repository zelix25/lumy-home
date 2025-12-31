import { apiService } from './api.service';

export interface SystemNotification {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  category: 'docker' | 'system' | 'service';
  title: string;
  message: string;
  instructions: string | null;
  containerName: string | null;
  resolved: boolean;
  createdAt: string;
}

class SystemHealthService {
  /**
   * Récupère toutes les notifications système non résolues
   */
  async getNotifications(limit?: number): Promise<SystemNotification[]> {
    const params = limit ? `?limit=${limit}` : '';
    const response = await apiService.get<SystemNotification[]>(
      `/system-health/notifications${params}`,
    );
    // apiService.get() retourne directement les données, pas un objet avec .data
    // S'assurer de retourner un tableau même si la réponse est undefined ou null
    return Array.isArray(response) ? response : [];
  }

  /**
   * Marque une notification comme résolue
   */
  async markAsResolved(id: string): Promise<void> {
    await apiService.post(`/system-health/notifications/${id}/resolve`);
  }

  /**
   * Déclenche une vérification manuelle de santé
   */
  async checkHealth(): Promise<{ success: boolean; message: string }> {
    const response = await apiService.post<{ success: boolean; message: string }>(
      '/system-health/check',
    );
    // apiService.post() retourne directement les données, pas un objet avec .data
    return response;
  }
}

export const systemHealthService = new SystemHealthService();

