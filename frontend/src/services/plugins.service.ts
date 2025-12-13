import { apiService } from './api.service';

export enum PluginStatus {
  INSTALLED = 'installed',
  ENABLED = 'enabled',
  DISABLED = 'disabled',
  ERROR = 'error',
}

export enum PluginCategory {
  AUTOMATION = 'automation',
  INTEGRATION = 'integration',
  UI = 'ui',
  SECURITY = 'security',
  WEATHER = 'weather',
  ENTERTAINMENT = 'entertainment',
  UTILITY = 'utility',
  OTHER = 'other',
}

export interface Plugin {
  id: string;
  name: string;
  displayName: string;
  version: string;
  description?: string;
  author?: string;
  icon?: string;
  repository?: string;
  status: PluginStatus;
  config?: Record<string, any>;
  permissions?: string[];
  installPath?: string;
  lumyVersion?: string;
  dependencies?: Record<string, string>;
  error?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface StorePlugin {
  id: string;
  name: string;
  displayName: string;
  version: string;
  description?: string;
  author?: string;
  icon?: string;
  repository?: string;
  category?: PluginCategory;
  tags?: string[];
  downloadUrl?: string;
  downloads?: number;
  rating?: number;
  reviews?: number;
  lumyVersion?: string;
  screenshots?: string[];
  documentation?: string;
  changelog?: string;
  license?: string;
  homepage?: string;
  metadata?: Record<string, any>;
}

export interface StoreSearchParams {
  query?: string;
  category?: PluginCategory;
  tags?: string[];
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'downloads' | 'rating' | 'updated';
  sortOrder?: 'asc' | 'desc';
}

export interface StoreSearchResult {
  plugins: StorePlugin[];
  total: number;
  page: number;
  limit: number;
}

export interface InstallPluginDto {
  source: string;
  version?: string;
  config?: Record<string, any>;
  allowUpdate?: boolean;
}

export interface UpdatePluginConfigDto {
  config: Record<string, any>;
}

class PluginsService {
  /**
   * Récupère tous les plugins installés
   */
  async getAll(): Promise<Plugin[]> {
    return apiService.get<Plugin[]>('/plugins');
  }

  /**
   * Récupère un plugin par son ID
   */
  async getOne(id: string): Promise<Plugin> {
    return apiService.get<Plugin>(`/plugins/${id}`);
  }

  /**
   * Installe un plugin
   */
  async install(installDto: InstallPluginDto): Promise<Plugin> {
    return apiService.post<Plugin>('/plugins/install', installDto);
  }

  /**
   * Active un plugin
   */
  async enable(id: string): Promise<Plugin> {
    return apiService.post<Plugin>(`/plugins/${id}/enable`);
  }

  /**
   * Désactive un plugin
   */
  async disable(id: string): Promise<Plugin> {
    return apiService.post<Plugin>(`/plugins/${id}/disable`);
  }

  /**
   * Met à jour la configuration d'un plugin
   */
  async updateConfig(id: string, config: Record<string, any>): Promise<Plugin> {
    return apiService.put<Plugin>(`/plugins/${id}/config`, { config });
  }

  /**
   * Désinstalle un plugin
   */
  async uninstall(id: string): Promise<void> {
    return apiService.delete<void>(`/plugins/${id}`);
  }

  /**
   * Recherche des plugins dans le store
   */
  async searchStore(params: StoreSearchParams): Promise<StoreSearchResult> {
    const queryParams = new URLSearchParams();
    if (params.query) queryParams.append('query', params.query);
    if (params.category) queryParams.append('category', params.category);
    if (params.tags) params.tags.forEach((tag) => queryParams.append('tags', tag));
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);

    return apiService.get<StoreSearchResult>(`/plugins/store/search?${queryParams.toString()}`);
  }

  /**
   * Récupère les catégories disponibles
   */
  async getStoreCategories(): Promise<Array<{ category: PluginCategory; count: number }>> {
    return apiService.get<Array<{ category: PluginCategory; count: number }>>(
      '/plugins/store/categories',
    );
  }

  /**
   * Récupère les plugins en vedette
   */
  async getFeaturedPlugins(): Promise<StorePlugin[]> {
    return apiService.get<StorePlugin[]>('/plugins/store/featured');
  }

  /**
   * Récupère les détails d'un plugin du store
   */
  async getStorePlugin(id: string): Promise<StorePlugin> {
    return apiService.get<StorePlugin>(`/plugins/store/${id}`);
  }

  /**
   * Récupère les permissions d'un plugin
   */
  async getPluginPermissions(id: string): Promise<{
    permissions: string[];
    analysis: any;
  }> {
    return apiService.get<{ permissions: string[]; analysis: any }>(`/plugins/${id}/permissions`);
  }

  /**
   * Récupère toutes les permissions disponibles
   */
  async getAvailablePermissions(): Promise<{ permissions: string[] }> {
    return apiService.get<{ permissions: string[] }>('/plugins/permissions/available');
  }

