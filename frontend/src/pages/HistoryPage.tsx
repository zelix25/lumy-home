import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Chip,
  TextField,
  MenuItem,
  Grid,
  IconButton,
  Tooltip,
  Button,
  Stack,
} from '@mui/material';
import {
  historyService,
  HistoryItem,
  HistoryEventType,
  HistoryFilters,
  HistoryStats,
} from '../services/history.service';
import { useTranslation } from 'react-i18next';
import MotionIcon from '@mui/icons-material/DirectionsRun';
import LightIcon from '@mui/icons-material/Lightbulb';
import SunIcon from '@mui/icons-material/WbSunny';
import DoorIcon from '@mui/icons-material/DoorFront';
import TemperatureIcon from '@mui/icons-material/Thermostat';
import PowerIcon from '@mui/icons-material/Power';
import PowerOffIcon from '@mui/icons-material/PowerOff';
import AddIcon from '@mui/icons-material/Add';
import AutomationIcon from '@mui/icons-material/SmartToy';
import ButtonIcon from '@mui/icons-material/RadioButtonChecked';
import RefreshIcon from '@mui/icons-material/Refresh';
import FilterListIcon from '@mui/icons-material/FilterList';
import { useDevices } from '../hooks/useDevices';

const ITEMS_PER_PAGE = 50;

