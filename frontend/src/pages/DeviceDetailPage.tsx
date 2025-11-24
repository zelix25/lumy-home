import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Slider,
  Switch,
  FormControlLabel,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Divider,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import { devicesService, Device } from '../services/devices.service';
import { useWebSocket } from '../hooks/useWebSocket';

export default function DeviceDetailPage() {
  const { ieeeAddress } = useParams<{ ieeeAddress: string }>();
  const navigate = useNavigate();
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [friendlyName, setFriendlyName] = useState('');
  const [room, setRoom] = useState('');
  const [brightness, setBrightness] = useState(100);
  const [isOn, setIsOn] = useState(false);
  const { isConnected, socket } = useWebSocket();

  useEffect(() => {
    if (!ieeeAddress) return;

    const fetchDevice = async () => {
      try {
        setLoading(true);
        const data = await devicesService.getDevice(ieeeAddress);
        setDevice(data);
        setFriendlyName(data.friendlyName);
        setRoom(data.room || '');
        setIsOn(data.state?.state === 'ON' || data.state?.state === true);
        setBrightness(
          data.state?.brightness
            ? Math.round((data.state.brightness / 255) * 100)
            : 100,
        );
      } catch (err) {
        setError('Impossible de charger les détails de l\'appareil');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDevice();
  }, [ieeeAddress]);

  // Écouter les mises à jour en temps réel
  useEffect(() => {
    if (!isConnected || !ieeeAddress) return;

    const handleDeviceState = (data: {
      ieeeAddress: string;
      friendlyName: string;
      state: Record<string, any>;
    }) => {
      if (data.ieeeAddress === ieeeAddress) {
        setIsOn(data.state?.state === 'ON' || data.state?.state === true);
        if (data.state?.brightness !== undefined) {
          setBrightness(Math.round((data.state.brightness / 255) * 100));
        }
        setDevice((prev) => (prev ? { ...prev, state: data.state } : null));
      }
    };

    socket.on('device:state', handleDeviceState);

    return () => {
      socket.off('device:state', handleDeviceState);
    };
  }, [isConnected, ieeeAddress, socket]);

  const handleSaveName = async () => {
    if (!ieeeAddress) return;
    try {
      const updated = await devicesService.updateFriendlyName(ieeeAddress, friendlyName);
      setDevice(updated);
    } catch (err) {
      console.error('Erreur lors de la mise à jour du nom:', err);
    }
  };

  const handleSaveRoom = async () => {
    if (!ieeeAddress) return;
    try {
      const updated = await devicesService.updateRoom(ieeeAddress, room);
      setDevice(updated);
    } catch (err) {
      console.error('Erreur lors de la mise à jour de la pièce:', err);
    }
  };

  const handleToggle = async (checked: boolean) => {
    if (!ieeeAddress) return;
    setIsOn(checked);
    try {
      await devicesService.sendCommand(ieeeAddress, {
        state: checked ? 'ON' : 'OFF',
      });
    } catch (err) {
      console.error('Erreur lors de la commande:', err);
      setIsOn(!checked); // Revert on error
    }
  };

  const handleBrightnessChange = async (_: Event, value: number | number[]) => {
    if (!ieeeAddress) return;
    const newBrightness = Array.isArray(value) ? value[0] : value;
    setBrightness(newBrightness);
    const brightnessValue = Math.round((newBrightness / 100) * 255);
    try {
      await devicesService.sendCommand(ieeeAddress, {
        state: 'ON',
        brightness: brightnessValue,
      });
    } catch (err) {
      console.error('Erreur lors de la commande:', err);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !device) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error || 'Appareil non trouvé'}
        </Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/appareils')}>
          Retour aux appareils
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
        <IconButton onClick={() => navigate('/appareils')} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          {device.friendlyName}
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Informations
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Box sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  label="Nom de l'appareil"
                  value={friendlyName}
                  onChange={(e) => setFriendlyName(e.target.value)}
                  sx={{ mb: 1 }}
                />
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={handleSaveName}
                  size="small"
                >
                  Enregistrer le nom
                </Button>
              </Box>

              <Box>
                <TextField
                  fullWidth
                  label="Pièce"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  placeholder="Ex: Salon, Chambre, Cuisine..."
                  sx={{ mb: 1 }}
                />
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={handleSaveRoom}
                  size="small"
                >
                  Enregistrer la pièce
                </Button>
              </Box>
            </CardContent>
          </Card>

          {device.type === 'light' && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                  Contrôles
                </Typography>
                <Divider sx={{ mb: 3 }} />

                <Box sx={{ mb: 3 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={isOn}
                        onChange={(e) => handleToggle(e.target.checked)}
                        disabled={device.status !== 'online'}
                        size="large"
                      />
                    }
                    label={isOn ? 'Allumé' : 'Éteint'}
                  />
                </Box>

                <Box>
                  <Typography gutterBottom>Luminosité: {brightness}%</Typography>
                  <Slider
                    value={brightness}
                    onChange={handleBrightnessChange}
                    min={0}
                    max={100}
                    step={1}
                    disabled={device.status !== 'online' || !isOn}
                    sx={{ mb: 2 }}
                  />
                </Box>
              </CardContent>
            </Card>
          )}

          {(device.type === 'switch' || device.type === 'plug') && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                  Contrôles
                </Typography>
                <Divider sx={{ mb: 3 }} />

                <FormControlLabel
                  control={
                    <Switch
                      checked={isOn}
                      onChange={(e) => handleToggle(e.target.checked)}
                      disabled={device.status !== 'online'}
                      size="large"
                    />
                  }
                  label={isOn ? 'Activé' : 'Désactivé'}
                />
              </CardContent>
            </Card>
          )}
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                État
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Box sx={{ mb: 2 }}>
                <Chip
                  label={device.status === 'online' ? 'En ligne' : 'Hors ligne'}
                  color={device.status === 'online' ? 'success' : 'default'}
                  sx={{ mb: 1 }}
                />
                <Chip
                  label={device.type}
                  sx={{ ml: 1 }}
                />
              </Box>

              {device.state && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Informations détaillées
                  </Typography>
                  {Object.entries(device.state).map(([key, value]) => (
                    <Typography key={key} variant="body2" color="text.secondary">
                      {key}: {String(value)}
                    </Typography>
                  ))}
                </Box>
              )}

              {device.manufacturer && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Fabricant
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {device.manufacturer}
                  </Typography>
                </Box>
              )}

              {device.model && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Modèle
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {device.model}
                  </Typography>
                </Box>
              )}

              {!device.isSupported && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  {device.unsupportedReason || "Cet appareil n'est pas entièrement supporté"}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