  /**
   * Récupère le schéma de configuration d'un plugin
   */
  async getConfigSchema(id: string): Promise<{ schema: any }> {
    return apiService.get<{ schema: any }>(`/plugins/${id}/config/schema`);
  }

  /**
   * Valide une configuration pour un plugin
   */
  async validateConfig(id: string, config: any): Promise<{ valid: boolean; errors: string[] }> {
    return apiService.post<{ valid: boolean; errors: string[] }>(`/plugins/${id}/config/validate`, { config });
  }

  /**
   * Vérifie si une mise à jour est disponible pour un plugin
   */
  async checkForUpdate(id: string): Promise<{
    hasUpdate: boolean;
    currentVersion: string;
    latestVersion: string | null;
    updateAvailable: boolean;
  }> {
    return apiService.get<{
      hasUpdate: boolean;
      currentVersion: string;
      latestVersion: string | null;
      updateAvailable: boolean;
    }>(`/plugins/${id}/update/check`);
  }

  /**
   * Vérifie les mises à jour pour tous les plugins
   */
  async checkAllForUpdates(): Promise<Array<{
    pluginId: string;
    pluginName: string;
    currentVersion: string;
    latestVersion: string | null;
    updateAvailable: boolean;
  }>> {
    return apiService.get<Array<{
      pluginId: string;
      pluginName: string;
      currentVersion: string;
      latestVersion: string | null;
      updateAvailable: boolean;
    }>>('/plugins/update/check-all');
  }

  /**
   * Met à jour un plugin
   */
  async updatePlugin(id: string, version?: string): Promise<Plugin> {
    return apiService.post<Plugin>(`/plugins/${id}/update`, { version });
  }

  /**
   * Met à jour tous les plugins qui ont des mises à jour disponibles
   */
  async updateAll(): Promise<Array<{ pluginId: string; success: boolean; error?: string }>> {
    return apiService.post<Array<{ pluginId: string; success: boolean; error?: string }>>('/plugins/update/all');
  }

  /**
   * Récupère les logs d'un plugin
   */
  async getPluginLogs(
    id: string,
    options?: {
      startDate?: string;
      endDate?: string;
      level?: 'debug' | 'info' | 'warn' | 'error';
      limit?: number;
    },
  ): Promise<Array<{
    timestamp: string;
    level: string;
    message: string;
    pluginId: string;
    pluginName: string;
    metadata?: Record<string, any>;
  }>> {
    const queryParams = new URLSearchParams();
    if (options?.startDate) queryParams.append('startDate', options.startDate);
    if (options?.endDate) queryParams.append('endDate', options.endDate);
    if (options?.level) queryParams.append('level', options.level);
    if (options?.limit) queryParams.append('limit', options.limit.toString());

    return apiService.get<Array<{
      timestamp: string;
      level: string;
      message: string;
      pluginId: string;
      pluginName: string;
      metadata?: Record<string, any>;
    }>>(`/plugins/${id}/logs?${queryParams.toString()}`);
  }

  /**
   * Récupère les métriques d'un plugin
   */
  async getPluginMetrics(id: string): Promise<{
    pluginId: string;
    pluginName: string;
    startTime: string;
    lastActivity: string;
    executionCount: number;
    errorCount: number;
    averageExecutionTime: number;
    totalExecutionTime: number;
  } | null> {
    return apiService.get<{
      pluginId: string;
      pluginName: string;
      startTime: string;
      lastActivity: string;
      executionCount: number;
      errorCount: number;
      averageExecutionTime: number;
      totalExecutionTime: number;
    } | null>(`/plugins/${id}/metrics`);
  }

  /**
   * Récupère l'historique de performance d'un plugin
   */
  async getPluginPerformance(
    id: string,
    options?: {
      startDate?: string;
      endDate?: string;
      operation?: string;
      limit?: number;
    },
  ): Promise<Array<{
    timestamp: string;
    pluginId: string;
    pluginName: string;
    operation: string;
    duration: number;
    success: boolean;
    error?: string;
  }>> {
    const queryParams = new URLSearchParams();
    if (options?.startDate) queryParams.append('startDate', options.startDate);
    if (options?.endDate) queryParams.append('endDate', options.endDate);
    if (options?.operation) queryParams.append('operation', options.operation);
    if (options?.limit) queryParams.append('limit', options.limit.toString());

    return apiService.get<Array<{
      timestamp: string;
      pluginId: string;
      pluginName: string;
      operation: string;
      duration: number;
      success: boolean;
      error?: string;
    }>>(`/plugins/${id}/performance?${queryParams.toString()}`);
  }

  /**
   * Récupère les statistiques agrégées de monitoring
   */
  async getMonitoringStats(): Promise<{
    totalPlugins: number;
    totalExecutions: number;
    totalErrors: number;
    averageExecutionTime: number;
    pluginsWithErrors: number;
  }> {
    return apiService.get<{
      totalPlugins: number;
      totalExecutions: number;
      totalErrors: number;
      averageExecutionTime: number;
      pluginsWithErrors: number;
    }>('/plugins/monitoring/stats');
  }