export default function HistoryPage() {
  const { t } = useTranslation();
  const { devices } = useDevices();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filters, setFilters] = useState<HistoryFilters>({
    limit: ITEMS_PER_PAGE,
    offset: 0,
  });
  const [showFilters, setShowFilters] = useState(false);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await historyService.getHistory(filters);
      setHistory(response.items);
      setTotal(response.total);
      setOffset(response.offset);
    } catch (err: any) {
      setError(err.message || t('history.errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const statsData = await historyService.getStats();
      setStats(statsData);
    } catch (err: any) {
      console.error('Erreur lors du chargement des statistiques:', err);
    }
  };

  useEffect(() => {
    fetchHistory();
    fetchStats();
  }, [filters]);

  const handleFilterChange = (key: keyof HistoryFilters, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      offset: 0, // Reset offset when filters change
    }));
    setOffset(0);
  };

  const handleLoadMore = () => {
    const newOffset = offset + ITEMS_PER_PAGE;
    setFilters((prev) => ({
      ...prev,
      offset: newOffset,
    }));
    setOffset(newOffset);
  };

  const handleResetFilters = () => {
    setFilters({
      limit: ITEMS_PER_PAGE,
      offset: 0,
    });
    setOffset(0);
  };

  const getEventIcon = (eventType: HistoryEventType, item?: HistoryItem) => {
    // Vérifier si c'est un événement de luminosité (illuminance)
    const isIlluminanceEvent = 
      eventType === HistoryEventType.STATE_CHANGED &&
      item?.data?.newState?.illuminance !== undefined;
    
    // Vérifier si c'est un événement de température
    const isTemperatureEvent = 
      eventType === HistoryEventType.STATE_CHANGED &&
      item?.data?.newState?.temperature !== undefined;

    switch (eventType) {
      case HistoryEventType.MOTION_DETECTED:
        return <MotionIcon />;
      case HistoryEventType.STATE_CHANGED:
        // Utiliser l'icône soleil pour les capteurs de luminosité
        if (isIlluminanceEvent) {
          return <SunIcon />;
        }
        // Utiliser l'icône thermomètre pour les capteurs de température
        if (isTemperatureEvent) {
          return <TemperatureIcon />;
        }
        // Utiliser l'icône ampoule pour les autres changements d'état
        return <LightIcon />;
      case HistoryEventType.CONTACT_CHANGED:
        return <DoorIcon />;
      case HistoryEventType.TEMPERATURE_CHANGED:
        return <TemperatureIcon />;
      case HistoryEventType.DEVICE_ONLINE:
        return <PowerIcon />;
      case HistoryEventType.DEVICE_OFFLINE:
        return <PowerOffIcon />;
      case HistoryEventType.AUTOMATION_EXECUTED:
        return <AutomationIcon />;
      case HistoryEventType.BUTTON_PRESSED:
        return <ButtonIcon />;
      case HistoryEventType.DEVICE_DISCOVERED:
        return <AddIcon />;
      default:
        return <PowerIcon />;
    }
  };

  const getEventColor = (eventType: HistoryEventType) => {
    switch (eventType) {
      case HistoryEventType.MOTION_DETECTED:
        return 'primary';
      case HistoryEventType.STATE_CHANGED:
        return 'warning';
      case HistoryEventType.CONTACT_CHANGED:
        return 'info';
      case HistoryEventType.TEMPERATURE_CHANGED:
        return 'error';
      case HistoryEventType.DEVICE_ONLINE:
        return 'success';
      case HistoryEventType.DEVICE_OFFLINE:
        return 'default';
      case HistoryEventType.AUTOMATION_EXECUTED:
        return 'secondary';
      case HistoryEventType.BUTTON_PRESSED:
        return 'primary';
      case HistoryEventType.DEVICE_DISCOVERED:
        return 'success';
      default:
        return 'default';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return t('history.justNow');
    } else if (diffMins < 60) {
      return t('history.minutesAgo', { count: diffMins });
    } else if (diffHours < 24) {
      return t('history.hoursAgo', { count: diffHours });
    } else if (diffDays < 7) {
      return t('history.daysAgo', { count: diffDays });
    } else {
      return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  };

  const uniqueRooms = Array.from(
    new Set(devices.map((d) => d.room).filter((r) => r && r !== 'Non défini')),
  );

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 500, mb: 1 }}>
            {t('history.title')}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {t('history.subtitle')}
          </Typography>
        </Box>
        <Box>
          <Tooltip title={t('history.refresh')}>
            <IconButton onClick={fetchHistory} sx={{ mr: 1 }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="outlined"
            startIcon={<FilterListIcon />}
            onClick={() => setShowFilters(!showFilters)}
          >
            {t('history.filters')}
          </Button>
        </Box>
      </Box>

      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {t('history.totalEvents')}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 500 }}>
                  {(stats.total ?? 0).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {t('history.recentActivity')}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 500 }}>
                  {(stats.recentActivity ?? 0).toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('history.last24Hours')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {t('history.mostActiveDevice')}
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 500 }}>
                  {stats.byDevice && Object.keys(stats.byDevice).length > 0
                    ? Object.entries(stats.byDevice)
                        .sort(([, a], [, b]) => b - a)[0][0]
                    : t('history.none')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {showFilters && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 500, mb: 2 }}>
              {t('history.filters')}
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  select
                  fullWidth
                  label={t('history.eventType')}
                  value={filters.eventType || ''}
                  onChange={(e) =>
                    handleFilterChange('eventType', e.target.value || undefined)
                  }
                >
                  <MenuItem value="">{t('history.allTypes')}</MenuItem>
                  <MenuItem value={HistoryEventType.MOTION_DETECTED}>
                    {t('history.motionDetected')}
                  </MenuItem>
                  <MenuItem value={HistoryEventType.STATE_CHANGED}>
                    {t('history.stateChanged')}
                  </MenuItem>
                  <MenuItem value={HistoryEventType.CONTACT_CHANGED}>
                    {t('history.contactChanged')}
                  </MenuItem>
                  <MenuItem value={HistoryEventType.TEMPERATURE_CHANGED}>
                    {t('history.temperatureChanged')}
                  </MenuItem>
                  <MenuItem value={HistoryEventType.AUTOMATION_EXECUTED}>
                    {t('history.automationExecuted')}
                  </MenuItem>
                  <MenuItem value={HistoryEventType.DEVICE_ONLINE}>
                    {t('history.deviceOnline')}
                  </MenuItem>
                  <MenuItem value={HistoryEventType.DEVICE_OFFLINE}>
                    {t('history.deviceOffline')}
                  </MenuItem>
                  <MenuItem value={HistoryEventType.DEVICE_DISCOVERED}>
                    {t('history.deviceDiscovered')}
                  </MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  select
                  fullWidth
                  label={t('history.device')}
                  value={filters.deviceId || ''}
                  onChange={(e) =>
                    handleFilterChange('deviceId', e.target.value || undefined)
                  }
                >
                  <MenuItem value="">{t('history.allDevices')}</MenuItem>
                  {devices.map((device) => (
                    <MenuItem key={device.ieeeAddress} value={device.ieeeAddress}>
                      {device.friendlyName || device.ieeeAddress}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  select
                  fullWidth
                  label={t('history.room')}
                  value={filters.room || ''}
                  onChange={(e) =>
                    handleFilterChange('room', e.target.value || undefined)
                  }
                >
                  <MenuItem value="">{t('history.allRooms')}</MenuItem>
                  {uniqueRooms.map((room) => (
                    <MenuItem key={room} value={room || ''}>
                      {room}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', height: '100%' }}>
                  <Button variant="outlined" onClick={handleResetFilters} fullWidth>
                    {t('history.resetFilters')}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading && history.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : history.length === 0 ? (
        <Card>
          <CardContent>
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {t('history.noHistoryFound')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('history.noHistoryFoundHint')}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent>
              <Box sx={{ position: 'relative' }}>
                {history.map((item, index) => (
                  <Box
                    key={item.id}
                    sx={{
                      display: 'flex',
                      position: 'relative',
                      pb: index < history.length - 1 ? 3 : 0,
                    }}
                  >
                    {/* Timeline line */}
                    {index < history.length - 1 && (
                      <Box
                        sx={{
                          position: 'absolute',
                          left: '20px',
                          top: '48px',
                          bottom: 0,
                          width: '2px',
                          backgroundColor: 'rgba(0,0,0,0.08)',
                        }}
                      />
                    )}
                    
                    {/* Icon */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: (() => {
                          const color = getEventColor(item.eventType);
                          if (color === 'primary') return 'rgba(25, 118, 210, 0.1)';
                          if (color === 'success') return 'rgba(46, 125, 50, 0.1)';
                          if (color === 'warning') return 'rgba(237, 108, 2, 0.1)';
                          if (color === 'error') return 'rgba(211, 47, 47, 0.1)';
                          if (color === 'info') return 'rgba(2, 136, 209, 0.1)';
                          if (color === 'secondary') return 'rgba(156, 39, 176, 0.1)';
                          return 'rgba(0,0,0,0.08)';
                        })(),
                        color: (() => {
                          const color = getEventColor(item.eventType);
                          if (color === 'primary') return '#1976d2';
                          if (color === 'success') return '#2e7d32';
                          if (color === 'warning') return '#ed6c02';
                          if (color === 'error') return '#d32f2f';
                          if (color === 'info') return '#0288d1';
                          if (color === 'secondary') return '#9c27b0';
                          return '#666';
                        })(),
                        mr: 2,
                        flexShrink: 0,
                      }}
                    >
                      {getEventIcon(item.eventType, item)}
                    </Box>

                    {/* Content */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1 }}>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {item.description}
                          </Typography>
                          {item.room && (
                            <Chip
                              label={item.room}
                              size="small"
                              sx={{
                                backgroundColor: 'rgba(134, 166, 160, 0.1)',
                                color: '#86A6A0',
                                fontWeight: 400,
                              }}
                            />
                          )}
                        </Stack>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ ml: 2, flexShrink: 0 }}
                        >
                          {formatTimestamp(item.timestamp)}
                        </Typography>
                      </Box>
                      <Box>
                        {item.deviceName && (
                          <Typography variant="caption" color="text.secondary">
                            {t('history.device')}: {item.deviceName}
                          </Typography>
                        )}
                        {item.automationName && (
                          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                            • {t('history.automation')}: {item.automationName}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>

          {offset + ITEMS_PER_PAGE < total && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Button variant="outlined" onClick={handleLoadMore}>
                {t('history.loadMore')} ({total - offset - ITEMS_PER_PAGE} {t('history.remaining')})
              </Button>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
