import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Alert } from '@mui/material';
import { pluginsService } from '../services/plugins.service';

interface PluginComponentLoaderProps {
  extensionId: string;
  props?: Record<string, any>;
}

const PluginComponentLoader: React.FC<PluginComponentLoaderProps> = ({
  extensionId,
  props = {},
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [extension, setExtension] = useState<any>(null);
  const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);

  useEffect(() => {
    const loadExtension = async () => {
      try {
        setLoading(true);
        setError(null);

        // Récupérer l'extension
        const ext = await pluginsService.getUIExtension(extensionId);
        setExtension(ext);

        // Charger le composant selon le type
        if (ext.iframeUrl) {
          // Pour les iframes, on affiche directement
          setComponent(null);
        } else if (ext.componentPath) {
          // Pour les composants React, on doit charger dynamiquement
          // TODO: Implémenter le chargement dynamique sécurisé
          setError('Le chargement dynamique de composants React n\'est pas encore implémenté');
        } else {
          setError('Aucun composant ou URL iframe spécifiée');
        }
      } catch (err: any) {
        setError(err.message || 'Erreur lors du chargement de l\'extension');
      } finally {
        setLoading(false);
      }
    };

    loadExtension();
  }, [extensionId]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress size={40} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={2}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!extension) {
    return (
      <Box p={2}>
        <Alert severity="warning">Extension non trouvée</Alert>
      </Box>
    );
  }

  // Afficher un iframe si c'est une URL iframe
  if (extension.iframeUrl) {
    return (
      <Box sx={{ width: '100%', height: '400px' }}>
        <iframe
          src={extension.iframeUrl}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
          }}
          title={extension.displayName}
        />
      </Box>
    );
  }

  // Afficher le composant chargé
  if (Component) {
    return <Component {...(extension.props || {}), ...props} />;
  }

  return null;
};

export default PluginComponentLoader;

