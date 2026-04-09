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
  Tabs,
  Tab,
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
import { useDevices } from '../hooks/useDevices';
import { useNotification } from '../hooks/useNotification';
import { useTranslation } from 'react-i18next';
import MultiSensorChart from '../components/MultiSensorChart';
import { SensorType } from '../services/sensor-history.service';
import AdvancedExposesSettings from '../components/AdvancedExposesSettings';
import { t } from 'i18next';
import { translateRoomName } from '../utils/roomTranslations';

const getDeviceTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    energy: t('devices.energy'),
    light: t('devices.light'),
    switch: t('devices.switch'),
    sensor: t('devices.sensor'),
    plug: t('devices.plug'),
    door: t('devices.door'),
    window: t('devices.window'),
    temperature: t('devices.temperature'),
    humidity: t('devices.humidity'),
    pressure: t('devices.pressure'),
    illuminance: t('devices.illuminance'),
    occupancy: t('devices.occupancy'),
    presence: t('devices.presence'),
    contact: t('devices.contact'),
    water_leak: t('devices.waterLeak'),
    smoke: t('devices.smoke'),
    battery: t('devices.battery'),
    voltage: t('devices.voltage'),
    linkquality: t('devices.signal'),
    cover: t('devices.cover'),
    state: t('devices.state'),
    brightness: t('devices.brightness'),
    color_temp: t('devices.colorTemp'),
    power: t('devices.power'),
    current: t('devices.current'),
  };
  return labels[type] || type;
};

function getDeviceSubTypes(meta: Record<string, unknown> | null | undefined): string[] {
  if (!meta) return [];
  const raw = meta.subTypes ?? meta.subType;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === 'string' && x.length > 0);
}

