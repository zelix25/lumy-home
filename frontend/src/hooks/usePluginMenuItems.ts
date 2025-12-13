import { useEffect, useState } from 'react';
import { pluginsService } from '../services/plugins.service';

interface PluginMenuItem {
  label: string;
  path: string;
  icon?: string;
  order: number;
}

/**
 * Hook pour charger dynamiquement les éléments de menu des plugins
 */
export function usePluginMenuItems(): PluginMenuItem[] {
  const [menuItems, setMenuItems] = useState<PluginMenuItem[]>([]);

  useEffect(() => {
    const loadPluginMenuItems = async () => {
      try {
        const items = await pluginsService.getAvailableMenuItems();
        const pluginMenuItems: PluginMenuItem[] = items.map((item) => ({
          label: item.displayName,
          path: item.route || `/plugins/${item.name}`,
          icon: item.icon,
          order: item.order || 0,
        }));
        // Trier par ordre
        pluginMenuItems.sort((a, b) => a.order - b.order);
        setMenuItems(pluginMenuItems);
      } catch (error) {
        console.error('Erreur lors du chargement des éléments de menu de plugins:', error);
      }
    };

    loadPluginMenuItems();
  }, []);

  return menuItems;
}

