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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import DialogContentText from '@mui/material/DialogContentText';
import AddIcon from '@mui/icons-material/Add';
import { devicesService, Device } from '../services/devices.service';
import { roomsService, Room } from '../services/rooms.service';
import { useWebSocket } from '../hooks/useWebSocket';

const getDeviceTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    light: 'Ampoule',
    switch: 'Interrupteur',
    sensor: 'Capteur',
    plug: 'Prise',
    door: 'Porte',
    window: 'Fenêtre',
    temperature: 'Température',
    motion: 'Mouvement',
    button: 'Bouton',
    unknown: 'Inconnu',
  };
  return labels[type] || type;
};

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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [newRoomDialogOpen, setNewRoomDialogOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
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

  // Charger les pièces disponibles
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        setLoadingRooms(true);
        const roomsData = await roomsService.getAllRooms();
        setRooms(roomsData);
      } catch (error) {
        console.error('Erreur lors du chargement des pièces:', error);
      } finally {
        setLoadingRooms(false);
      }
    };

    fetchRooms();
  }, []);

  // Écouter les mises à jour en temps réel
  useEffect(() => {
    if (!isConnected || !ieeeAddress) return;

    const handleDeviceState = (data: unknown) => {
      const eventData = data as {
        ieeeAddress: string;
        friendlyName: string;
        state: Record<string, any>;
      };
      if (eventData.ieeeAddress === ieeeAddress) {
        setIsOn(eventData.state?.state === 'ON' || eventData.state?.state === true);
        if (eventData.state?.brightness !== undefined) {
          setBrightness(Math.round((eventData.state.brightness / 255) * 100));
        }
        setDevice((prev) => (prev ? { ...prev, state: eventData.state } : null));
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

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;
    try {
      const newRoom = await roomsService.createRoom(newRoomName.trim());
      setRooms((prev) => [...prev, newRoom].sort((a, b) => a.name.localeCompare(b.name)));
      setRoom(newRoom.name);
      setNewRoomDialogOpen(false);
      setNewRoomName('');
    } catch (err: any) {
      console.error('Erreur lors de la création de la pièce:', err);
      alert(err.message || 'Erreur lors de la création de la pièce');
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

  const handleDelete = async () => {
    if (!ieeeAddress) return;
    setDeleting(true);
    try {
      await devicesService.deleteDevice(ieeeAddress);
      setDeleteDialogOpen(false);
      // Rediriger vers la liste des appareils après suppression réussie
      navigate('/appareils');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression de l\'appareil');
      setDeleteDialogOpen(false);
    } finally {
      setDeleting(false);
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
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton onClick={() => navigate('/appareils')} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" sx={{ fontWeight: 500 }}>
            {device.friendlyName}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteIcon />}
          onClick={() => setDeleteDialogOpen(true)}
        >
          Supprimer
        </Button>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 500 }}>
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
                <FormControl fullWidth sx={{ mb: 1 }}>
                  <InputLabel id="room-select-label">Pièce</InputLabel>
                  <Select
                    labelId="room-select-label"
                    value={room}
                    label="Pièce"
                    onChange={(e) => setRoom(e.target.value)}
                    disabled={loadingRooms}
                  >
                    <MenuItem value="">
                      <em>Aucune pièce</em>
                    </MenuItem>
                    {rooms.map((roomOption) => (
                      <MenuItem key={roomOption.id} value={roomOption.name}>
                        {roomOption.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={() => setNewRoomDialogOpen(true)}
                    size="small"
                  >
                    Ajouter une pièce
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleSaveRoom}
                    size="small"
                    disabled={!room}
                  >
                    Enregistrer la pièce
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {device.type === 'light' && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 500 }}>
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
                        size="medium"
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
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 500 }}>
                  Contrôles
                </Typography>
                <Divider sx={{ mb: 3 }} />

                <FormControlLabel
                  control={
                    <Switch
                      checked={isOn}
                      onChange={(e) => handleToggle(e.target.checked)}
                      disabled={device.status !== 'online'}
                      size="medium"
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
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 500 }}>
                État
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Chip
                  label={device.status === 'online' ? 'En ligne' : 'Hors ligne'}
                  color={device.status === 'online' ? 'success' : 'default'}
                />
                <Chip
                  label={getDeviceTypeLabel(device.type)}
                />
              </Box>

              {device.state && Object.keys(device.state).length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom sx={{ mb: 2 }}>
                    Informations détaillées
                  </Typography>
                  
                  <Grid container spacing={1.5}>
                    {/* Données des capteurs avec icônes */}
                    {device.state.temperature !== undefined && (
                      <Grid item xs={6}>
                        <Box sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1, height: '100%' }}>
                          <Typography variant="body2" fontWeight={500} gutterBottom>
                            🌡️ Température
                          </Typography>
                          <Typography variant="h6" color="primary.main">
                            {typeof device.state.temperature === 'number' 
                              ? `${device.state.temperature.toFixed(1)}°C`
                              : `${device.state.temperature}°C`}
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                    
                    {device.state.humidity !== undefined && (
                      <Grid item xs={6}>
                        <Box sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1, height: '100%' }}>
                          <Typography variant="body2" fontWeight={500} gutterBottom>
                            💧 Humidité
                          </Typography>
                          <Typography variant="h6" color="primary.main">
                            {typeof device.state.humidity === 'number'
                              ? `${Math.round(device.state.humidity)}%`
                              : `${device.state.humidity}%`}
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                    
                    {device.state.pressure !== undefined && (
                      <Grid item xs={6}>
                        <Box sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1, height: '100%' }}>
                          <Typography variant="body2" fontWeight={500} gutterBottom>
                            📊 Pression
                          </Typography>
                          <Typography variant="h6" color="primary.main">
                            {typeof device.state.pressure === 'number'
                              ? `${Math.round(device.state.pressure)} hPa`
                              : `${device.state.pressure} hPa`}
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                    
                    {device.state.illuminance !== undefined && (
                      <Grid item xs={6}>
                        <Box sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1, height: '100%' }}>
                          <Typography variant="body2" fontWeight={500} gutterBottom>
                            ☀️ Luminosité ambiante
                          </Typography>
                          <Typography variant="h6" color="primary.main">
                            {typeof device.state.illuminance === 'number'
                              ? `${device.state.illuminance.toLocaleString()} lux`
                              : `${device.state.illuminance} lux`}
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                    
                    {(device.state.presence !== undefined || device.state.occupancy !== undefined) && (
                      <Grid item xs={6}>
                        <Box sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1, height: '100%' }}>
                          <Typography variant="body2" fontWeight={500} gutterBottom>
                            👤 Présence
                          </Typography>
                          <Typography variant="h6" color={(device.state.presence || device.state.occupancy) ? 'success.main' : 'text.secondary'}>
                            {(device.state.presence || device.state.occupancy) ? 'Détectée' : 'Aucune'}
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                    
                    {device.state.contact !== undefined && (
                      <Grid item xs={6}>
                        <Box sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1, height: '100%' }}>
                          <Typography variant="body2" fontWeight={500} gutterBottom>
                            🚪 Contact
                          </Typography>
                          <Typography variant="h6" color={device.state.contact ? 'success.main' : 'error.main'}>
                            {device.state.contact ? 'Fermé' : 'Ouvert'}
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                    
                    {device.state.water_leak !== undefined && (
                      <Grid item xs={6}>
                        <Box sx={{ p: 1.5, bgcolor: device.state.water_leak ? 'error.light' : 'background.default', borderRadius: 1, height: '100%' }}>
                          <Typography variant="body2" fontWeight={500} gutterBottom>
                            💦 Fuite d'eau
                          </Typography>
                          <Typography variant="h6" color={device.state.water_leak ? 'error.main' : 'success.main'}>
                            {device.state.water_leak ? '⚠️ Détectée' : 'Aucune'}
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                    
                    {device.state.smoke !== undefined && (
                      <Grid item xs={6}>
                        <Box sx={{ p: 1.5, bgcolor: device.state.smoke ? 'error.light' : 'background.default', borderRadius: 1, height: '100%' }}>
                          <Typography variant="body2" fontWeight={500} gutterBottom>
                            🔥 Fumée
                          </Typography>
                          <Typography variant="h6" color={device.state.smoke ? 'error.main' : 'success.main'}>
                            {device.state.smoke ? '⚠️ Détectée' : 'Aucune'}
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                    
                    {/* Informations système */}
                    {device.state.battery !== undefined && (
                      <Grid item xs={6}>
                        <Box sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1, height: '100%' }}>
                          <Typography variant="body2" fontWeight={500} gutterBottom>
                            🔋 Batterie
                          </Typography>
                          <Typography variant="h6" color={device.state.battery < 20 ? 'error.main' : device.state.battery < 50 ? 'warning.main' : 'success.main'}>
                            {typeof device.state.battery === 'number'
                              ? `${Math.round(device.state.battery)}%`
                              : `${device.state.battery}%`}
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                    
                    {device.state.voltage !== undefined && (
                      <Grid item xs={6}>
                        <Box sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1, height: '100%' }}>
                          <Typography variant="body2" fontWeight={500} gutterBottom>
                            ⚡ Tension
                          </Typography>
                          <Typography variant="h6" color="primary.main">
                            {typeof device.state.voltage === 'number'
                              ? `${(device.state.voltage / 1000).toFixed(2)}V`
                              : `${device.state.voltage}V`}
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                    
                    {device.state.linkquality !== undefined && (
                      <Grid item xs={6}>
                        <Box sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1, height: '100%' }}>
                          <Typography variant="body2" fontWeight={500} gutterBottom>
                            📶 Qualité du signal
                          </Typography>
                          <Typography variant="h6" color={device.state.linkquality < 50 ? 'error.main' : device.state.linkquality < 100 ? 'warning.main' : 'success.main'}>
                            {device.state.linkquality}
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                    
                    {/* Autres données */}
                    {Object.entries(device.state)
                      .filter(([key]) => 
                        !['temperature', 'humidity', 'pressure', 'illuminance', 'occupancy', 'presence',
                          'contact', 'water_leak', 'smoke', 'battery', 'voltage', 'linkquality', 
                          'state', 'brightness', 'color_temp'].includes(key)
                      )
                      .map(([key, value]) => (
                        <Grid item xs={6} key={key}>
                          <Box sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1, height: '100%' }}>
                            <Typography variant="body2" fontWeight={500} gutterBottom>
                              {key}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {String(value)}
                            </Typography>
                          </Box>
                        </Grid>
                      ))}
                  </Grid>
                </Box>
              )}

              {(device.manufacturer || device.model) && (
                <Box sx={{ mt: 2 }}>
                  <Grid container spacing={2}>
                    {device.manufacturer && (
                      <Grid item xs={6}>
                        <Typography variant="subtitle2" gutterBottom>
                          Fabricant
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {device.manufacturer}
                        </Typography>
                      </Grid>
                    )}
                    {device.model && (
                      <Grid item xs={6}>
                        <Typography variant="subtitle2" gutterBottom>
                          Modèle
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {device.model}
                        </Typography>
                      </Grid>
                    )}
                  </Grid>
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

      {/* Dialog pour créer une nouvelle pièce */}
      <Dialog open={newRoomDialogOpen} onClose={() => setNewRoomDialogOpen(false)}>
        <DialogTitle>Ajouter une nouvelle pièce</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Nom de la pièce"
            fullWidth
            variant="standard"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleCreateRoom();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setNewRoomDialogOpen(false);
            setNewRoomName('');
          }}>
            Annuler
          </Button>
          <Button onClick={handleCreateRoom} variant="contained" disabled={!newRoomName.trim()}>
            Créer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog pour supprimer l'appareil */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Supprimer l'appareil</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Êtes-vous sûr de vouloir supprimer l'appareil "{device.friendlyName}" ? 
            Cette action est irréversible et supprimera l'appareil de Zigbee2MQTT et de la base de données.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
            Annuler
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={deleting}>
            {deleting ? 'Suppression...' : 'Supprimer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

