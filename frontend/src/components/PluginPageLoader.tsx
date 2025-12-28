import PluginComponentLoader from './PluginComponentLoader';
import { PluginUIExtension } from '../services/plugins.service';

interface PluginPageLoaderProps {
  extension: PluginUIExtension;
}

/**
 * Composant pour charger dynamiquement une page de plugin
 * 
 * Ce composant utilise PluginComponentLoader pour charger le composant React
 * d'un plugin depuis le backend.
 */
export default function PluginPageLoader({ extension }: PluginPageLoaderProps) {
  return (
    <PluginComponentLoader
      extension={extension}
      props={extension.props || {}}
    />
  );
}

