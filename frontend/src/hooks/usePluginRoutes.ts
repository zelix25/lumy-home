import React, { useEffect, useState } from 'react';
import { pluginsService } from '../services/plugins.service';
import PluginPageLoader from '../components/PluginPageLoader';

interface PluginRoute {
  path: string;
  element: React.ReactElement;
}

/**
 * Hook pour charger dynamiquement les routes des plugins
 */
export function usePluginRoutes(): PluginRoute[] {
  const [routes, setRoutes] = useState<PluginRoute[]>([]);

  useEffect(() => {
    const loadPluginRoutes = async () => {
      try {
        const pages = await pluginsService.getAvailablePages();
        const pluginRoutes: PluginRoute[] = pages.map((page) => ({
          path: page.route || `/plugins/${page.name}`,
          element: React.createElement(PluginPageLoader, {
            route: page.route || `/plugins/${page.name}`,
          }),
        }));
        setRoutes(pluginRoutes);
      } catch (error) {
        console.error('Erreur lors du chargement des routes de plugins:', error);
      }
    };

    loadPluginRoutes();
  }, []);

  return routes;
}