export default function DeviceDetailPage() {
  const { ieeeAddress } = useParams<{ ieeeAddress: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { addNotification } = useNotification();
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [friendlyName, setFriendlyName] = useState('');
  const [room, setRoom] = useState('');
  const [brightness, setBrightness] = useState(100);
  const [isOn, setIsOn] = useState(false);
  const [coverPosition, setCoverPosition] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [newRoomDialogOpen, setNewRoomDialogOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [advancedMode, setAdvancedMode] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const { isConnected, socket } = useWebSocket();
  const { devices: allDevices } = useDevices();

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
        // Pour les volets, récupérer la position (0-100, où 0 = fermé, 100 = ouvert)
        if (data.type === 'cover') {
          if (data.state?.position !== undefined) {
            setCoverPosition(
              typeof data.state.position === 'number' 
                ? data.state.position 
                : parseInt(data.state.position) || 0
            );
          } else if (data.state?.state === 'open' || data.state?.state === 'OPEN') {
            setCoverPosition(100);
          } else if (data.state?.state === 'closed' || data.state?.state === 'CLOSED') {
            setCoverPosition(0);
          } else {
            setCoverPosition(0);
          }
        }
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
        // Trier les pièces par ordre alphabétique (en utilisant le nom traduit pour le tri)
        const sortedRooms = [...roomsData].sort((a, b) => {
          const nameA = translateRoomName(a.name).toLowerCase();
          const nameB = translateRoomName(b.name).toLowerCase();
          return nameA.localeCompare(nameB);
        });
        setRooms(sortedRooms);
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
        // Mettre à jour la position du volet si c'est un appareil cover
        if (device?.type === 'cover') {
          if (eventData.state?.position !== undefined) {
            setCoverPosition(
              typeof eventData.state.position === 'number' 
                ? eventData.state.position 
                : parseInt(eventData.state.position) || 0
            );
          } else if (eventData.state?.state === 'open' || eventData.state?.state === 'OPEN') {
            setCoverPosition(100);
          } else if (eventData.state?.state === 'closed' || eventData.state?.state === 'CLOSED') {
            setCoverPosition(0);
          }
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
    
    // Vérifier l'unicité du nom
    const trimmedName = friendlyName.trim();
    if (!trimmedName) {
      setNameError(t('deviceDetail.deviceNameCannotBeEmpty'));
      return;
    }

    // Vérifier si un autre appareil a déjà ce nom
    const existingDevice = allDevices.find(
      (d) => d.friendlyName.toLowerCase() === trimmedName.toLowerCase() && d.ieeeAddress !== ieeeAddress
    );

    if (existingDevice) {
      setNameError(t('deviceDetail.deviceNameAlreadyExists', { name: trimmedName }));
      return;
    }

    setNameError(null);
    
    try {
      const updated = await devicesService.updateFriendlyName(ieeeAddress, trimmedName);
      setDevice(updated);
      setFriendlyName(trimmedName);
      
      // Notification de succès
      addNotification({
        type: 'success',
        title: t('devices.nameUpdateSuccess'),
        message: t('devices.nameUpdateSuccessMessage', { name: trimmedName }),
      });
    } catch (err: any) {
      console.error('Erreur lors de la mise à jour du nom:', err);
      const errorMessage = err.message || t('devices.nameUpdateError');
      setNameError(errorMessage);
      
      // Notification d'erreur
      addNotification({
        type: 'error',
        title: t('devices.nameUpdateError'),
        message: errorMessage,
      });
    }
  };

  const handleSaveRoom = async () => {
    if (!ieeeAddress) return;
    try {
      const updated = await devicesService.updateRoom(ieeeAddress, room);
      setDevice(updated);
      
      // Notification de succès
      addNotification({
        type: 'success',
        title: t('devices.roomUpdateSuccess'),
        message: t('devices.roomUpdateSuccessMessage'),
      });
    } catch (err: any) {
      console.error('Erreur lors de la mise à jour de la pièce:', err);
      const errorMessage = err.message || t('devices.roomUpdateError');
      
      // Notification d'erreur
      addNotification({
        type: 'error',
        title: t('devices.roomUpdateError'),
        message: errorMessage,
      });
    }
  };

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;
    try {
      const newRoom = await roomsService.createRoom(newRoomName.trim());
      setRooms((prev) => {
        const updated = [...prev, newRoom];
        // Trier par ordre alphabétique en utilisant le nom traduit
        return updated.sort((a, b) => {
          const nameA = translateRoomName(a.name).toLowerCase();
          const nameB = translateRoomName(b.name).toLowerCase();
          return nameA.localeCompare(nameB);
        });
      });
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

  const handleCoverPositionChange = async (_: Event, value: number | number[]) => {
    if (!ieeeAddress) return;
    const newPosition = Array.isArray(value) ? value[0] : value;
    setCoverPosition(newPosition);
    try {
      // Pour Zigbee2MQTT, la position est envoyée comme un nombre de 0 à 100
      // où 0 = fermé, 100 = ouvert
      await devicesService.sendCommand(ieeeAddress, {
        position: newPosition,
      });
    } catch (err) {
      console.error('Erreur lors du changement de position du volet:', err);
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
      setError(err.message || t('devices.deleteError'));
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
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={advancedMode}
                onChange={(e) => {
                  const newMode = e.target.checked;
                  setAdvancedMode(newMode);
                  // Si on désactive le mode avancé et qu'on est sur l'onglet 2, revenir à l'onglet 0
                  if (!newMode && activeTab === 2) {
                    setActiveTab(0);
                  }
                }}
              />
            }
            label={t('devices.advancedMode')}
          />
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => setDeleteDialogOpen(true)}
          >
            {t('deviceDetail.delete')}
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs
                value={activeTab}
                onChange={(_, newValue) => setActiveTab(newValue)}
                aria-label={t('devices.deviceTabs')}
              >
                <Tab label="Informations" />
                <Tab label={t('devices.sensorChart')} />
                {advancedMode && device.meta?.exposes && (
                  <Tab label={t('devices.advancedSettings')} />
                )}
              </Tabs>
            </Box>

            {/* Onglet Informations */}
            {activeTab === 0 && (
              <CardContent>
                <Box sx={{ mb: 2 }}>
                  <TextField
                    fullWidth
                    label={t('deviceDetail.deviceName')}
                    value={friendlyName}
                    onChange={(e) => {
                      setFriendlyName(e.target.value);
                      setNameError(null); // Réinitialiser l'erreur lors de la saisie
                    }}
                    error={!!nameError}
                    helperText={nameError}
                    sx={{ mb: 1 }}
                  />
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleSaveName}
                    size="small"
                    disabled={!friendlyName.trim() || friendlyName.trim() === device.friendlyName}
                  >
                    {t('deviceDetail.saveName')}
                  </Button>
                </Box>

                <Box>
                  <FormControl fullWidth sx={{ mb: 1 }}>
                    <InputLabel id="room-select-label">Pièce</InputLabel>
                    <Select
                      labelId="room-select-label"
                      value={room}
                      label={t('deviceDetail.room')}
                      onChange={(e) => setRoom(e.target.value)}
                      disabled={loadingRooms}
                    >
                      <MenuItem value="">
                        <em>{t('deviceDetail.noRoom')}</em>
                      </MenuItem>
                      {rooms.map((roomOption) => (
                        <MenuItem key={roomOption.id} value={roomOption.name}>
                          {translateRoomName(roomOption.name)}
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
                      {t('deviceDetail.addRoom')}
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={<SaveIcon />}
                      onClick={handleSaveRoom}
                      size="small"
                      disabled={!room}
                    >
                      {t('deviceDetail.saveRoom')}
                    </Button>
                  </Box>
                </Box>

                {device.type === 'light' && (
                  <Box sx={{ mt: 3 }}>
                    <Divider sx={{ mb: 3 }} />
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 500 }}>
                      {t('deviceDetail.controls')}
                    </Typography>
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
                        label={isOn ? t('deviceDetail.on') : t('deviceDetail.off')}
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
                  </Box>
                )}

                {(device.type === 'switch' || device.type === 'plug') && (
                  <Box sx={{ mt: 3 }}>
                    <Divider sx={{ mb: 3 }} />
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 500 }}>
                      Contrôles
                    </Typography>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={isOn}
                          onChange={(e) => handleToggle(e.target.checked)}
                          disabled={device.status !== 'online'}
                          size="medium"
                        />
                      }
                      label={isOn ? t('deviceDetail.enabled') : t('deviceDetail.disabled')}
                    />
                  </Box>
                )}

                {device.type === 'cover' && (
                  <Box sx={{ mt: 3 }}>
                    <Divider sx={{ mb: 3 }} />
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 500 }}>
                      Contrôles
                    </Typography>
                    <Box sx={{ px: 1, py: 1 }}>
                      <Typography variant="body2" color="text.secondary" display="block" sx={{ mb: 1, fontSize: '0.875rem' }}>
                        {t('devices.position')}
                      </Typography>
                      <Box sx={{ position: 'relative', px: 1 }}>
                        <Slider
                          value={coverPosition}
                          onChange={handleCoverPositionChange}
                          disabled={device.status !== 'online'}
                          min={0}
                          max={100}
                          step={1}
                          marks={[
                            { value: 50, label: '50%' },
                          ]}
                          valueLabelDisplay="auto"
                          valueLabelFormat={(value) => `${value}%`}
                          sx={{
                            mb: 0.5,
                            '& .MuiSlider-thumb': {
                              width: 20,
                              height: 20,
                            },
                            '& .MuiSlider-track': {
                              height: 6,
                            },
                            '& .MuiSlider-rail': {
                              height: 6,
                            },
                            '& .MuiSlider-markLabel': {
                              fontSize: '0.75rem',
                            },
                            '& .MuiSlider-valueLabel': {
                              fontSize: '0.75rem',
                            },
                          }}
                        />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                            {t('devices.closed')}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                            {t('devices.open')}
                          </Typography>
                        </Box>
                      </Box>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          color: coverPosition < 50 ? 'error.main' : coverPosition < 100 ? 'warning.main' : 'success.main',
                          display: 'block',
                          mt: 1,
                          textAlign: 'right',
                        }}
                      >
                        {coverPosition}%
                      </Typography>
                    </Box>
                  </Box>
                )}
              </CardContent>
            )}

            {/* Onglet Graphique des capteurs */}
            {activeTab === 1 && (
              <CardContent>
                {device.state && (() => {
                  const availableSensors: Array<{ type: SensorType; label: string; unit: string }> = [];
                  
                  if (device.state.temperature !== undefined) {
                    availableSensors.push({
                      type: SensorType.TEMPERATURE,
                      label: t('devices.temperature'),
                      unit: '°C',
                    });
                  }
                  
                  if (device.state.humidity !== undefined) {
                    availableSensors.push({
                      type: SensorType.HUMIDITY,
                      label: t('devices.humidity'),
                      unit: '%',
                    });
                  }
                  
                  if (device.state.pressure !== undefined) {
                    availableSensors.push({
                      type: SensorType.PRESSURE,
                      label: t('devices.pressure'),
                      unit: 'hPa',
                    });
                  }
                  
                  if (device.state.illuminance !== undefined) {
                    availableSensors.push({
                      type: SensorType.ILLUMINANCE,
                      label: t('devices.illuminance'),
                      unit: 'lux',
                    });
                  }
                  
                  if (device.state.battery !== undefined) {
                    availableSensors.push({
                      type: SensorType.BATTERY,
                      label: t('devices.battery'),
                      unit: '%',
                    });
                  }
                  
                  if (device.state.voltage !== undefined) {
                    availableSensors.push({
                      type: SensorType.VOLTAGE,
                      label: t('devices.voltage'),
                      unit: 'V',
                    });
                  }

                  const powerReading =
                    device.state.power ??
                    device.state.instantaneous_power ??
                    device.state.power_w;
                  if (powerReading !== undefined && powerReading !== null) {
                    availableSensors.push({
                      type: SensorType.POWER,
                      label: t('devices.power'),
                      unit: 'W',
                    });
                  }

                  if (
                    device.state.current !== undefined &&
                    device.state.current !== null
                  ) {
                    availableSensors.push({
                      type: SensorType.CURRENT,
                      label: t('devices.current'),
                      unit: 'A',
                    });
                  }
                  
                  if (device.state.linkquality !== undefined) {
                    availableSensors.push({
                      type: SensorType.LINKQUALITY,
                      label: t('devices.signalQuality'),
                      unit: '',
                    });
                  }
                  
                  return availableSensors.length > 0 ? (
                    <Box sx={{ pr: 2.5 }}>
                      <MultiSensorChart
                        deviceId={device.ieeeAddress}
                        availableSensors={availableSensors}
                      />
                    </Box>
                  ) : (
                    <Alert severity="info">
                      {t('devices.noSensorsAvailable')}
                    </Alert>
                  );
                })()}
              </CardContent>
            )}

            {/* Onglet Réglages avancés */}
            {activeTab === 2 && advancedMode && device.meta?.exposes && (
              <Box sx={{ p: 3 }}>
                <AdvancedExposesSettings
                  deviceId={device.ieeeAddress}
                  friendlyName={device.friendlyName}
                  exposes={device.meta.exposes}
                  currentState={device.state || {}}
                  onStateUpdate={async () => {
                    // Rafraîchir les données de l'appareil
                    try {
                      const updated = await devicesService.getDevice(device.ieeeAddress);
                      setDevice(updated);
                      setIsOn(updated.state?.state === 'ON' || updated.state?.state === true);
                      if (updated.state?.brightness !== undefined) {
                        setBrightness(Math.round((updated.state.brightness / 255) * 100));
                      }
                      // Mettre à jour la position du volet si c'est un appareil cover
                      if (updated.type === 'cover') {
                        if (updated.state?.position !== undefined) {
                          setCoverPosition(
                            typeof updated.state.position === 'number' 
                              ? updated.state.position 
                              : parseInt(updated.state.position) || 0
                          );
                        } else if (updated.state?.state === 'open' || updated.state?.state === 'OPEN') {
                          setCoverPosition(100);
                        } else if (updated.state?.state === 'closed' || updated.state?.state === 'CLOSED') {
                          setCoverPosition(0);
                        } else {
                          setCoverPosition(0);
                        }
                      }
                    } catch (err) {
                      console.error('Erreur lors du rafraîchissement:', err);
                    }
                  }}
                />
              </Box>
            )}
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 500 }}>
                {t('devices.state')}
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Chip
                  label={device.status === 'online' ? t('devices.online') : t('devices.offline')}
                  sx={{
                    backgroundColor: device.status === 'online' ? 'success.light' : 'default',
                    color: device.status === 'online' ? 'white' : 'text.secondary',
                  }}
                />
                <Chip label={getDeviceTypeLabel(device.type)} />
                {getDeviceSubTypes(device.meta).map((st) => (
                  <Chip
                    key={st}
                    size="small"
                    variant="outlined"
                    label={getDeviceTypeLabel(st)}
                  />
                ))}
              </Box>

              {device.state && Object.keys(device.state).length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom sx={{ mb: 2 }}>
                    {t('deviceDetail.detailedInfo')}
                  </Typography>
                  
                  <Grid container spacing={1.5}>
                    {/* Données des capteurs avec icônes */}
                    {device.state.temperature !== undefined && (
                      <Grid item xs={6}>
                        <Box sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1, height: '100%' }}>
                          <Typography variant="body2" fontWeight={500} gutterBottom>
                            🌡️ {t('devices.temperature')}
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
                            💧 {t('devices.humidity')}
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
                            📊 {t('devices.pressure')}
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
                            ☀️ {t('devices.illuminance')}
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
                            👤 {t('devices.presence')}
                          </Typography>
                          <Typography variant="h6" color={(device.state.presence || device.state.occupancy) ? 'success.main' : 'text.secondary'}>
                            {(device.state.presence || device.state.occupancy) ? t('devices.detected') : t('devices.none')}
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                    
                    {device.state.contact !== undefined && (
                      <Grid item xs={6}>
                        <Box sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1, height: '100%' }}>
                          <Typography variant="body2" fontWeight={500} gutterBottom>
                            🚪 {t('devices.contact')}
                          </Typography>
                          <Typography variant="h6" color={device.state.contact ? 'success.main' : 'error.main'}>
                            {device.state.contact ? 'Fermé' : 'Ouvert'}
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                    
                    {device.state.vibration !== undefined && (
                      <Grid item xs={6}>
                        <Box sx={{ p: 1.5, bgcolor: device.state.vibration ? 'warning.light' : 'background.default', borderRadius: 1, height: '100%' }}>
                          <Typography variant="body2" fontWeight={500} gutterBottom>
                            📳 {t('devices.vibration')}
                          </Typography>
                          <Typography variant="h6" color={device.state.vibration ? 'warning.main' : 'text.secondary'}>
                            {device.state.vibration ? t('devices.detected') : t('devices.none')}
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                    
                    {device.state.water_leak !== undefined && (
                      <Grid item xs={6}>
                        <Box sx={{ p: 1.5, bgcolor: device.state.water_leak ? 'error.light' : 'background.default', borderRadius: 1, height: '100%' }}>
                          <Typography variant="body2" fontWeight={500} gutterBottom>
                            💦 {t('devices.waterLeak')}
                          </Typography>
                          <Typography variant="h6" color={device.state.water_leak ? 'error.main' : 'success.main'}>
                            {device.state.water_leak ? '⚠️'+t('devices.detected') : t('devices.none')}
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                    
                    {device.state.smoke !== undefined && (
                      <Grid item xs={6}>
                        <Box sx={{ p: 1.5, bgcolor: device.state.smoke ? 'error.light' : 'background.default', borderRadius: 1, height: '100%' }}>
                          <Typography variant="body2" fontWeight={500} gutterBottom>
                            🔥 {t('devices.smoke')}
                          </Typography>
                          <Typography variant="h6" color={device.state.smoke ? 'error.main' : 'success.main'}>
                            {device.state.smoke ? '⚠️'+t('devices.detected') : t('devices.none')}
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                    
                    {/* Informations système */}
                    {device.state.battery !== undefined && (
                      <Grid item xs={6}>
                        <Box sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1, height: '100%' }}>
                          <Typography variant="body2" fontWeight={500} gutterBottom>
                            🔋 {t('devices.battery')}
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
                            ⚡ {t('devices.voltage')}
                          </Typography>
                          <Typography variant="h6" color="primary.main">
                            {(() => {
                              if (typeof device.state.voltage === 'number') {
                                // Pour les types "energy" et "switch", afficher la valeur réelle sans diviser
                                if (device.type === 'energy' || device.type === 'switch') {
                                  return `${device.state.voltage.toFixed(2)}V`;
                                }
                                // Pour les autres types, diviser par 1000 (millivolts -> volts)
                                return `${(device.state.voltage / 1000).toFixed(2)}V`;
                              }
                              return `${device.state.voltage}V`;
                            })()}
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                    
                    {device.state.linkquality !== undefined && (
                      <Grid item xs={6}>
                        <Box sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1, height: '100%' }}>
                          <Typography variant="body2" fontWeight={500} gutterBottom>
                            📶 {t('devices.signal')}
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
                      .map(([key, value]) => {
                        // Traduire le nom de l'exposition si disponible
                        const translatedKey = t(`devices.exposes.${key}`, { defaultValue: key });
                        return (
                          <Grid item xs={6} key={key}>
                            <Box sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1, height: '100%' }}>
                              <Typography variant="body2" fontWeight={500} gutterBottom>
                                {translatedKey}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {String(value)}
                              </Typography>
                            </Box>
                          </Grid>
                        );
                      })}
                  </Grid>
                </Box>
              )}

              {(device.manufacturer || device.model) && (
                <Box sx={{ mt: 2 }}>
                  <Grid container spacing={2}>
                    {device.manufacturer && (
                      <Grid item xs={6}>
                        <Typography variant="subtitle2" gutterBottom>
                          {t('deviceDetail.manufacturer')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {device.manufacturer}
                        </Typography>
                      </Grid>
                    )}
                    {device.model && (
                      <Grid item xs={6}>
                        <Typography variant="subtitle2" gutterBottom>
                          {t('deviceDetail.model')}
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
                  {device.unsupportedReason || t('devices.unsupported')}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Dialog pour créer une nouvelle pièce */}
      <Dialog open={newRoomDialogOpen} onClose={() => setNewRoomDialogOpen(false)}>
        <DialogTitle>{t('deviceDetail.addRoom')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label={t('deviceDetail.roomPlaceholder')}
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
            {t('devices.cancel')}
          </Button>
          <Button onClick={handleCreateRoom} variant="contained" disabled={!newRoomName.trim()}>
            {t('devices.create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog pour supprimer l'appareil */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t('deviceDetail.deleteDevice')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('deviceDetail.deleteDeviceConfirmation', { name: device.friendlyName })}
            {t('deviceDetail.deleteDeviceConfirmationMessage')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
            {t('devices.cancel')}
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={deleting}>
            {deleting ? t('deviceDetail.deleting') : t('deviceDetail.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

