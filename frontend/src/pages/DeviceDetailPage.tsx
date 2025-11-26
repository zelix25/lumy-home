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

              {device.state && Object.keys(device.state).length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom sx={{ mb: 2 }}>
                    Informations détaillées
                  </Typography>
                  
                  {/* Données des capteurs avec icônes */}
                  {device.state.temperature !== undefined && (
                    <Box sx={{ mb: 1.5, p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
                      <Typography variant="body2" fontWeight={600} gutterBottom>
                        🌡️ Température
                      </Typography>
                      <Typography variant="h6" color="primary.main">
                        {device.state.temperature}°C
                      </Typography>
                    </Box>
                  )}
                  
                  {device.state.humidity !== undefined && (
                    <Box sx={{ mb: 1.5, p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
                      <Typography variant="body2" fontWeight={600} gutterBottom>
                        💧 Humidité
                      </Typography>
                      <Typography variant="h6" color="primary.main">
                        {device.state.humidity}%
                      </Typography>
                    </Box>
                  )}
                  
                  {device.state.pressure !== undefined && (
                    <Box sx={{ mb: 1.5, p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
                      <Typography variant="body2" fontWeight={600} gutterBottom>
                        📊 Pression
                      </Typography>
                      <Typography variant="h6" color="primary.main">
                        {device.state.pressure} hPa
                      </Typography>
                    </Box>
                  )}
                  
                  {device.state.illuminance !== undefined && (
                    <Box sx={{ mb: 1.5, p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
                      <Typography variant="body2" fontWeight={600} gutterBottom>
                        ☀️ Luminosité ambiante
                      </Typography>
                      <Typography variant="h6" color="primary.main">
                        {device.state.illuminance} lux
                      </Typography>
                    </Box>
                  )}
                  
                  {device.state.occupancy !== undefined && (
                    <Box sx={{ mb: 1.5, p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
                      <Typography variant="body2" fontWeight={600} gutterBottom>
                        👤 Présence
                      </Typography>
                      <Typography variant="h6" color={device.state.occupancy ? 'success.main' : 'text.secondary'}>
                        {device.state.occupancy ? 'Détectée' : 'Aucune'}
                      </Typography>
                    </Box>
                  )}
                  
                  {device.state.contact !== undefined && (
                    <Box sx={{ mb: 1.5, p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
                      <Typography variant="body2" fontWeight={600} gutterBottom>
                        🚪 Contact
                      </Typography>
                      <Typography variant="h6" color={device.state.contact ? 'success.main' : 'error.main'}>
                        {device.state.contact ? 'Fermé' : 'Ouvert'}
                      </Typography>
                    </Box>
                  )}
                  
                  {device.state.water_leak !== undefined && (
                    <Box sx={{ mb: 1.5, p: 1.5, bgcolor: device.state.water_leak ? 'error.light' : 'background.default', borderRadius: 1 }}>
                      <Typography variant="body2" fontWeight={600} gutterBottom>
                        💦 Fuite d'eau
                      </Typography>
                      <Typography variant="h6" color={device.state.water_leak ? 'error.main' : 'success.main'}>
                        {device.state.water_leak ? '⚠️ Détectée' : 'Aucune'}
                      </Typography>
                    </Box>
                  )}
                  
                  {device.state.smoke !== undefined && (
                    <Box sx={{ mb: 1.5, p: 1.5, bgcolor: device.state.smoke ? 'error.light' : 'background.default', borderRadius: 1 }}>
                      <Typography variant="body2" fontWeight={600} gutterBottom>
                        🔥 Fumée
                      </Typography>
                      <Typography variant="h6" color={device.state.smoke ? 'error.main' : 'success.main'}>
                        {device.state.smoke ? '⚠️ Détectée' : 'Aucune'}
                      </Typography>
                    </Box>
                  )}
                  
                  {/* Informations système */}
                  {device.state.battery !== undefined && (
                    <Box sx={{ mb: 1.5, p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
                      <Typography variant="body2" fontWeight={600} gutterBottom>
                        🔋 Batterie
                      </Typography>
                      <Typography variant="h6" color={device.state.battery < 20 ? 'error.main' : device.state.battery < 50 ? 'warning.main' : 'success.main'}>
                        {device.state.battery}%
                      </Typography>
                    </Box>
                  )}
                  
                  {device.state.voltage !== undefined && (
                    <Box sx={{ mb: 1.5, p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
                      <Typography variant="body2" fontWeight={600} gutterBottom>
                        ⚡ Tension
                      </Typography>
                      <Typography variant="h6" color="primary.main">
                        {device.state.voltage}V
                      </Typography>
                    </Box>
                  )}
                  
                  {device.state.linkquality !== undefined && (
                    <Box sx={{ mb: 1.5, p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
                      <Typography variant="body2" fontWeight={600} gutterBottom>
                        📶 Qualité du signal
                      </Typography>
                      <Typography variant="h6" color={device.state.linkquality < 50 ? 'error.main' : device.state.linkquality < 100 ? 'warning.main' : 'success.main'}>
                        {device.state.linkquality}
                      </Typography>
                    </Box>
                  )}
                  
                  {/* Autres données */}
                  {Object.entries(device.state)
                    .filter(([key]) => 
                      !['temperature', 'humidity', 'pressure', 'illuminance', 'occupancy', 
                        'contact', 'water_leak', 'smoke', 'battery', 'voltage', 'linkquality', 
                        'state', 'brightness', 'color_temp'].includes(key)
                    )
                    .map(([key, value]) => (
                      <Box key={key} sx={{ mb: 1, p: 1, bgcolor: 'background.default', borderRadius: 1 }}>
                        <Typography variant="body2" fontWeight={600} gutterBottom>
                          {key}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {String(value)}
                        </Typography>
                      </Box>
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

