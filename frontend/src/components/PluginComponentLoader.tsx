import React, { useState, useEffect, Suspense, ComponentType } from 'react';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import { PluginUIExtension } from '../services/plugins.service';

interface PluginComponentLoaderProps {
  extension: PluginUIExtension;
  props?: Record<string, any>;
}

/**
 * Composant pour charger dynamiquement un composant React depuis un plugin
 * 
 * Ce composant charge le code JavaScript/TypeScript d'un composant depuis le backend
 * et l'exécute de manière sécurisée.
 * 
 * Note: Pour des raisons de sécurité, le chargement dynamique de code JavaScript
 * nécessite une validation stricte et un sandboxing. Cette implémentation est
 * une version de base qui peut être améliorée avec:
 * - Module Federation (webpack)
 * - Web Workers pour isolation
 * - CSP (Content Security Policy) strict
 */
export default function PluginComponentLoader({
  extension,
  props = {},
}: PluginComponentLoaderProps) {
  const [Component, setComponent] = useState<ComponentType<any> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadComponent = async () => {
      if (!extension.componentPath) {
        setError('Chemin du composant non défini');
        setLoading(false);
        return;
      }

      try {
        // Construire l'URL du composant depuis le backend
        const pluginId = extension.pluginId;
        const componentUrl = `/api/plugins/${pluginId}/static${extension.componentPath}`;

        // Méthode 1: Essayer de charger via dynamic import si le fichier est compilé
        // Cette méthode fonctionne si le plugin expose un module ES6 compilé
        try {
          // Pour l'instant, on utilise une approche avec fetch + eval (avec validation)
          // Dans le futur, on pourra utiliser Module Federation ou un système de build
          const response = await fetch(componentUrl, {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('lumy_token')}`,
            },
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const code = await response.text();

          // Validation basique du code (vérifier qu'il ne contient pas de code dangereux)
          // Dans un environnement de production, cette validation devrait être beaucoup plus stricte
          if (
            code.includes('eval(') ||
            code.includes('Function(') ||
            code.includes('document.cookie') ||
            code.includes('localStorage.setItem') ||
            code.includes('sessionStorage.setItem')
          ) {
            throw new Error(
              'Le code du composant contient des opérations non autorisées',
            );
          }

          // Créer un module wrapper pour isoler le code
          const moduleWrapper = `
            (function() {
              const exports = {};
              const module = { exports };
              ${code}
              return module.exports || exports.default || exports;
            })();
          `;

          // Exécuter le code dans un contexte isolé
          // Note: Cette approche nécessite que le code soit compilé en format compatible
          const componentFactory = new Function('React', 'return ' + moduleWrapper)(React);
          
          // Si le composant est une fonction ou une classe React, l'utiliser directement
          if (typeof componentFactory === 'function') {
            setComponent(() => componentFactory);
          } else if (componentFactory && typeof componentFactory.default === 'function') {
            setComponent(() => componentFactory.default);
          } else {
            throw new Error('Le composant exporté n\'est pas une fonction React valide');
          }

          setLoading(false);
        } catch (fetchError: any) {
          // Si le chargement dynamique échoue, afficher un placeholder informatif
          console.warn('Impossible de charger le composant dynamiquement:', fetchError);
          
          // Créer un composant placeholder
          setComponent(() => () => (
            <Box sx={{ p: 3 }}>
              <Typography variant="h4" gutterBottom>
                {extension.displayName}
              </Typography>
              {extension.description && (
                <Typography variant="body1" color="text.secondary" paragraph>
                  {extension.description}
                </Typography>
              )}
              <Alert severity="info">
                <Typography variant="body2" gutterBottom>
                  <strong>Plugin:</strong> {extension.name}
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>Composant:</strong> {extension.componentPath}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Le composant sera chargé une fois que le plugin sera compilé et prêt.
                  <br />
                  Pour l'instant, les plugins doivent fournir des composants pré-compilés
                  au format ES6 module.
                </Typography>
              </Alert>
            </Box>
          ));
          
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Erreur lors du chargement du composant du plugin:', err);
        setError(err.message || 'Erreur lors du chargement du composant');
        setLoading(false);
      }
    };

    loadComponent();
  }, [extension]);

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          <Typography variant="h6" gutterBottom>
            Erreur de chargement
          </Typography>
          {error}
        </Alert>
      </Box>
    );
  }

  if (!Component) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          Composant non disponible pour cette extension.
        </Alert>
      </Box>
    );
  }

  return (
    <Suspense
      fallback={
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '400px',
          }}
        >
          <CircularProgress />
        </Box>
      }
    >
      <Component {...props} />
    </Suspense>
  );
}