  /**
   * Récupère toutes les métriques
   */
  async getAllMetrics(): Promise<Array<{
    pluginId: string;
    pluginName: string;
    startTime: string;
    lastActivity: string;
    executionCount: number;
    errorCount: number;
    averageExecutionTime: number;
    totalExecutionTime: number;
  }>> {
    return apiService.get<Array<{
      pluginId: string;
      pluginName: string;
      startTime: string;
      lastActivity: string;
      executionCount: number;
      errorCount: number;
      averageExecutionTime: number;
      totalExecutionTime: number;
    }>>('/plugins/monitoring/metrics');
  }

  /**
   * Réinitialise les métriques d'un plugin
   */
  async resetMetrics(id: string): Promise<void> {
    return apiService.post<void>(`/plugins/${id}/metrics/reset`);
  }

  /**
   * Vérifie la compatibilité d'un plugin
   */
  async checkPluginCompatibility(id: string): Promise<{
    compatible: boolean;
    currentVersion: string;
    requiredVersion: string;
    reason?: string;
    breakingChanges?: string[];
    migrationRequired?: boolean;
    migrationGuide?: string;
  }> {
    return apiService.get<{
      compatible: boolean;
      currentVersion: string;
      requiredVersion: string;
      reason?: string;
      breakingChanges?: string[];
      migrationRequired?: boolean;
      migrationGuide?: string;
    }>(`/plugins/${id}/compatibility`);
  }

  /**
   * Vérifie la compatibilité avec une version requise
   */
  async checkCompatibility(requiredVersion: string): Promise<{
    compatible: boolean;
    currentVersion: string;
    requiredVersion: string;
    reason?: string;
    breakingChanges?: string[];
    migrationRequired?: boolean;
    migrationGuide?: string;
  }> {
    return apiService.post<{
      compatible: boolean;
      currentVersion: string;
      requiredVersion: string;
      reason?: string;
      breakingChanges?: string[];
      migrationRequired?: boolean;
      migrationGuide?: string;
    }>('/plugins/compatibility/check', { requiredVersion });
  }

  /**
   * Vérifie la compatibilité avec une version cible spécifique
   */
  async checkCompatibilityWithVersion(
    requiredVersion: string,
    targetVersion: string,
  ): Promise<{
    compatible: boolean;
    currentVersion: string;
    requiredVersion: string;
    reason?: string;
    breakingChanges?: string[];
    migrationRequired?: boolean;
    migrationGuide?: string;
  }> {
    return apiService.post<{
      compatible: boolean;
      currentVersion: string;
      requiredVersion: string;
      reason?: string;
      breakingChanges?: string[];
      migrationRequired?: boolean;
      migrationGuide?: string;
    }>('/plugins/compatibility/check-version', { requiredVersion, targetVersion });
  }

  /**
   * Vérifie si Lumy Home peut être mis à jour
   */
  async canUpgradeLumy(
    pluginRequiredVersion: string,
    targetLumyVersion: string,
  ): Promise<{
    canUpgrade: boolean;
    reason?: string;
    breakingChanges?: Array<{
      version: string;
      description: string;
      severity: string;
      migrationGuide?: string;
    }>;
  }> {
    return apiService.post<{
      canUpgrade: boolean;
      reason?: string;
      breakingChanges?: Array<{
        version: string;
        description: string;
        severity: string;
        migrationGuide?: string;
      }>;
    }>('/plugins/compatibility/can-upgrade', {
      pluginRequiredVersion,
      targetLumyVersion,
    });
  }

  /**
   * Récupère tous les breaking changes
   */
  async getAllBreakingChanges(): Promise<Array<{
    version: string;
    description: string;
    severity: string;
    migrationGuide?: string;
  }>> {
    return apiService.get<Array<{
      version: string;
      description: string;
      severity: string;
      migrationGuide?: string;
    }>>('/plugins/compatibility/breaking-changes');
  }

  /**
   * Récupère les breaking changes pour une version spécifique
   */
  async getBreakingChangesForVersion(version: string): Promise<Array<{
    version: string;
    description: string;
    severity: string;
    migrationGuide?: string;
  }>> {
    return apiService.get<Array<{
      version: string;
      description: string;
      severity: string;
      migrationGuide?: string;
    }>>(`/plugins/compatibility/breaking-changes/${version}`);
  }

  /**
   * Récupère la version actuelle de Lumy Home
   */
  async getCurrentLumyVersion(): Promise<{ version: string }> {
    return apiService.get<{ version: string }>('/plugins/compatibility/current-version');
  }

