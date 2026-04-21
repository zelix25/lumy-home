import { useState, useEffect, useMemo } from 'react';
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
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import RefreshIcon from '@mui/icons-material/Refresh';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
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

/** Aligné sur lumy-updater `getComposeServiceKey` : clé compose → nom de conteneur affiché côté santé Docker. */
function composeServiceKeyToContainerName(composeKey: string): string {
  switch (composeKey) {
    case 'backend':
      return 'lumy-backend';
    case 'frontend':
      return 'lumy-frontend';
    case 'agent':
      return 'lumy-agent';
    default:
      return composeKey;
  }
}

export default function SystemPage() {
  const { t } = useTranslation();
  const ADVANCED_MODE_STORAGE_KEY = 'lumy_settings_advanced_mode';
  const [loading, setLoading] = useState(true);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [updaterStatus, setUpdaterStatus] = useState<UpdaterStatus | null>(null);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [restartDialogOpen, setRestartDialogOpen] = useState(false);
  const [shutdownDialogOpen, setShutdownDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [applyingUpdates, setApplyingUpdates] = useState(false);
  const [hasUpdates, setHasUpdates] = useState(false);
  const [lastCheckResult, setLastCheckResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [boxId, setBoxId] = useState<string | null>(null);
  const [selectedLogContainer, setSelectedLogContainer] = useState<string>('');
  const [logTail, setLogTail] = useState<number>(200);
  const [containerLogs, setContainerLogs] = useState<string>('');
  const [logsLoading, setLogsLoading] = useState(false);
  const [advancedMode, setAdvancedMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(ADVANCED_MODE_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    loadSystemData();
    // Rafraîchir toutes les 30 secondes
    const interval = setInterval(loadSystemData, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const syncAdvancedMode = () => {
      try {
        setAdvancedMode(localStorage.getItem(ADVANCED_MODE_STORAGE_KEY) === 'true');
      } catch {
        setAdvancedMode(false);
      }
    };
    window.addEventListener('focus', syncAdvancedMode);
    window.addEventListener('storage', syncAdvancedMode);
    return () => {
      window.removeEventListener('focus', syncAdvancedMode);
      window.removeEventListener('storage', syncAdvancedMode);
    };
  }, []);

  useEffect(() => {
    if (!selectedLogContainer && services.length > 0) {
      setSelectedLogContainer(services[0].name);
    }
  }, [services, selectedLogContainer]);

  const loadSystemData = async () => {
    try {
      setError(null);
      const [info, status, notifs, servicesData, boxIdData] = await Promise.allSettled([
        settingsService.getSystemInfo(),
        updaterService.getStatus().catch(() => null),
        systemHealthService.getNotifications(),
        getServicesStatus(),
        settingsService.getBoxId().catch(() => null),
      ]);

      if (info.status === 'fulfilled') {
        setSystemInfo(info.value);
      }

      if (status.status === 'fulfilled' && status.value) {
        setUpdaterStatus(status.value);
      }

      // Vérifier s'il y a des mises à jour disponibles
      try {
        const lastCheck = await updaterService.getLastCheck();
        if (lastCheck && 'hasUpdates' in lastCheck) {
          setHasUpdates(lastCheck.hasUpdates || false);
          setLastCheckResult(lastCheck);
        }
      } catch {
        // Ignorer les erreurs de récupération du dernier check
      }

      if (notifs.status === 'fulfilled') {
        setNotifications(notifs.value);
      }

      if (servicesData.status === 'fulfilled') {
        setServices(servicesData.value);
      }

      if (boxIdData.status === 'fulfilled' && boxIdData.value?.boxId) {
        setBoxId(boxIdData.value.boxId);
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

  const handleCheckUpdates = async () => {
    setCheckingUpdates(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await updaterService.checkForUpdates();
      
      if (result.hasUpdates) {
        const servicesWithUpdates = result.updates
          ?.filter((u) => u.hasUpdate)
          .map((u) => u.service) || [];
        const servicesList = servicesWithUpdates.join(', ');
        setSuccess(
          `${t('system.updatesAvailable')} ${servicesList}`,
        );
        setHasUpdates(true);
        setLastCheckResult(result);
      } else {
        setSuccess(t('system.noUpdatesAvailable'));
        setHasUpdates(false);
        setLastCheckResult(result);
      }
      
      // Recharger les données système pour mettre à jour le statut
      await loadSystemData();
    } catch (err: any) {
      setError(err.message || t('system.errorCheckUpdates'));
    } finally {
      setCheckingUpdates(false);
    }
  };

  const handleApplyUpdates = async () => {
    setApplyingUpdates(true);
    setError(null);
    setSuccess(null);
    try {
      // Récupérer la liste des services à mettre à jour
      const servicesToUpdate = lastCheckResult?.updates
        ?.filter((u: any) => u.hasUpdate)
        .map((u: any) => u.service) || [];

      const result = await updaterService.applyUpdate(servicesToUpdate);
      
      if (result.ok) {
        const updatedServices = result.updated.join(', ');
        setSuccess(
          `${t('system.updatesApplied')} ${updatedServices}`,
        );
        setHasUpdates(false);
        setLastCheckResult(null);
        
        // Recharger les données système après la mise à jour
        setTimeout(() => {
          loadSystemData();
        }, 2000);
      } else {
        setError(t('system.errorApplyUpdates'));
      }
    } catch (err: any) {
      setError(err.message || t('system.errorApplyUpdates'));
    } finally {
      setApplyingUpdates(false);
    }
  };

  const handleCopyBoxId = async () => {
    if (!boxId) return;

    try {
      await navigator.clipboard.writeText(boxId);
      setSuccess(t('system.boxIdCopied'));
      setError(null);
    } catch {
      setError(t('system.boxIdCopyError'));
      setSuccess(null);
    }
  };

  const handleLoadLogs = async () => {
    if (!selectedLogContainer) return;
    setLogsLoading(true);
    try {
      const response = await apiService.get<{ containerName: string; tail: number; logs: string }>(
        `/system/logs/${encodeURIComponent(selectedLogContainer)}?tail=${logTail}`,
      );
      setContainerLogs(response?.logs || '');
    } catch (err: any) {
      setError(err.message || 'Impossible de charger les logs Docker');
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedLogContainer) return;
    handleLoadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLogContainer]);

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

  /** RAM fournie par l'API en Go (backend), pas en octets — arrondi supérieur pour l'affichage. */
  const formatRamGb = (gigabytes: number) =>
    t('system.ramSizeGigabytes', { value: Math.ceil(Math.max(0, gigabytes)) });

  const servicesWithPendingUpdates = useMemo(() => {
    const updates = lastCheckResult?.updates;
    if (!updates?.length) return new Set<string>();
    const set = new Set<string>();
    for (const u of updates) {
      if (u.hasUpdate) {
        set.add(composeServiceKeyToContainerName(u.service));
      }
    }
    return set;
  }, [lastCheckResult]);

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
        <Grid item xs={12} md={3}>
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
                        {formatRamGb(systemInfo.ram)}
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

        {/* Identifiant de box */}
        <Grid item xs={12} md>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 500, mb: 2 }}>
                {t('system.boxIdTitle')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('system.boxIdDescription')}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
                <Typography variant="body1" sx={{ fontWeight: 700, letterSpacing: 1 }}>
                  {boxId ?? t('system.boxIdUnavailable')}
                </Typography>
                <Tooltip title={t('system.copyBoxId')}>
                  <span>
                    <IconButton
                      size="small"
                      onClick={handleCopyBoxId}
                      disabled={!boxId}
                      aria-label={t('system.copyBoxId')}
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Statut de l'updater */}
        <Grid item xs={12} md>
          <Card>
            <CardContent>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 2,
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 500 }}>
                  {t('system.updaterStatus')}
                </Typography>
                <Stack direction="row" spacing={1}>
                  {hasUpdates && (
                    <Button
                      variant="contained"
                      color="primary"
                      size="small"
                      startIcon={applyingUpdates ? <CircularProgress size={16} /> : <SystemUpdateIcon />}
                      onClick={handleApplyUpdates}
                      disabled={applyingUpdates || checkingUpdates}
                    >
                      {t('system.applyUpdates')}
                    </Button>
                  )}
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={checkingUpdates ? <CircularProgress size={16} /> : <RefreshIcon />}
                    onClick={handleCheckUpdates}
                    disabled={checkingUpdates || applyingUpdates || !updaterStatus}
                  >
                    {t('system.checkUpdates')}
                  </Button>
                </Stack>
              </Box>
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
                  {/*<Box>
                    <Typography variant="body2" color="text.secondary">
                      {t('system.services')}
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {updaterStatus.services.join(', ')}
                    </Typography>
                  </Box>*/}
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
                        <Box sx={{ minWidth: 0, pr: 1 }}>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              flexWrap: 'wrap',
                              mb: service.image ? 0.5 : 0,
                            }}
                          >
                            <Typography variant="body1" sx={{ fontWeight: 500 }}>
                              {service.name}
                            </Typography>
                            {servicesWithPendingUpdates.has(service.name) && (
                              <Chip
                                label={t('system.updatePendingBadge')}
                                size="small"
                                sx={{
                                  backgroundColor: '#FF9800',
                                  color: '#fff',
                                  fontWeight: 600,
                                  fontSize: '0.7rem',
                                  height: 22,
                                  '& .MuiChip-label': { px: 1 },
                                }}
                              />
                            )}
                          </Box>
                          {service.image && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              {service.image}
                            </Typography>
                          )}
                        </Box>
                        <Chip
                          label={getStatusLabel(service.status)}
                          color={getStatusColor(service.status) as any}
                          size="small"
                          sx={{
                            ...(service.status === 'running' && {
                              backgroundColor: '#4caf50',
                              color: '#ffffff',
                              '& .MuiChip-label': {
                                color: '#ffffff',
                              },
                            }),
                          }}
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

        {/* Logs Docker (mode avancé) */}
        {advancedMode && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 2,
                    gap: 2,
                    flexWrap: 'wrap',
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 500 }}>
                    Logs Docker
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <FormControl size="small" sx={{ minWidth: 220 }}>
                      <InputLabel id="container-select-label">Conteneur</InputLabel>
                      <Select
                        labelId="container-select-label"
                        label="Conteneur"
                        value={selectedLogContainer}
                        onChange={(e) => setSelectedLogContainer(e.target.value)}
                      >
                        {services.map((service) => (
                          <MenuItem key={service.name} value={service.name}>
                            {service.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <TextField
                      size="small"
                      label="Lignes"
                      type="number"
                      value={logTail}
                      onChange={(e) =>
                        setLogTail(Math.min(5000, Math.max(1, Number(e.target.value) || 200)))
                      }
                      sx={{ width: 110 }}
                      inputProps={{ min: 1, max: 5000 }}
                    />
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={logsLoading ? <CircularProgress size={16} /> : <RefreshIcon />}
                      onClick={handleLoadLogs}
                      disabled={logsLoading || !selectedLogContainer}
                    >
                      Rafraîchir
                    </Button>
                  </Stack>
                </Box>

                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    backgroundColor: '#111',
                    color: '#e0e0e0',
                    maxHeight: 420,
                    overflow: 'auto',
                    fontFamily: 'monospace',
                    fontSize: '0.8rem',
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.4,
                  }}
                >
                  {containerLogs || 'Aucun log chargé.'}
                </Paper>
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
