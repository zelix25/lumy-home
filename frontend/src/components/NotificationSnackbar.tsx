import { useState, useEffect } from 'react';
import { Snackbar, Alert, AlertTitle, Box } from '@mui/material';
import { useWebSocket } from '../hooks/useWebSocket';
import { subscribeToNotifications, getNotifications, type Notification } from '../hooks/useNotification';

export default function NotificationSnackbar() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentNotification, setCurrentNotification] = useState<Notification | null>(null);
  const { isConnected, socket } = useWebSocket();

  // S'abonner aux notifications
  useEffect(() => {
    const unsubscribe = subscribeToNotifications((newNotifications) => {
      setNotifications(newNotifications);
    });
    // Charger les notifications existantes
    setNotifications(getNotifications());
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isConnected) return;

    const handleDeviceDiscovered = (data: unknown) => {
      const eventData = data as { device: any; message: string };
      const notification: Notification = {
        id: Date.now().toString(),
        title: 'Nouvel appareil détecté',
        message: eventData.message,
        type: 'info',
      };
      setNotifications((prev) => [...prev, notification]);
    };

    const handleDeviceUpdated = (_data: unknown) => {
      // Ne pas afficher de notification pour les mises à jour d'appareils
      // Les notifications sont gérées par handleDeviceState pour les données de capteurs
    };
    
    const handleDeviceState = (_data: unknown) => {
      // Ne pas afficher de notification pour les mises à jour de données de capteurs
    };

    const handlePluginNotification = (data: unknown) => {
      const notificationData = data as {
        id: string;
        pluginId: string;
        title: string;
        message: string;
        type: 'info' | 'success' | 'warning' | 'error';
        metadata?: Record<string, any>;
        createdAt: string;
      };
      const notification: Notification = {
        id: notificationData.id,
        title: notificationData.title,
        message: notificationData.message,
        type: notificationData.type,
      };
      setNotifications((prev) => [...prev, notification]);
    };

    socket.on('device:discovered', handleDeviceDiscovered);
    socket.on('device:updated', handleDeviceUpdated);
    socket.on('device:state', handleDeviceState);
    socket.on('plugin:notification', handlePluginNotification);

    return () => {
      socket.off('device:discovered', handleDeviceDiscovered);
      socket.off('device:updated', handleDeviceUpdated);
      socket.off('device:state', handleDeviceState);
      socket.off('plugin:notification', handlePluginNotification);
    };
  }, [isConnected, socket]);

  useEffect(() => {
    if (notifications.length > 0 && !currentNotification) {
      setCurrentNotification(notifications[0]);
      setNotifications((prev) => prev.slice(1));
    }
  }, [notifications, currentNotification]);

  const handleClose = () => {
    setCurrentNotification(null);
  };

  return (
    <Snackbar
      open={!!currentNotification}
      autoHideDuration={6000}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
      <Alert
        onClose={handleClose}
        severity={currentNotification?.type || 'info'}
        variant="filled"
        sx={{ 
          width: '100%', 
          minWidth: 300,
          '& .MuiAlert-message, & .MuiAlertTitle-root': {
            color: 'white',
          },
        }}
      >
        {currentNotification?.title && (
          <AlertTitle sx={{ fontWeight: 500, color: 'white' }}>
            {currentNotification.title}
          </AlertTitle>
        )}
        <Box component="span" sx={{ color: 'white' }}>
          {currentNotification?.message}
        </Box>
      </Alert>
    </Snackbar>
  );
}