  /**
   * Exporte les configurations des plugins
   */
  async exportConfigurations(pluginIds?: string[], filename?: string): Promise<{
    success?: boolean;
    filePath?: string;
    message?: string;
    version?: string;
    exportDate?: string;
    lumyVersion?: string;
    plugins?: Array<{
      pluginId: string;
      pluginName: string;
      pluginVersion: string;
      displayName: string;
      config: Record<string, any>;
      metadata?: Record<string, any>;
    }>;
    checksum?: string;
  }> {
    return apiService.post<{
      success?: boolean;
      filePath?: string;
      message?: string;
      version?: string;
      exportDate?: string;
      lumyVersion?: string;
      plugins?: Array<{
        pluginId: string;
        pluginName: string;
        pluginVersion: string;
        displayName: string;
        config: Record<string, any>;
        metadata?: Record<string, any>;
      }>;
      checksum?: string;
    }>('/plugins/backup/export', { pluginIds, filename });
  }

  /**
   * Importe des configurations depuis un objet
   */
  async importConfigurations(
    exportData: {
      version: string;
      exportDate: string;
      lumyVersion: string;
      plugins: Array<{
        pluginId: string;
        pluginName: string;
        pluginVersion: string;
        displayName: string;
        config: Record<string, any>;
        metadata?: Record<string, any>;
      }>;
      checksum?: string;
    },
    options?: {
      overwrite?: boolean;
      skipMissing?: boolean;
      validate?: boolean;
    },
  ): Promise<{
    success: boolean;
    imported: number;
    failed: number;
    errors: Array<{ pluginName: string; error: string }>;
    warnings: Array<{ pluginName: string; warning: string }>;
  }> {
    return apiService.post<{
      success: boolean;
      imported: number;
      failed: number;
      errors: Array<{ pluginName: string; error: string }>;
      warnings: Array<{ pluginName: string; warning: string }>;
    }>('/plugins/backup/import', { exportData, options });
  }

  /**
   * Importe depuis un fichier
   */
  async importFromFile(
    filePath: string,
    options?: {
      overwrite?: boolean;
      skipMissing?: boolean;
      validate?: boolean;
    },
  ): Promise<{
    success: boolean;
    imported: number;
    failed: number;
    errors: Array<{ pluginName: string; error: string }>;
    warnings: Array<{ pluginName: string; warning: string }>;
  }> {
    return apiService.post<{
      success: boolean;
      imported: number;
      failed: number;
      errors: Array<{ pluginName: string; error: string }>;
      warnings: Array<{ pluginName: string; warning: string }>;
    }>('/plugins/backup/import-file', { filePath, options });
  }

  /**
   * Liste les fichiers de sauvegarde
   */
  async listBackups(): Promise<Array<{
    filename: string;
    filePath: string;
    size: number;
    created: string;
    exportDate?: string;
    pluginCount?: number;
  }>> {
    return apiService.get<Array<{
      filename: string;
      filePath: string;
      size: number;
      created: string;
      exportDate?: string;
      pluginCount?: number;
    }>>('/plugins/backup/list');
  }

  /**
   * Supprime un fichier de sauvegarde
   */
  async deleteBackup(filename: string): Promise<{ success: boolean; message: string }> {
    return apiService.delete<{ success: boolean; message: string }>(
      `/plugins/backup/${filename}`,
    );
  }

  /**
   * Restaure depuis un fichier de sauvegarde
   */
  async restoreFromBackup(
    filename: string,
    options?: {
      overwrite?: boolean;
      skipMissing?: boolean;
      validate?: boolean;
    },
  ): Promise<{
    success: boolean;
    imported: number;
    failed: number;
    errors: Array<{ pluginName: string; error: string }>;
    warnings: Array<{ pluginName: string; warning: string }>;
  }> {
    return apiService.post<{
      success: boolean;
      imported: number;
      failed: number;
      errors: Array<{ pluginName: string; error: string }>;
      warnings: Array<{ pluginName: string; warning: string }>;
    }>(`/plugins/backup/restore/${filename}`, { options });
  }

  /**
   * Crée une sauvegarde automatique pour un plugin
   */
  async createAutoBackup(pluginId: string): Promise<{
    success: boolean;
    filePath: string;
    message: string;
  }> {
    return apiService.post<{ success: boolean; filePath: string; message: string }>(
      `/plugins/${pluginId}/backup/create`,
    );
  }

  /**
   * Compare la configuration actuelle avec une sauvegarde
   */
  async compareConfigurations(
    pluginId: string,
    backupFilename: string,
  ): Promise<{
    current: Record<string, any>;
    backup: Record<string, any>;
    differences: Array<{
      key: string;
      current: any;
      backup: any;
    }>;
  }> {
    return apiService.post<{
      current: Record<string, any>;
      backup: Record<string, any>;
      differences: Array<{
        key: string;
        current: any;
        backup: any;
      }>;
    }>(`/plugins/${pluginId}/backup/compare`, { backupFilename });
  }

