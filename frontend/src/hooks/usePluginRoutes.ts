import { useState, useEffect } from 'react';
import React from 'react';
import { pluginsService, PluginUIExtension } from '../services/plugins.service';
import PluginPageLoader from '../components/PluginPageLoader';

export interface PluginRoute {
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
        const pluginRoutes: PluginRoute[] = (pages || []).map((page) => ({
          path: page.route || `/plugins/${page.name}`,
          element: React.createElement(PluginPageLoader, { extension: page }),
        }));
        setRoutes(pluginRoutes);
      } catch (error) {
        console.error('Erreur lors du chargement des routes de plugins:', error);
        setRoutes([]); // Set to empty array on error
      }
    };

    loadPluginRoutes();
  }, []);

  return routes;
}

/**
 * Hook pour charger les éléments de menu des plugins
 */
export function usePluginMenuItems(): PluginUIExtension[] {
  const [menuItems, setMenuItems] = useState<PluginUIExtension[]>([]);

  useEffect(() => {
    const loadMenuItems = async () => {
      try {
        const items = await pluginsService.getAvailableMenuItems();
        setMenuItems(items || []);
      } catch (error) {
        console.error('Erreur lors du chargement des éléments de menu des plugins:', error);
        setMenuItems([]);
      }
    };

    loadMenuItems();
  }, []);

  return menuItems;
}

