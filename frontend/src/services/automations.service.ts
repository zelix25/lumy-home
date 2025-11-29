import { apiService } from './api.service';

export interface Automation {
  id: string;
  name: string;
  description: string;
  userQuery: string;
  trigger: {
    type: string;
    deviceName?: string;
    condition?: Record<string, any>;
  };
  actions: Array<{
    type: string;
    deviceName?: string;
    params?: Record<string, any>;
  }>;
  status: 'active' | 'inactive' | 'error';
  createdAt: string;
  updatedAt: string;
}

export interface GenerateAutomationRequest {
  query: string;
}

class AutomationsService {
  /**
   * Génère une automatisation à partir d'une phrase en langage naturel
   */
  async generateAutomation(
    query: string,
  ): Promise<Automation> {
    return apiService.post<Automation>('/ai/generate', { query });
  }

  /**
   * Liste toutes les automatisations
   */
  async getAll(): Promise<Automation[]> {
    return apiService.get<Automation[]>('/ai/automations');
  }

  /**
   * Récupère une automatisation par ID
   */
  async getById(id: string): Promise<Automation> {
    return apiService.get<Automation>(`/ai/automations/${id}`);
  }

  /**
   * Active ou désactive une automatisation
   */
  async toggleStatus(
    id: string,
    status: 'active' | 'inactive',
  ): Promise<Automation> {
    return apiService.patch<Automation>(`/ai/automations/${id}/status`, {
      status,
    });
  }

  /**
   * Supprime une automatisation
   */
  async delete(id: string): Promise<void> {
    return apiService.delete<void>(`/ai/automations/${id}`);
  }

  /**
   * Vérifie si le serveur Gemma 3 est disponible
   */
  async checkStatus(): Promise<{ available: boolean; message?: string }> {
    return apiService.get<{ available: boolean; message?: string }>('/ai/status');
  }
}

export const automationsService = new AutomationsService();

