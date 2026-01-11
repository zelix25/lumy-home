import { useState, useEffect } from 'react';
import {
  Snackbar,
  Alert,
  AlertTitle,
  Box,
  Button,
  CircularProgress,
  Typography,
} from '@mui/material';
import { useWebSocket } from '../hooks/useWebSocket';
import { updaterService, type ServiceUpdateInfo } from '../services/updater.service';

interface UpdateNotificationData {
  hasUpdates: boolean;
  services: string[];
  updates?: ServiceUpdateInfo[];
  mode?: 'beta' | 'stable';
  timestamp: string;
}

export default function UpdateNotification() {
  const [updateData, setUpdateData] = useState<UpdateNotificationData | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState<{ success: boolean; message: string } | null>(null);
  const { isConnected, socket } = useWebSocket();

  useEffect(() => {
    if (!isConnected) return;

    const handleUpdateAvailable = (data: unknown) => {
      const updateData = data as UpdateNotificationData;
      setUpdateData(updateData);
      setUpdateResult(null);
    };

    const handleUpdateCompleted = (data: unknown) => {
      const result = data as { success: boolean; updated: string[]; mode?: string };
      setIsUpdating(false);
      setUpdateResult({
        success: true,
        message: `Mise à jour réussie pour: ${result.updated.join(', ')}`,
      });
      // Réinitialiser après 5 secondes
      setTimeout(() => {
        setUpdateData(null);
        setUpdateResult(null);
      }, 5000);
    };

    const handleUpdateFailed = (data: unknown) => {
      const result = data as { success: boolean; error?: string; logs?: string[] };
      setIsUpdating(false);
      setUpdateResult({
        success: false,
        message: result.error || result.logs?.join('; ') || 'Erreur lors de la mise à jour',
      });
    };

    socket.on('update:available', handleUpdateAvailable);
    socket.on('update:completed', handleUpdateCompleted);
    socket.on('update:failed', handleUpdateFailed);

    return () => {
      socket.off('update:available', handleUpdateAvailable);
      socket.off('update:completed', handleUpdateCompleted);
      socket.off('update:failed', handleUpdateFailed);
    };
  }, [isConnected, socket]);

  const handleUpdate = async () => {
    if (!updateData) return;

    setIsUpdating(true);
    setUpdateResult(null);

    try {
      await updaterService.applyUpdate(updateData.services);
      // Le résultat sera géré par l'événement WebSocket update:completed
    } catch (error: any) {
      setIsUpdating(false);
      setUpdateResult({
        success: false,
        message: error.message || 'Erreur lors de la mise à jour',
      });
    }
  };

  const handleClose = () => {
    if (!isUpdating) {
      setUpdateData(null);
      setUpdateResult(null);
    }
  };

  // Afficher le résultat de la mise à jour
  if (updateResult) {
    return (
      <Snackbar
        open={!!updateResult}
        autoHideDuration={5000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={handleClose}
          severity={updateResult.success ? 'success' : 'error'}
          variant="filled"
          sx={{
            width: '100%',
            minWidth: 350,
            '& .MuiAlert-message, & .MuiAlertTitle-root': {
              color: 'white',
            },
          }}
        >
          <AlertTitle sx={{ fontWeight: 500, color: 'white' }}>
            {updateResult.success ? 'Mise à jour réussie' : 'Échec de la mise à jour'}
          </AlertTitle>
          <Box component="span" sx={{ color: 'white' }}>
            {updateResult.message}
          </Box>
        </Alert>
      </Snackbar>
    );
  }

  // Afficher la notification de mise à jour disponible
  if (!updateData || !updateData.hasUpdates) {
    return null;
  }

  const servicesList = updateData.updates
    ?.filter((u) => u.hasUpdate)
    .map((u) => u.service)
    .join(', ') || updateData.services.join(', ');

  return (
    <Snackbar
      open={!!updateData}
      autoHideDuration={null} // Ne pas fermer automatiquement
      onClose={handleClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
      <Alert
        onClose={handleClose}
        severity="info"
        variant="filled"
        action={
          <Button
            color="inherit"
            size="small"
            onClick={handleUpdate}
            disabled={isUpdating}
            startIcon={isUpdating ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {isUpdating ? 'Mise à jour...' : 'Mettre à jour'}
          </Button>
        }
        sx={{
          width: '100%',
          minWidth: 400,
          '& .MuiAlert-message, & .MuiAlertTitle-root': {
            color: 'white',
          },
        }}
      >
        <AlertTitle sx={{ fontWeight: 500, color: 'white' }}>
          Mise à jour disponible
        </AlertTitle>
        <Box sx={{ color: 'white' }}>
          <Typography variant="body2" sx={{ color: 'white', mb: 1 }}>
            Des mises à jour sont disponibles pour les services suivants :
          </Typography>
          <Typography variant="body2" sx={{ color: 'white', fontWeight: 500 }}>
            {servicesList}
          </Typography>
          {updateData.mode && (
            <Typography variant="caption" sx={{ color: 'white', opacity: 0.8, display: 'block', mt: 0.5 }}>
              Mode: {updateData.mode === 'beta' ? 'Beta' : 'Stable'}
            </Typography>
          )}
        </Box>
      </Alert>
    </Snackbar>
  );
}
