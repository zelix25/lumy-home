import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stack,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Paper,
  Divider,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import { settingsService } from '../services/settings.service';
import { systemHealthService, SystemNotification } from '../services/system-health.service';
import { updaterService, UpdaterStatus } from '../services/updater.service';
import { apiService } from '../services/api.service';

interface SystemInfo {
  ram: number;
  cpuArch: string;
  cpuType: string;
}

interface ServiceStatus {
  name: string;
  status: 'running' | 'exited' | 'restarting' | 'paused' | 'dead' | 'not_found';
  image?: string;
}

export default function SystemPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [updaterStatus, setUpdaterStatus] = useState<UpdaterStatus | null>(null);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [restartDialogOpen, setRestartDialogOpen] = useState(false);
  const [shutdownDialogOpen, setShutdownDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadSystemData();
    // Rafraîchir toutes les 30 secondes
    const interval = setInterval(loadSystemData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadSystemData = async () => {
    try {
      setError(null);
      const [info, status, notifs, servicesData] = await Promise.allSettled([
        settingsService.getSystemInfo(),
        updaterService.getStatus().catch(() => null),
        systemHealthService.getNotifications(),
        getServicesStatus(),
      ]);

      if (info.status === 'fulfilled') {
        setSystemInfo(info.value);
      }

      if (status.status === 'fulfilled' && status.value) {
        setUpdaterStatus(status.value);
      }

      if (notifs.status === 'fulfilled') {
        setNotifications(notifs.value);
      }

      if (servicesData.status === 'fulfilled') {
        setServices(servicesData.value);
      }
    } catch (err: any) {
      setError(err.message || t('system.errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  const getServicesStatus = async (): Promise<ServiceStatus[]> => {
    try {
      const response = await apiService.get<Array<{ name: string; status: string; image?: string }>>('/system-health/services');
      return response.map(s => ({
        name: s.name,
        status: s.status as ServiceStatus['status'],
        image: s.image,
      })) || [];
    } catch {
      return [];
    }
  };

  const handleRestart = async () => {
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await apiService.post('/system/restart');
      setSuccess(t('system.restartInitiated'));
      setRestartDialogOpen(false);
    } catch (err: any) {
      setError(err.message || t('system.errorRestart'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleShutdown = async () => {
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await apiService.post('/system/shutdown');
      setSuccess(t('system.shutdownInitiated'));
      setShutdownDialogOpen(false);
    } catch (err: any) {
      setError(err.message || t('system.errorShutdown'));
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'success';
      case 'exited':
      case 'dead':
      case 'not_found':
        return 'error';
      case 'restarting':
        return 'warning';
      case 'paused':
        return 'info';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'running':
        return t('system.serviceRunning');
      case 'exited':
        return t('system.serviceExited');
      case 'restarting':
        return t('system.serviceRestarting');
      case 'paused':
        return t('system.servicePaused');
      case 'dead':
        return t('system.serviceDead');
      case 'not_found':
        return t('system.serviceNotFound');
      default:
        return status;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* En-tête avec boutons d'action */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Typography variant="h4" component="h1" sx={{ fontWeight: 500 }}>
          {t('system.title')}
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="contained"
            color="warning"
            startIcon={<RestartAltIcon />}
            onClick={() => setRestartDialogOpen(true)}
            disabled={actionLoading}
          >
            {t('system.restart')}
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<PowerSettingsNewIcon />}
            onClick={() => setShutdownDialogOpen(true)}
            disabled={actionLoading}
          >
            {t('system.shutdown')}
          </Button>
        </Stack>
      </Box>

      {/* Messages d'erreur/succès */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Informations système */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 500, mb: 2 }}>
                {t('system.systemInfo')}
              </Typography>
              <Stack spacing={2}>
                {systemInfo && (
                  <>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {t('system.ram')}
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {formatBytes(systemInfo.ram)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {t('system.cpuArch')}
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {systemInfo.cpuArch}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {t('system.cpuType')}
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {systemInfo.cpuType}
                      </Typography>
                    </Box>
                  </>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Statut de l'updater */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 500, mb: 2 }}>
                {t('system.updaterStatus')}
              </Typography>
              {updaterStatus ? (
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {t('system.mode')}
                    </Typography>
                    <Chip
                      label={updaterStatus.systemMode === 'beta' ? t('system.beta') : t('system.stable')}
                      color={updaterStatus.systemMode === 'beta' ? 'warning' : 'success'}
                      size="small"
                      sx={{ mt: 0.5 }}
                    />
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {t('system.imageTag')}
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {updaterStatus.imageTag}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {t('system.services')}
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {updaterStatus.services.join(', ')}
                    </Typography>
                  </Box>
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {t('system.updaterNotAvailable')}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* État des services */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 500, mb: 2 }}>
                {t('system.servicesStatus')}
              </Typography>
              {services.length > 0 ? (
                <Grid container spacing={2}>
                  {services.map((service) => (
                    <Grid item xs={12} sm={6} md={4} key={service.name}>
                      <Paper
                        variant="outlined"
                        sx={{
                          p: 2,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <Box>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {service.name}
                          </Typography>
                          {service.image && (
                            <Typography variant="caption" color="text.secondary">
                              {service.image}
                            </Typography>
                          )}
                        </Box>
                        <Chip
                          label={getStatusLabel(service.status)}
                          color={getStatusColor(service.status) as any}
                          size="small"
                        />
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {t('system.noServices')}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Notifications système */}
        {notifications.length > 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 500, mb: 2 }}>
                  {t('system.notifications')}
                </Typography>
                <Stack spacing={2}>
                  {notifications.slice(0, 5).map((notification) => (
                    <Alert
                      key={notification.id}
                      severity={
                        notification.type === 'error'
                          ? 'error'
                          : notification.type === 'warning'
                            ? 'warning'
                            : notification.type === 'success'
                              ? 'success'
                              : 'info'
                      }
                      icon={
                        notification.type === 'error' ? (
                          <ErrorIcon />
                        ) : notification.type === 'warning' ? (
                          <WarningIcon />
                        ) : notification.type === 'success' ? (
                          <CheckCircleIcon />
                        ) : (
                          <InfoIcon />
                        )
                      }
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>
                        {notification.title}
                      </Typography>
                      <Typography variant="body2">{notification.message}</Typography>
                    </Alert>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Dialog de confirmation pour redémarrer */}
      <Dialog open={restartDialogOpen} onClose={() => setRestartDialogOpen(false)}>
        <DialogTitle>{t('system.confirmRestart')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('system.confirmRestartMessage')}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestartDialogOpen(false)} disabled={actionLoading}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleRestart}
            color="warning"
            variant="contained"
            disabled={actionLoading}
            startIcon={actionLoading ? <CircularProgress size={16} /> : <RestartAltIcon />}
          >
            {t('system.restart')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de confirmation pour arrêter */}
      <Dialog open={shutdownDialogOpen} onClose={() => setShutdownDialogOpen(false)}>
        <DialogTitle>{t('system.confirmShutdown')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('system.confirmShutdownMessage')}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShutdownDialogOpen(false)} disabled={actionLoading}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleShutdown}
            color="error"
            variant="contained"
            disabled={actionLoading}
            startIcon={actionLoading ? <CircularProgress size={16} /> : <PowerSettingsNewIcon />}
          >
            {t('system.shutdown')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
