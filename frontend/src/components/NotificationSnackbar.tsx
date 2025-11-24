import { useState, useEffect } from 'react';
import { Snackbar, Alert, AlertTitle } from '@mui/material';
import { useWebSocket } from '../hooks/useWebSocket';

interface Notification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title?: string;
}

export default function NotificationSnackbar() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentNotification, setCurrentNotification] = useState<Notification | null>(null);
  const { isConnected, socket } = useWebSocket();

  useEffect(() => {
    if (!isConnected) return;

    const handleDeviceDiscovered = (data: { device: any; message: string }) => {
      const notification: Notification = {
        id: Date.now().toString(),
        title: 'Nouvel appareil détecté',
        message: data.message,
        type: 'info',
      };
      setNotifications((prev) => [...prev, notification]);
    };

    const handleDeviceUpdated = (data: { device: any; message: string }) => {
      const notification: Notification = {
        id: Date.now().toString(),
        title: 'Appareil mis à jour',
        message: data.message,
        type: 'success',
      };
      setNotifications((prev) => [...prev, notification]);
    };

    socket.on('device:discovered', handleDeviceDiscovered);
    socket.on('device:updated', handleDeviceUpdated);

    return () => {
      socket.off('device:discovered', handleDeviceDiscovered);
      socket.off('device:updated', handleDeviceUpdated);
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
        sx={{ width: '100%', minWidth: 300 }}
      >
        {currentNotification?.title && (
          <AlertTitle sx={{ fontWeight: 600 }}>
            {currentNotification.title}
          </AlertTitle>
        )}
        {currentNotification?.message}
      </Alert>
    </Snackbar>
  );
}

