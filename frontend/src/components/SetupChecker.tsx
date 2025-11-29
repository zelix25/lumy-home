import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { settingsService } from '../services/settings.service';

export default function SetupChecker({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkSetup = async () => {
      try {
        const settings = await settingsService.getSettings();
        if (settings.setup) {
          navigate('/setup', { replace: true });
        }
      } catch (err) {
        console.error('Erreur lors de la vérification du setup:', err);
      } finally {
        setChecking(false);
      }
    };

    checkSetup();
  }, [navigate]);

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


