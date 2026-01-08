import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { settingsService } from '../services/settings.service';

export default function GlobalSetupChecker({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkSetup = async () => {
      try {
        // Utiliser la route publique pour vérifier le setup
        const { setup } = await settingsService.getSetupStatus();
        
        // Si setup est false et qu'on est sur /setup, empêcher l'accès et rediriger
        if (!setup && location.pathname === '/setup') {
          navigate('/login', { replace: true });
          return;
        }
        
        // Si setup est true, rediriger vers /setup (sauf si on est déjà sur /setup)
        if (setup && location.pathname !== '/setup') {
          navigate('/setup', { replace: true });
          return;
        }
      } catch (err) {
        console.error('Erreur lors de la vérification du setup:', err);
        // En cas d'erreur, on continue quand même (ne pas bloquer l'application)
      } finally {
        setChecking(false);
      }
    };

    checkSetup();
  }, [navigate, location.pathname]);

  if (checking) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return <>{children}</>;
}

