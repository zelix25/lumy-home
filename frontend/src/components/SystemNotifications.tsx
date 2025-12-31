import { useState, useEffect } from 'react';
import {
  IconButton,
  Badge,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  Box,
  Alert,
  Collapse,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { subscribeToNotifications, getNotifications } from '../hooks/useNotification';
import { systemHealthService, type SystemNotification as BackendSystemNotification } from '../services/system-health.service';
import { useWebSocket } from '../hooks/useWebSocket';
import { useTranslation } from 'react-i18next';

interface CombinedNotification {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  instructions?: string | null;
  containerName?: string | null;
  read: boolean;
  isSystemNotification: boolean;
  createdAt: string;
}

export default function SystemNotifications() {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notifications, setNotifications] = useState<CombinedNotification[]>([]);
  const [expandedNotifications, setExpandedNotifications] = useState<Set<string>>(new Set());
  const { t } = useTranslation();
  const { isConnected, socket } = useWebSocket();

  // Charger les notifications système depuis le backend
  useEffect(() => {
    const loadSystemNotifications = async () => {
      try {
        const systemNotifications = await systemHealthService.getNotifications();
        // Vérifier que systemNotifications est un tableau
        if (!Array.isArray(systemNotifications)) {
          console.error('Les notifications système ne sont pas un tableau:', systemNotifications);
          return;
        }
        
        setNotifications((prev) => {
          const systemMap = new Map(
            systemNotifications.map((n) => [
              n.id,
              {
                id: n.id,
                type: n.type,
                title: n.title,
                message: n.message,
                instructions: n.instructions,
                containerName: n.containerName,
                read: n.resolved,
                isSystemNotification: true,
                createdAt: n.createdAt,
              },
            ])
          );

          // Fusionner avec les notifications locales existantes
          const localMap = new Map(
            prev
              .filter((n) => !n.isSystemNotification)
              .map((n) => [n.id, n])
          );

          // Combiner les deux
          const combined = Array.from(new Map([...systemMap, ...localMap]).values());
          return combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        });
      } catch (error) {
        console.error('Erreur lors du chargement des notifications système:', error);
      }
    };

    loadSystemNotifications();
  }, []);

  // Écouter les notifications système via WebSocket
  useEffect(() => {
    if (!isConnected || !socket) return;

    const handleSystemNotification = (data: unknown) => {
      const notification = data as BackendSystemNotification;
      setNotifications((prev) => {
        const existing = prev.find((n) => n.id === notification.id);
        if (existing && existing.isSystemNotification) {
          // Mettre à jour la notification existante
          return prev.map((n) =>
            n.id === notification.id
              ? {
                  ...n,
                  type: notification.type,
                  title: notification.title,
                  message: notification.message,
                  instructions: notification.instructions,
                  read: notification.resolved,
                }
              : n
          );
        }
        // Ajouter la nouvelle notification
        return [
          {
            id: notification.id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            instructions: notification.instructions,
            containerName: notification.containerName,
            read: notification.resolved,
            isSystemNotification: true,
            createdAt: notification.createdAt,
          },
          ...prev,
        ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      });
    };

    socket.on('system:notification', handleSystemNotification);

    return () => {
      socket.off('system:notification', handleSystemNotification);
    };
  }, [isConnected, socket]);

  // Gérer les notifications locales
  useEffect(() => {
    // Charger les notifications existantes au montage
    const existingNotifications = getNotifications();
    setNotifications((prev) => {
      const localNotifications: CombinedNotification[] = existingNotifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title || t('notifications.notification', { defaultValue: 'Notification' }),
        message: n.message,
        read: false,
        isSystemNotification: false,
        createdAt: new Date().toISOString(),
      }));

      // Fusionner avec les notifications système existantes
      const systemNotifications = prev.filter((n) => n.isSystemNotification);
      return [...systemNotifications, ...localNotifications].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });

    const unsubscribe = subscribeToNotifications((newNotifications) => {
      setNotifications((prevNotifications) => {
        const systemNotifications = prevNotifications.filter((n) => n.isSystemNotification);
        const localMap = new Map(
          newNotifications.map((n) => [
            n.id,
            {
              id: n.id,
              type: n.type,
              title: n.title || t('notifications.notification', { defaultValue: 'Notification' }),
              message: n.message,
              read: false,
              isSystemNotification: false,
              createdAt: new Date().toISOString(),
            },
          ])
        );

        // Fusionner avec les notifications locales existantes
        const existingLocal: [string, CombinedNotification][] = prevNotifications
          .filter((n) => !n.isSystemNotification)
          .map((n) => [n.id, n]);
        const combinedLocal = new Map<string, CombinedNotification>([...existingLocal, ...Array.from(localMap.entries())]);

        return [...systemNotifications, ...Array.from(combinedLocal.values())].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
    });

    return unsubscribe;
  }, [t]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleMarkAsRead = async (id: string) => {
    const notification = notifications.find((n) => n.id === id);
    if (notification?.isSystemNotification) {
      // Marquer comme résolu côté backend
      try {
        await systemHealthService.markAsResolved(id);
      } catch (error) {
        console.error('Erreur lors du marquage de la notification comme résolue:', error);
      }
    }
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const handleMarkAllAsRead = () => {
    // Marquer toutes les notifications système comme résolues
    const systemNotifications = notifications.filter((n) => !n.read && n.isSystemNotification);
    systemNotifications.forEach((n) => {
      systemHealthService.markAsResolved(n.id).catch((error) => {
        console.error('Erreur lors du marquage de la notification comme résolue:', error);
      });
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const toggleExpand = (id: string) => {
    setExpandedNotifications((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getNotificationIcon = (type: CombinedNotification['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircleIcon fontSize="small" color="success" />;
      case 'warning':
        return <WarningIcon fontSize="small" color="warning" />;
      case 'error':
        return <ErrorIcon fontSize="small" color="error" />;
      default:
        return <InfoIcon fontSize="small" color="info" />;
    }
  };

  const getNotificationColor = (type: CombinedNotification['type']) => {
    switch (type) {
      case 'success':
        return 'success.main';
      case 'warning':
        return 'warning.main';
      case 'error':
        return 'error.main';
      default:
        return 'info.main';
    }
  };

  return (
    <>
      <IconButton
        color="inherit"
        onClick={handleMenuOpen}
        size="small"
        aria-label="notifications"
      >
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            width: 360,
            maxHeight: 500,
            mt: 1,
          },
        }}
      >
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 500 }}>
            {t('notifications.title', { defaultValue: 'Notifications' })}
          </Typography>
          {unreadCount > 0 && (
            <Typography
              variant="body2"
              sx={{ color: 'text.secondary', cursor: 'pointer' }}
              onClick={handleMarkAllAsRead}
            >
              {t('notifications.markAllAsRead', { defaultValue: 'Tout marquer comme lu' })}
            </Typography>
          )}
        </Box>
        <Divider />
        <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
          {notifications.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {t('notifications.noNotifications', { defaultValue: 'Aucune notification' })}
              </Typography>
            </Box>
          ) : (
            notifications.map((notification) => {
              const isExpanded = expandedNotifications.has(notification.id);
              const hasInstructions = notification.instructions && notification.instructions.trim().length > 0;

              return (
                <Box key={notification.id}>
                  <MenuItem
                    onClick={() => {
                      if (!hasInstructions) {
                        handleMarkAsRead(notification.id);
                      } else {
                        toggleExpand(notification.id);
                      }
                    }}
                    sx={{
                      py: 1.5,
                      px: 2,
                      backgroundColor: notification.read ? 'transparent' : 'action.hover',
                      '&:hover': {
                        backgroundColor: 'action.selected',
                      },
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                    }}
                  >
                    <Box sx={{ display: 'flex', width: '100%', alignItems: 'center' }}>
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        {getNotificationIcon(notification.type)}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: notification.read ? 400 : 500,
                              color: getNotificationColor(notification.type),
                            }}
                          >
                            {notification.title}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {notification.message}
                          </Typography>
                        }
                        sx={{ flex: 1 }}
                      />
                      {hasInstructions && (
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(notification.id);
                          }}
                          sx={{ ml: 1 }}
                        >
                          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      )}
                      {!notification.read && (
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: 'primary.main',
                            ml: 1,
                          }}
                        />
                      )}
                    </Box>
                    {hasInstructions && (
                      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        <Box sx={{ mt: 2, width: '100%', pl: 6 }}>
                          <Alert severity={notification.type === 'error' ? 'error' : notification.type === 'warning' ? 'warning' : 'info'} sx={{ mb: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 500, mb: 1 }}>
                              {t('notifications.instructions', { defaultValue: 'Instructions' })}
                            </Typography>
                            <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                              {notification.instructions}
                            </Typography>
                          </Alert>
                          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                            <Typography
                              variant="caption"
                              sx={{ color: 'primary.main', cursor: 'pointer' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkAsRead(notification.id);
                              }}
                            >
                              {t('notifications.markAsResolved', { defaultValue: 'Marquer comme résolu' })}
                            </Typography>
                          </Box>
                        </Box>
                      </Collapse>
                    )}
                  </MenuItem>
                  {notification !== notifications[notifications.length - 1] && <Divider />}
                </Box>
              );
            })
          )}
        </Box>
      </Menu>
    </>
  );
}

