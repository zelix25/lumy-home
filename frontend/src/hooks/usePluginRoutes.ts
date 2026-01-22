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
 * Ne charge les routes que si l'utilisateur est authentifié
 */
export function usePluginRoutes(): PluginRoute[] {
  const [routes, setRoutes] = useState<PluginRoute[]>([]);

  useEffect(() => {
    // Vérifier si l'utilisateur est authentifié avant de charger les routes
    const token = localStorage.getItem('lumy_token');
    if (!token) {
      // Pas de token, ne pas charger les routes
      setRoutes([]);
      return;
    }

    const loadPluginRoutes = async () => {
      try {
        const pages = await pluginsService.getAvailablePages();
        // Exclure les pages qui commencent par /settings/ car elles sont gérées par SettingsPage
        const pagesToRoute = (pages || []).filter((page) => !page.route?.startsWith('/settings/'));
        const pluginRoutes: PluginRoute[] = pagesToRoute.map((page) => ({
          path: page.route || `/plugins/${page.name}`,
          element: React.createElement(PluginPageLoader, { extension: page }),
        }));
        setRoutes(pluginRoutes);
      } catch (error: any) {
        // Si c'est une erreur 401, ne pas logger (utilisateur non authentifié)
        if (error.message && error.message.includes('Non autorisé')) {
          setRoutes([]);
          return;
        }
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
 * Ne charge les éléments de menu que si l'utilisateur est authentifié
 */
export function usePluginMenuItems(): PluginUIExtension[] {
  const [menuItems, setMenuItems] = useState<PluginUIExtension[]>([]);

  useEffect(() => {
    // Vérifier si l'utilisateur est authentifié avant de charger les éléments de menu
    const token = localStorage.getItem('lumy_token');
    if (!token) {
      // Pas de token, ne pas charger les éléments de menu
      setMenuItems([]);
      return;
    }

    const loadMenuItems = async () => {
      try {
        const items = await pluginsService.getAvailableMenuItems();
        setMenuItems(items || []);
      } catch (error: any) {
        // Si c'est une erreur 401, ne pas logger (utilisateur non authentifié)
        if (error.message && error.message.includes('Non autorisé')) {
          setMenuItems([]);
          return;
        }
        console.error('Erreur lors du chargement des éléments de menu des plugins:', error);
        setMenuItems([]);
      }
    };

    loadMenuItems();
  }, []);

  return menuItems;
}