  /**
   * Enregistre une extension UI
   */
  async registerUIExtension(body: {
    pluginId: string;
    type: 'page' | 'component' | 'widget' | 'menu_item';
    name: string;
    displayName: string;
    description?: string;
    route?: string;
    icon?: string;
    componentType?: 'react' | 'vue' | 'html' | 'iframe';
    componentPath?: string;
    iframeUrl?: string;
    props?: Record<string, any>;
    permissions?: string[];
    metadata?: Record<string, any>;
    order?: number;
  }): Promise<any> {
    return apiService.post<any>('/plugins/ui/extensions/register', body);
  }

  /**
   * Désenregistre une extension UI
   */
  async unregisterUIExtension(id: string): Promise<{ success: boolean; message: string }> {
    return apiService.delete<{ success: boolean; message: string }>(
      `/plugins/ui/extensions/${id}`,
    );
  }

  /**
   * Active/désactive une extension UI
   */
  async setUIExtensionEnabled(id: string, enabled: boolean): Promise<any> {
    return apiService.post<any>(`/plugins/ui/extensions/${id}/${enabled ? 'enable' : 'disable'}`);
  }

  /**
   * Récupère toutes les extensions UI
   */
  async getUIExtensions(filters?: {
    pluginId?: string;
    type?: 'page' | 'component' | 'widget' | 'menu_item';
    enabled?: boolean;
  }): Promise<any[]> {
    const params = new URLSearchParams();
    if (filters?.pluginId) params.append('pluginId', filters.pluginId);
    if (filters?.type) params.append('type', filters.type);
    if (filters?.enabled !== undefined) params.append('enabled', String(filters.enabled));
    
    return apiService.get<any[]>(`/plugins/ui/extensions?${params.toString()}`);
  }

  /**
   * Récupère toutes les pages disponibles
   */
  async getAvailablePages(): Promise<any[]> {
    return apiService.get<any[]>('/plugins/ui/extensions/pages');
  }

  /**
   * Récupère tous les composants disponibles
   */
  async getAvailableComponents(): Promise<any[]> {
    return apiService.get<any[]>('/plugins/ui/extensions/components');
  }

  /**
   * Récupère tous les widgets disponibles
   */
  async getAvailableWidgets(): Promise<any[]> {
    return apiService.get<any[]>('/plugins/ui/extensions/widgets');
  }

  /**
   * Récupère tous les éléments de menu disponibles
   */
  async getAvailableMenuItems(): Promise<any[]> {
    return apiService.get<any[]>('/plugins/ui/extensions/menu-items');
  }

  /**
   * Récupère une extension UI par sa route
   */
  async getExtensionByRoute(route: string): Promise<any> {
    return apiService.get<any>(`/plugins/ui/extensions/route/${encodeURIComponent(route)}`);
  }

  /**
   * Récupère une extension UI par son ID
   */
  async getUIExtension(id: string): Promise<any> {
    return apiService.get<any>(`/plugins/ui/extensions/${id}`);
  }

  /**
   * Met à jour l'ordre d'affichage d'une extension UI
   */
  async updateUIExtensionOrder(id: string, order: number): Promise<any> {
    return apiService.put<any>(`/plugins/ui/extensions/${id}/order`, { order });
  }

  /**
   * Valide une extension UI
   */
  async validateUIExtension(id: string): Promise<{ valid: boolean }> {
    return apiService.get<{ valid: boolean }>(`/plugins/ui/extensions/${id}/validate`);
  }

  /**
   * Envoie une notification depuis un plugin
   */
  async sendNotification(
    pluginId: string,
    options: {
      title: string;
      message: string;
      level?: 'info' | 'success' | 'warning' | 'error';
      actions?: Array<{
        label: string;
        action: string;
        data?: Record<string, any>;
      }>;
      metadata?: Record<string, any>;
      priority?: number;
      expiresAt?: string;
      userId?: string;
    },
  ): Promise<any> {
    return apiService.post<any>(`/plugins/${pluginId}/notifications/send`, options);
  }

  /**
   * Récupère toutes les notifications
   */
  async getNotifications(filters?: {
    pluginId?: string;
    level?: 'info' | 'success' | 'warning' | 'error';
    status?: 'pending' | 'sent' | 'read' | 'archived';
    unreadOnly?: boolean;
  }): Promise<any[]> {
    const params = new URLSearchParams();
    if (filters?.pluginId) params.append('pluginId', filters.pluginId);
    if (filters?.level) params.append('level', filters.level);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.unreadOnly) params.append('unreadOnly', String(filters.unreadOnly));
    
