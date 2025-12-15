import { useState, useEffect } from 'react';
import { pluginsService, PluginUIExtension } from '../services/plugins.service';

/**
 * Hook pour charger les widgets disponibles depuis les plugins
 */
export function usePluginWidgets(): PluginUIExtension[] {
  const [widgets, setWidgets] = useState<PluginUIExtension[]>([]);

  useEffect(() => {
    const loadWidgets = async () => {
      try {
        const availableWidgets = await pluginsService.getAvailableWidgets();
        // Trier les widgets par menuOrder si défini
        const sortedWidgets = (availableWidgets || []).sort((a, b) => {
          const orderA = a.menuOrder ?? 999;
          const orderB = b.menuOrder ?? 999;
          return orderA - orderB;
        });
        setWidgets(sortedWidgets);
      } catch (error) {
        console.error('Erreur lors du chargement des widgets de plugins:', error);
        setWidgets([]);
      }
    };

    loadWidgets();
  }, []);

  return widgets;
}

