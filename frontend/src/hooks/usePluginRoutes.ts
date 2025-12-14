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
        // Vérifier que pages n'est pas null ou undefined
        if (pages && Array.isArray(pages)) {
          const pluginRoutes: PluginRoute[] = pages.map((page) => ({
            path: page.route || `/plugins/${page.name}`,
            element: React.createElement(PluginPageLoader, {
              route: page.route || `/plugins/${page.name}`,
            }),
          }));
          setRoutes(pluginRoutes);
        } else {
          // Si pages est null ou undefined, initialiser avec un tableau vide
          setRoutes([]);
        }
      } catch (error) {
        console.error('Erreur lors du chargement des routes de plugins:', error);
        // En cas d'erreur, initialiser avec un tableau vide pour éviter les erreurs
        setRoutes([]);
      }
    };

    loadPluginRoutes();
  }, []);

  return routes;
}

