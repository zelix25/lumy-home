import { apiService } from './api.service';

export interface PluginUIExtension {
  id: string;
  pluginId: string;
  type: 'page' | 'component' | 'widget' | 'menu_item';
  name: string;
  displayName: string;
  description?: string;
  route?: string;
  componentPath?: string;
  icon?: string;
  menuPath?: string;
  menuOrder?: number;
  props?: Record<string, any>;
  metadata?: Record<string, any>;
  enabled: boolean;
}

export interface Plugin {
  id: string;
  name: string;
  displayName: string;
  version: string;
  description?: string;
  author?: string;
  icon?: string;
  status: 'installed' | 'enabled' | 'disabled' | 'error';
  config?: Record<string, any>;
  permissions?: string[];
}

class PluginsService {
  /**
   * Récupère toutes les pages disponibles depuis les plugins
   */
  async getAvailablePages(): Promise<PluginUIExtension[]> {
    return apiService.get<PluginUIExtension[]>('/plugins/ui-extensions/pages');
  }

  /**
   * Récupère tous les widgets disponibles depuis les plugins
   */
  async getAvailableWidgets(): Promise<PluginUIExtension[]> {
    return apiService.get<PluginUIExtension[]>('/plugins/ui-extensions/widgets');
  }

  /**
   * Récupère tous les éléments de menu disponibles depuis les plugins
   */
  async getAvailableMenuItems(): Promise<PluginUIExtension[]> {
    return apiService.get<PluginUIExtension[]>('/plugins/ui-extensions/menu-items');
  }

  /**
   * Récupère toutes les extensions UI disponibles
   */
  async getAllExtensions(type?: 'page' | 'component' | 'widget' | 'menu_item'): Promise<PluginUIExtension[]> {
    const endpoint = type 
      ? `/plugins/ui-extensions?type=${type}`
      : '/plugins/ui-extensions';
    return apiService.get<PluginUIExtension[]>(endpoint);
  }

  /**
   * Récupère toutes les extensions UI d'un plugin
   */
  async getPluginExtensions(pluginId: string, type?: 'page' | 'component' | 'widget' | 'menu_item'): Promise<PluginUIExtension[]> {
    const endpoint = type 
      ? `/plugins/${pluginId}/ui-extensions?type=${type}`
      : `/plugins/${pluginId}/ui-extensions`;
    return apiService.get<PluginUIExtension[]>(endpoint);
  }

  /**
   * Récupère tous les plugins
   */
  async getAllPlugins(): Promise<Plugin[]> {
    return apiService.get<Plugin[]>('/plugins');
  }

  /**
   * Récupère un plugin par son ID
   */
  async getPlugin(pluginId: string): Promise<Plugin> {
    return apiService.get<Plugin>(`/plugins/${pluginId}`);
  }

  /**
   * Récupère les plugins disponibles sur le Lumy Store
   */
  async getAvailablePluginsFromStore(
    search?: string,
    category?: string,
  ): Promise<any[]> {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (category) params.append('category', category);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiService.get<any[]>(`/plugins/store/available${query}`);
  }

  /**
   * Récupère les détails d'un plugin depuis le Lumy Store
   */
  async getPluginFromStore(pluginId: string): Promise<any> {
    return apiService.get<any>(`/plugins/store/${pluginId}`);
  }

  /**
   * Installe un plugin depuis le Lumy Store
   */
  async installFromStore(pluginId: string): Promise<Plugin> {
    // Récupérer le tokenStore du localStorage
    const tokenStore = localStorage.getItem('tokenStore');
    
    // Créer les headers avec le tokenStore si disponible
    const headers: HeadersInit = {};
    if (tokenStore) {
      headers['X-Store-Token'] = tokenStore;
    }
    
    // Utiliser apiService.post avec des headers personnalisés
    const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
    const url = API_BASE_URL.startsWith('http') 
      ? `${API_BASE_URL}/plugins/store/install` 
      : `${API_BASE_URL}/plugins/store/install`;
    
    const token = localStorage.getItem('lumy_token');
    const allHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      ...headers,
    };
    if (token) {
      allHeaders['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: allHeaders,
      body: JSON.stringify({ pluginId }),
    });
    
    if (response.status === 401) {
      localStorage.removeItem('lumy_token');
      localStorage.removeItem('lumy_user');
      window.location.href = '/login';
      throw new Error('Non autorisé');
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  }

  /**
   * Active un plugin
   */
  async enable(pluginId: string): Promise<Plugin> {
    return apiService.post<Plugin>(`/plugins/${pluginId}/enable`);
  }

  /**
   * Désactive un plugin
   */
  async disable(pluginId: string): Promise<Plugin> {
    return apiService.post<Plugin>(`/plugins/${pluginId}/disable`);
  }

  /**
   * Désinstalle un plugin
   */
  async uninstall(pluginId: string): Promise<void> {
    await apiService.delete(`/plugins/${pluginId}`);
  }
}

export const pluginsService = new PluginsService();

