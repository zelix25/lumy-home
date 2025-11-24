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

export default function DevicesPage() {
  const { devices, loading, error, refetch } = useDevices();
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
        message: 'Erreur lors du démarrage de la détection',
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
        message: 'Détection d\'appareils arrêtée',
      });
    } catch (error) {
      console.error('Erreur lors de l\'arrêt de la détection:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de l\'arrêt de la détection',
      });
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
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
    const matchesSearch =
      device.friendlyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (device.room && device.room.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = selectedType === 'all' || device.type === selectedType;
    return matchesSearch && matchesType;
  });

  const deviceTypes = [
    { value: 'all', label: 'Tous' },
    { value: 'light', label: 'Ampoules' },
    { value: 'switch', label: 'Interrupteurs' },
    { value: 'sensor', label: 'Capteurs' },
    { value: 'plug', label: 'Prises' },
    { value: 'motion', label: 'Mouvement' },
    { value: 'temperature', label: 'Température' },
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
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, mb: 1 }}>
            Appareils
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Gérez tous vos appareils Zigbee connectés à votre maison.
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
                Arrêter la détection
              </Button>
              <Button
                variant="contained"
                disabled
                sx={{ minWidth: 180 }}
              >
                Détection active ({formatTime(timeRemaining)})
              </Button>
            </>
          ) : (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleStartDiscovery}
              sx={{ minWidth: 200 }}
            >
              Démarrer la détection (4 min)
            </Button>
          )}
        </Box>
      </Box>

      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Rechercher un appareil ou une pièce..."
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
              ? 'Aucun appareil ne correspond à votre recherche'
              : 'Aucun appareil détecté'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {searchTerm || selectedType !== 'all'
              ? 'Essayez de modifier vos critères de recherche'
              : 'Les appareils Zigbee seront détectés automatiquement une fois connectés.'}
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {filteredDevices.map((device) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={device.ieeeAddress}>
              <DeviceCard device={device} onToggle={handleToggle} />
            </Grid>
          ))}
        </Grid>
      )}

      {devices.length > 0 && (
        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {filteredDevices.length} appareil{filteredDevices.length > 1 ? 's' : ''} affiché{filteredDevices.length > 1 ? 's' : ''} sur {devices.length}
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
