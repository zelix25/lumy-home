import React, { Suspense, useMemo } from 'react';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import { PluginUIExtension } from '../services/plugins.service';
import { createPluginLoader } from '../utils/pluginLoader';

interface PluginComponentLoaderProps {
  extension: PluginUIExtension;
  props?: Record<string, any>;
}

/**
 * Composant pour charger dynamiquement un composant React depuis un plugin
 * en utilisant React.lazy() pour une gestion optimale du chargement
 * 
 * Ce composant utilise React.lazy() pour charger le composant de manière
 * asynchrone, ce qui permet à React de gérer automatiquement le code splitting
 * et le suspense.
 */
export default function PluginComponentLoader({
  extension,
  props = {},
}: PluginComponentLoaderProps) {
  // Créer le composant lazy une seule fois par extension
  const LazyComponent = useMemo(() => {
    if (!extension.componentPath) {
      // Retourner un composant d'erreur si le chemin n'est pas défini
      return React.lazy(() => Promise.resolve({
        default: () => (
          <Box sx={{ p: 3 }}>
            <Alert severity="warning">
              Chemin du composant non défini pour cette extension.
            </Alert>
          </Box>
        ),
      }));
    }

    // Créer le loader pour React.lazy()
    const loader = createPluginLoader(extension);
    return React.lazy(loader);
  }, [extension]);

  return (
    <Suspense
      fallback={
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '200px',
          }}
        >
          <CircularProgress size={40} />
        </Box>
      }
    >
      <LazyComponent {...props} />
    </Suspense>
  );
}