    return apiService.get<any[]>(`/plugins/notifications?${params.toString()}`);
  }

  /**
   * Récupère le nombre de notifications non lues
   */
  async getUnreadCount(pluginId?: string): Promise<{ count: number }> {
    const params = pluginId ? `?pluginId=${pluginId}` : '';
    return apiService.get<{ count: number }>(`/plugins/notifications/unread-count${params}`);
  }

  /**
   * Récupère une notification par son ID
   */
  async getNotification(id: string): Promise<any> {
    return apiService.get<any>(`/plugins/notifications/${id}`);
  }

  /**
   * Marque une notification comme lue
   */
  async markAsRead(id: string): Promise<any> {
    return apiService.post<any>(`/plugins/notifications/${id}/read`);
  }

  /**
   * Archive une notification
   */
  async archiveNotification(id: string): Promise<any> {
    return apiService.post<any>(`/plugins/notifications/${id}/archive`);
  }

  /**
   * Supprime une notification
   */
  async deleteNotification(id: string): Promise<{ success: boolean; message: string }> {
    return apiService.delete<{ success: boolean; message: string }>(
      `/plugins/notifications/${id}`,
    );
  }

  /**
   * Marque toutes les notifications comme lues
   */
  async markAllAsRead(pluginId?: string): Promise<{
    success: boolean;
    count: number;
    message: string;
  }> {
    const params = pluginId ? `?pluginId=${pluginId}` : '';
    return apiService.post<{
      success: boolean;
      count: number;
      message: string;
    }>(`/plugins/notifications/mark-all-read${params}`);
  }

  /**
   * Supprime les notifications expirées
   */
  async deleteExpired(): Promise<{
    success: boolean;
    count: number;
    message: string;
  }> {
    return apiService.delete<{
      success: boolean;
      count: number;
      message: string;
    }>('/plugins/notifications/expired');
  }

  /**
   * Stocke une valeur pour un plugin
   */
  async setStorage(
    pluginId: string,
    key: string,
    value: any,
    options?: {
      type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
      metadata?: Record<string, any>;
      expiresAt?: string;
    },
  ): Promise<any> {
    return apiService.post<any>(`/plugins/${pluginId}/storage/set`, {
      key,
      value,
      ...options,
    });
  }

  /**
   * Récupère une valeur pour un plugin
   */
  async getStorage(
    pluginId: string,
    key: string,
    defaultValue?: any,
  ): Promise<{ key: string; value: any }> {
    const params = defaultValue !== undefined
      ? `?default=${encodeURIComponent(JSON.stringify(defaultValue))}`
      : '';
    return apiService.get<{ key: string; value: any }>(
      `/plugins/${pluginId}/storage/get/${encodeURIComponent(key)}${params}`,
    );
  }

  /**
   * Récupère toutes les valeurs pour un plugin
   */
  async getAllStorage(pluginId: string): Promise<Record<string, any>> {
    return apiService.get<Record<string, any>>(`/plugins/${pluginId}/storage/all`);
  }

  /**
   * Récupère toutes les clés pour un plugin
   */
  async getStorageKeys(pluginId: string): Promise<{ keys: string[] }> {
    return apiService.get<{ keys: string[] }>(`/plugins/${pluginId}/storage/keys`);
  }

  /**
   * Vérifie si une clé existe
   */
  async hasStorage(pluginId: string, key: string): Promise<{ key: string; has: boolean }> {
    return apiService.get<{ key: string; has: boolean }>(
      `/plugins/${pluginId}/storage/has/${encodeURIComponent(key)}`,
    );
  }

  /**
   * Supprime une clé pour un plugin
   */
  async deleteStorage(pluginId: string, key: string): Promise<{ success: boolean; message: string }> {
    return apiService.delete<{ success: boolean; message: string }>(
      `/plugins/${pluginId}/storage/delete/${encodeURIComponent(key)}`,
    );
  }

  /**
   * Supprime toutes les clés pour un plugin
   */
  async clearStorage(pluginId: string): Promise<{
    success: boolean;
    count: number;
    message: string;
  }> {
    return apiService.delete<{
      success: boolean;
      count: number;
      message: string;
    }>(`/plugins/${pluginId}/storage/clear`);
  }

  /**
   * Récupère le nombre d'entrées pour un plugin
   */
  async getStorageCount(pluginId: string): Promise<{ count: number }> {
    return apiService.get<{ count: number }>(`/plugins/${pluginId}/storage/count`);
  }

  /**
   * Récupère la taille totale du stockage pour un plugin
   */
  async getStorageSize(pluginId: string): Promise<{
    size: number;
    sizeFormatted: string;
  }> {
    return apiService.get<{
      size: number;
      sizeFormatted: string;
    }>(`/plugins/${pluginId}/storage/size`);
  }

  /**
   * Supprime les entrées expirées
   */
  async deleteExpiredStorage(): Promise<{
    success: boolean;
    count: number;
    message: string;
  }> {
    return apiService.delete<{
      success: boolean;
      count: number;
      message: string;
    }>('/plugins/storage/expired');
  }

  /**
   * Récupère les erreurs d'un plugin
   */
  async getPluginErrors(
    pluginId: string,
    filters?: {
      type?: 'runtime' | 'permission' | 'validation' | 'network' | 'timeout' | 'memory' | 'unknown';
      severity?: 'low' | 'medium' | 'high' | 'critical';
      resolved?: boolean;
      limit?: number;
    },
  ): Promise<any[]> {
    const params = new URLSearchParams();
    if (filters?.type) params.append('type', filters.type);
    if (filters?.severity) params.append('severity', filters.severity);
    if (filters?.resolved !== undefined) params.append('resolved', String(filters.resolved));
    if (filters?.limit) params.append('limit', String(filters.limit));
    
    return apiService.get<any[]>(`/plugins/${pluginId}/errors?${params.toString()}`);
  }

  /**
   * Récupère les statistiques d'erreurs d'un plugin
   */
  async getErrorStats(pluginId: string): Promise<{
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    unresolved: number;
    recentErrors: number;
    errorRate: number;
  }> {
    return apiService.get<{
      total: number;
      byType: Record<string, number>;
      bySeverity: Record<string, number>;
      unresolved: number;
      recentErrors: number;
      errorRate: number;
    }>(`/plugins/${pluginId}/errors/stats`);
  }

  /**
   * Récupère une erreur par son ID
   */
  async getError(errorId: string): Promise<any> {
    return apiService.get<any>(`/plugins/errors/${errorId}`);
  }

  /**
   * Marque une erreur comme résolue
   */
  async resolveError(errorId: string): Promise<any> {
    return apiService.post<any>(`/plugins/errors/${errorId}/resolve`);
  }

  /**
   * Supprime toutes les erreurs d'un plugin
   */
  async clearPluginErrors(pluginId: string): Promise<{
    success: boolean;
    count: number;
    message: string;
  }> {
    return apiService.delete<{
      success: boolean;
      count: number;
      message: string;
    }>(`/plugins/${pluginId}/errors`);
  }

  /**
   * Réinitialise le circuit breaker d'un plugin
   */
  async resetCircuitBreaker(pluginId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    return apiService.post<{
      success: boolean;
      message: string;
    }>(`/plugins/${pluginId}/errors/circuit-breaker/reset`);
  }

  /**
   * Récupère le statut du circuit breaker d'un plugin
   */
  async getCircuitBreakerStatus(pluginId: string): Promise<{
    isOpen: boolean;
    message: string;
  }> {
    return apiService.get<{
      isOpen: boolean;
      message: string;
    }>(`/plugins/${pluginId}/errors/circuit-breaker/status`);
  }

  /**
   * Exécute les tests pour un plugin
   */
  async runTests(
    pluginId: string,
    categories?: string[],
  ): Promise<any> {
    return apiService.post<any>(`/plugins/${pluginId}/tests/run`, { categories });
  }

  /**
   * Récupère les exécutions de tests pour un plugin
   */
  async getTestRuns(
    pluginId: string,
    filters?: {
      status?: 'pending' | 'running' | 'passed' | 'failed' | 'partial' | 'error';
      limit?: number;
    },
  ): Promise<any[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.limit) params.append('limit', String(filters.limit));
    
    return apiService.get<any[]>(`/plugins/${pluginId}/tests/runs?${params.toString()}`);
  }

  /**
   * Récupère une exécution de tests par son ID
   */
  async getTestRun(runId: string): Promise<any> {
    return apiService.get<any>(`/plugins/tests/runs/${runId}`);
  }

  /**
   * Récupère les tests d'une exécution
   */
  async getTests(runId: string): Promise<any[]> {
    return apiService.get<any[]>(`/plugins/tests/runs/${runId}/tests`);
  }

  /**
   * Vérifie si un plugin peut être publié
   */
  async canPublish(pluginId: string): Promise<{
    canPublish: boolean;
    reason?: string;
    failedTests: string[];
  }> {
    return apiService.get<{
      canPublish: boolean;
      reason?: string;
      failedTests: string[];
    }>(`/plugins/${pluginId}/tests/can-publish`);
  }

  /**
   * Récupère les statistiques de tests pour un plugin
   */
  async getTestStats(pluginId: string): Promise<{
    totalRuns: number;
    lastRunStatus: string | null;
    lastRunDate: Date | null;
    averagePassRate: number;
    totalTests: number;
    passedTests: number;
    failedTests: number;
  }> {
    return apiService.get<{
      totalRuns: number;
      lastRunStatus: string | null;
      lastRunDate: Date | null;
      averagePassRate: number;
      totalTests: number;
      passedTests: number;
      failedTests: number;
    }>(`/plugins/${pluginId}/tests/stats`);
  }

  /**
   * Enregistre un événement d'analytics
   */
  async recordAnalyticsEvent(
    pluginId: string,
    eventType: 'install' | 'uninstall' | 'enable' | 'disable' | 'usage' | 'error' | 'hook_execution' | 'action_execution',
    options?: {
      metadata?: Record<string, any>;
      userId?: string;
      duration?: number;
      success?: boolean;
    },
  ): Promise<any> {
    return apiService.post<any>(`/plugins/${pluginId}/analytics/record`, {
      eventType,
      ...options,
    });
  }

  /**
   * Récupère les statistiques d'analytics pour un plugin
   */
  async getAnalyticsStats(
    pluginId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<{
    totalInstalls: number;
    totalUninstalls: number;
    activeInstalls: number;
    totalUsage: number;
    totalErrors: number;
    averageExecutionTime: number;
    successRate: number;
    uniqueUsers: number;
    popularityScore: number;
  }> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    return apiService.get<{
      totalInstalls: number;
      totalUninstalls: number;
      activeInstalls: number;
      totalUsage: number;
      totalErrors: number;
      averageExecutionTime: number;
      successRate: number;
      uniqueUsers: number;
      popularityScore: number;
    }>(`/plugins/${pluginId}/analytics/stats?${params.toString()}`);
  }

  /**
   * Récupère les données de série temporelle
   */
  async getTimeSeries(
    pluginId: string,
    days?: number,
  ): Promise<Array<{
    date: string;
    installs: number;
    uninstalls: number;
    usage: number;
    errors: number;
  }>> {
    const params = days ? `?days=${days}` : '';
    return apiService.get<Array<{
      date: string;
      installs: number;
      uninstalls: number;
      usage: number;
      errors: number;
    }>>(`/plugins/${pluginId}/analytics/time-series${params}`);
  }

  /**
   * Récupère les événements récents
   */
  async getRecentEvents(
    pluginId: string,
    limit?: number,
  ): Promise<any[]> {
    const params = limit ? `?limit=${limit}` : '';
    return apiService.get<any[]>(`/plugins/${pluginId}/analytics/recent-events${params}`);
  }

  /**
   * Récupère les statistiques par type d'événement
   */
  async getStatsByEventType(pluginId: string): Promise<Record<string, number>> {
    return apiService.get<Record<string, number>>(`/plugins/${pluginId}/analytics/by-event-type`);
  }

  /**
   * Récupère les plugins les plus populaires
   */
  async getPopularPlugins(limit?: number): Promise<Array<{
    pluginId: string;
    pluginName: string;
    popularityScore: number;
    activeInstalls: number;
    totalUsage: number;
  }>> {
    const params = limit ? `?limit=${limit}` : '';
    return apiService.get<Array<{
      pluginId: string;
      pluginName: string;
      popularityScore: number;
      activeInstalls: number;
      totalUsage: number;
    }>>(`/plugins/analytics/popular${params}`);
  }

  /**
   * Récupère les statistiques globales
   */
  async getGlobalStats(): Promise<{
    totalPlugins: number;
    totalInstalls: number;
    totalUsage: number;
    averagePopularity: number;
    topPlugins: Array<{
      pluginId: string;
      pluginName: string;
      popularityScore: number;
    }>;
  }> {
    return apiService.get<{
      totalPlugins: number;
      totalInstalls: number;
      totalUsage: number;
      averagePopularity: number;
      topPlugins: Array<{
        pluginId: string;
        pluginName: string;
        popularityScore: number;
      }>;
    }>('/plugins/analytics/global-stats');
  }

  /**
   * Crée une intention de paiement pour un plugin premium
   */
  async createPaymentIntent(
    pluginId: string,
    userId: string,
    licenseType: 'free' | 'one_time' | 'subscription' | 'lifetime',
    price: number,
    currency?: string,
    paymentProvider?: 'stripe' | 'paypal' | 'manual',
  ): Promise<{
    clientSecret: string;
    paymentId: string;
    licenseId: string;
  }> {
    return apiService.post<{
      clientSecret: string;
      paymentId: string;
      licenseId: string;
    }>(`/plugins/${pluginId}/payment/create-intent`, {
      userId,
      licenseType,
      price,
      currency,
      paymentProvider,
    });
  }

  /**
   * Confirme un paiement et active la licence
   */
  async confirmPayment(
    licenseId: string,
    paymentId: string,
  ): Promise<any> {
    return apiService.post<any>(`/plugins/payment/confirm/${licenseId}`, {
      paymentId,
    });
  }

  /**
   * Annule un abonnement
   */
  async cancelSubscription(licenseId: string): Promise<any> {
    return apiService.post<any>(`/plugins/payment/cancel-subscription/${licenseId}`);
  }

  /**
   * Vérifie si un utilisateur a une licence active pour un plugin
   */
  async checkLicense(
    pluginId: string,
    userId: string,
  ): Promise<{
    hasActiveLicense: boolean;
    license: any | null;
  }> {
    return apiService.get<{
      hasActiveLicense: boolean;
      license: any | null;
    }>(`/plugins/${pluginId}/license/check?userId=${userId}`);
  }

  /**
   * Récupère toutes les licences d'un utilisateur
   */
  async getUserLicenses(userId: string): Promise<any[]> {
    return apiService.get<any[]>(`/plugins/licenses/user/${userId}`);
  }

  /**
   * Récupère toutes les licences d'un plugin
   */
  async getPluginLicenses(pluginId: string): Promise<any[]> {
    return apiService.get<any[]>(`/plugins/${pluginId}/licenses`);
  }
}

export const pluginsService = new PluginsService();

