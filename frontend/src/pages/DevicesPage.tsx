import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Button,
  Snackbar,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import StopIcon from '@mui/icons-material/Stop';
import { useDevices } from '../hooks/useDevices';
import DeviceCard from '../components/DeviceCard';
import { devicesService, Device } from '../services/devices.service';
import i18n from '@/i18n';

export default function DevicesPage() {
  const { devices, loading, error } = useDevices();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [discoveryActive, setDiscoveryActive] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({
    open: false,
    message: '',
  });

  const handleToggle = async (device: Device, state: boolean) => {
    try {
      const command = device.type === 'light' 
        ? { state: state ? 'ON' : 'OFF' }
        : { state: state ? 'ON' : 'OFF' };
      
      await devicesService.sendCommand(device.ieeeAddress, command);
    } catch (error) {
      console.error('Erreur lors de la commande:', error);
    }
  };

  const handleCoverPositionChange = async (device: Device, position: number) => {
    try {
      // Pour Zigbee2MQTT, la position est envoyée comme un nombre de 0 à 100
      // où 0 = fermé, 100 = ouvert
      const command = { position };
      await devicesService.sendCommand(device.ieeeAddress, command);
    } catch (error) {
      console.error('Erreur lors du changement de position du volet:', error);
    }
  };

  const handleStartDiscovery = async () => {
    try {
      const duration = 254; // 254 secondes (maximum Zigbee2MQTT, environ 4 minutes)
      const result = await devicesService.startDiscovery(duration);
      setDiscoveryActive(true);
      setTimeRemaining(duration);
      setSnackbar({
        open: true,
        message: result.message,
      });
    } catch (error) {
      console.error('Erreur lors du démarrage de la détection:', error);
      setSnackbar({
        open: true,
        message: i18n.t('devices.errorStartingDiscovery'),
      });
    }
  };

  const handleStopDiscovery = async () => {
    try {
      await devicesService.stopDiscovery();
      setDiscoveryActive(false);
      setTimeRemaining(0);
      setSnackbar({
        open: true,
        message: i18n.t('devices.discoveryStopped'),
      });
    } catch (error) {
      console.error('Erreur lors de l\'arrêt de la détection:', error);
      setSnackbar({
        open: true,
        message: i18n.t('devices.errorStoppingDiscovery'),
      });
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  // Vérifier l'état de la découverte au chargement de la page
  useEffect(() => {
    const checkDiscoveryStatus = async () => {
      try {
        const status = await devicesService.getDiscoveryStatus();
        if (status.active) {
          setDiscoveryActive(true);
          // Si on a un temps restant, l'utiliser, sinon utiliser une valeur par défaut
          if (status.timeRemaining !== undefined && status.timeRemaining > 0) {
            setTimeRemaining(status.timeRemaining);
          } else {
            // Si on ne connaît pas le temps exact, on met une valeur par défaut
            // et on laisse le timer continuer
            setTimeRemaining(254);
          }
        }
      } catch (error) {
        console.error('Erreur lors de la vérification de l\'état de la découverte:', error);
      }
    };

    checkDiscoveryStatus();
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (discoveryActive && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            setDiscoveryActive(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [discoveryActive, timeRemaining]);

  const filteredDevices = devices.filter((device) => {
    // Masquer le Coordinator
    if (device.friendlyName && device.friendlyName.toLowerCase() === 'coordinator') {
      return false;
    }
    
    const matchesSearch =
      device.friendlyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (device.room && device.room.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = selectedType === 'all' || device.type === selectedType;
    return matchesSearch && matchesType;
  });

  const deviceTypes = [
    { value: 'all', label: i18n.t('devices.all') },
    { value: 'light', label: i18n.t('devices.light') },
    { value: 'switch', label: i18n.t('devices.switch') },
    { value: 'energy', label: i18n.t('devices.energy') },
    { value: 'sensor', label: i18n.t('devices.sensor') },
    { value: 'plug', label: i18n.t('devices.plug') },
    { value: 'motion', label: i18n.t('devices.motion') },
    { value: 'temperature', label: i18n.t('devices.temperature') },
    { value: 'pressure', label: i18n.t('devices.pressure') },
    { value: 'illuminance', label: i18n.t('devices.illuminance') },
    { value: 'contact', label: i18n.t('devices.contact') },
    { value: 'cover', label: i18n.t('devices.cover') },
    { value: 'other', label: i18n.t('devices.other') },
  ];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 500, mb: 1 }}>
            {i18n.t('devices.title')}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {i18n.t('devices.subtitle')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {discoveryActive ? (
            <>
              <Button
                variant="outlined"
                startIcon={<StopIcon />}
                onClick={handleStopDiscovery}
                color="error"
                sx={{ minWidth: 180 }}
              >
                {i18n.t('devices.stopDiscovery')}
              </Button>
              <Button
                variant="contained"
                disabled
                sx={{ minWidth: 180 }}
              >
                {i18n.t('devices.discoveryActive')} ({formatTime(timeRemaining)})
              </Button>
            </>
          ) : (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleStartDiscovery}
              sx={{ minWidth: 200 }}
            >
              {i18n.t('devices.startDiscovery')}
            </Button>
          )}
        </Box>
      </Box>

      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder={i18n.t('devices.searchPlaceholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />

        <Tabs
          value={selectedType}
          onChange={(_, newValue) => setSelectedType(newValue)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          {deviceTypes.map((type) => (
            <Tab key={type.value} label={type.label} value={type.value} />
          ))}
        </Tabs>
      </Box>

      {filteredDevices.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {searchTerm || selectedType !== 'all'
              ? i18n.t('devices.noDevicesFound')
              : i18n.t('devices.noDevicesDetected')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {searchTerm || selectedType !== 'all'
              ? i18n.t('devices.tryModifyingSearchCriteria')
              : i18n.t('devices.devicesWillBeDetectedAutomaticallyOnceConnected')}
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {filteredDevices.map((device) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={device.ieeeAddress}>
              <DeviceCard 
                device={device} 
                onToggle={handleToggle}
                onCoverPositionChange={handleCoverPositionChange}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {devices.length > 0 && (
        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {filteredDevices.length} appareil{filteredDevices.length > 1 ? 's' : ''} affiché{filteredDevices.length > 1 ? 's' : ''} sur {devices.length-1}
          </Typography>
        </Box>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />
    </Box>
  );
}
