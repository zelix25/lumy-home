import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Switch,
  Chip,
  Grid,
  Slider,
  //IconButton,
  Tooltip,
} from '@mui/material';
import {
  Lightbulb,
  Power,
  Sensors,
  ElectricalServices,
  //Door,
  Window,
  Thermostat,
  DirectionsRun,
  RadioButtonChecked,
  HelpOutline,
  Blinds,
} from '@mui/icons-material';
import { Device } from '../services/devices.service';
import i18n from '@/i18n';

interface DeviceCardProps {
  device: Device;
  onToggle?: (device: Device, state: boolean) => void;
  onCoverPositionChange?: (device: Device, position: number) => void;
}

const getDeviceIcon = (type: string) => {
  switch (type) {
    case 'light':
      return <Lightbulb sx={{ fontSize: 48 }} />;
    case 'switch':
      return <Power sx={{ fontSize: 48 }} />;
    case 'sensor':
      return <Sensors sx={{ fontSize: 48 }} />;
    case 'plug':
      return <ElectricalServices sx={{ fontSize: 48 }} />;
    /*case 'door':
      return <Door sx={{ fontSize: 48 }} />;*/
    case 'window':
      return <Window sx={{ fontSize: 48 }} />;
    case 'cover':
      return <Blinds sx={{ fontSize: 48 }} />;
    case 'temperature':
      return <Thermostat sx={{ fontSize: 48 }} />;
    case 'motion':
      return <DirectionsRun sx={{ fontSize: 48 }} />;
    case 'button':
      return <RadioButtonChecked sx={{ fontSize: 48 }} />;
    default:
      return <HelpOutline sx={{ fontSize: 48 }} />;
  }
};

const getDeviceTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    light: i18n.t('devices.light'),
    switch: i18n.t('devices.switch'),
    sensor: i18n.t('devices.sensor'),
    plug: i18n.t('devices.plug'),
    door: i18n.t('devices.door'),
    window: i18n.t('devices.window'),
    cover: i18n.t('devices.cover'),
    temperature: i18n.t('devices.temperature'),
    motion: i18n.t('devices.motion'),
    button: i18n.t('devices.button'),
    unknown: i18n.t('devices.unknown'),
  };
  return labels[type] || type;
};

export default function DeviceCard({ device, onToggle, onCoverPositionChange }: DeviceCardProps) {
  const navigate = useNavigate();
  const isOnline = device.status === 'online';
  const isOn = device.state?.state === 'ON' || device.state?.state === true;
  
  // Pour les volets, récupérer la position (0-100, où 0 = fermé, 100 = ouvert)
  const coverPosition = device.type === 'cover' && device.state?.position !== undefined
    ? typeof device.state.position === 'number' 
      ? device.state.position 
      : parseInt(device.state.position) || 0
    : device.state?.state === 'open' || device.state?.state === 'OPEN'
    ? 100
    : device.state?.state === 'closed' || device.state?.state === 'CLOSED'
    ? 0
    : 0;
  
  // Debug: afficher les données de l'appareil
  console.log(`📊 DeviceCard [${device.friendlyName}]:`, {
    hasState: !!device.state,
    stateType: typeof device.state,
    stateKeys: device.state ? Object.keys(device.state) : [],
    state: device.state,
  });

  const handleCardClick = () => {
    navigate(`/appareils/${device.ieeeAddress}`);
  };

  const handleToggle = (event: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
    event.stopPropagation();
    if (onToggle && (device.type === 'light' || device.type === 'switch' || device.type === 'plug')) {
      onToggle(device, checked);
    }
  };

  const handleCoverPositionChange = (event: Event, newValue: number | number[]) => {
    event.stopPropagation();
    if (onCoverPositionChange && device.type === 'cover') {
      const position = typeof newValue === 'number' ? newValue : newValue[0];
      onCoverPositionChange(device, position);
    }
  };

  return (
    <Card
      sx={{
        height: '100%',
        transition: 'all 0.15s ease-in-out',
        border: 'none',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#FFFFFF',
        '&:hover': {
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        },
      }}
    >
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Box 
          sx={{ 
            display: 'flex', 
            alignItems: 'flex-start', 
            mb: 2,
            cursor: 'pointer',
          }}
          onClick={handleCardClick}
        >
          <Box
            sx={{
              color: isOnline ? 'primary.main' : 'text.disabled',
              mr: 2,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {getDeviceIcon(device.type)}
          </Box>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              {device.friendlyName}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="body2" color="text.secondary">
                {getDeviceTypeLabel(device.type)}
              </Typography>
              {device.room && (
                <Chip
                  label={device.room}
                  size="small"
                  sx={{ 
                    fontSize: '12px',
                    fontWeight: 400,
                    backgroundColor: 'rgba(0,0,0,0.04)',
                    color: 'text.secondary',
                  }}
                />
              )}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Chip
                label={isOnline ? i18n.t('common.online') : i18n.t('common.offline')}
                size="small"
                color={isOnline ? 'success' : 'default'}
                sx={{ 
                  mb: 1, 
                  fontSize: '12px',
                  fontWeight: 400,
                  backgroundColor: isOnline ? 'rgba(134, 166, 160, 0.1)' : 'rgba(0,0,0,0.04)',
                  color: isOnline ? '#86A6A0' : 'text.secondary',
                }}
              />
            {(device.type === 'light' || device.type === 'switch' || device.type === 'plug') && (
              <Tooltip title={isOn ? 'Éteindre' : 'Allumer'}>
                <Switch
                  checked={isOn}
                  onChange={handleToggle}
                  disabled={!isOnline}
                  color="primary"
                  size="medium"
                />
              </Tooltip>
            )}
          </Box>
        </Box>

        {/* Afficher un message si l'appareil est en ligne mais n'a pas de données */}
        {isOnline && (!device.state || typeof device.state !== 'object' || Object.keys(device.state).length === 0) && (
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              {i18n.t('devices.waitingData')}
            </Typography>
          </Box>
        )}

        {device.state && typeof device.state === 'object' && Object.keys(device.state).length > 0 && (
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Grid container spacing={1}>
              {/* Données des lumières */}
              {device.state.brightness !== undefined && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {i18n.t('devices.brightness')}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {Math.round((device.state.brightness / 255) * 100)}%
                  </Typography>
                </Grid>
              )}
              {device.state.color_temp !== undefined && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {i18n.t('devices.colorTemp')}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {device.state.color_temp}K
                  </Typography>
                </Grid>
              )}
              
              {/* Données des capteurs - Température et Humidité */}
              {device.state.temperature !== undefined && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {i18n.t('devices.temperature')}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {typeof device.state.temperature === 'number' 
                      ? `${device.state.temperature.toFixed(1)}°C`
                      : `${device.state.temperature}°C`}
                  </Typography>
                </Grid>
              )}
              {device.state.humidity !== undefined && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {i18n.t('devices.humidity')}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {typeof device.state.humidity === 'number'
                      ? `${Math.round(device.state.humidity)}%`
                      : `${device.state.humidity}%`}
                  </Typography>
                </Grid>
              )}
              
              {/* Présence (presence ou occupancy) */}
              {(device.state.presence !== undefined || device.state.occupancy !== undefined) && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {i18n.t('devices.presence')}
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontWeight: 500,
                      color: (device.state.presence || device.state.occupancy) ? 'success.main' : 'text.secondary'
                    }}
                  >
                    {(device.state.presence || device.state.occupancy) ? 'Détectée' : 'Aucune'}
                  </Typography>
                </Grid>
              )}
              
              {/* Luminosité ambiante */}
              {device.state.illuminance !== undefined && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {i18n.t('devices.illuminance')}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {typeof device.state.illuminance === 'number'
                      ? `${device.state.illuminance.toLocaleString()} lux`
                      : `${device.state.illuminance} lux`}
                  </Typography>
                </Grid>
              )}
              
              {/* Pression */}
              {device.state.pressure !== undefined && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {i18n.t('devices.pressure')}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {typeof device.state.pressure === 'number'
                      ? `${Math.round(device.state.pressure)} hPa`
                      : `${device.state.pressure} hPa`}
                  </Typography>
                </Grid>
              )}
              
              {/* Contact (porte/fenêtre) */}
              {device.state.contact !== undefined && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {i18n.t('devices.contact')}
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontWeight: 500,
                      color: device.state.contact ? 'success.main' : 'warning.main'
                    }}
                  >
                    {device.state.contact ? 'Fermé' : 'Ouvert'}
                  </Typography>
                </Grid>
              )}
              
              {/* Vibration */}
              {device.state.vibration !== undefined && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {i18n.t('devices.vibration')}
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontWeight: 500,
                      color: device.state.vibration ? 'warning.main' : 'text.secondary'
                    }}
                  >
                    {device.state.vibration ? i18n.t('devices.detected') : i18n.t('devices.none')}
                  </Typography>
                </Grid>
              )}
              
              {/* Fuite d'eau */}
              {device.state.water_leak !== undefined && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {i18n.t('devices.waterLeak')}
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontWeight: 500,
                      color: device.state.water_leak ? 'error.main' : 'success.main'
                    }}
                  >
                    {device.state.water_leak ? 'Détectée' : 'Aucune'}
                  </Typography>
                </Grid>
              )}
              
              {/* Fumée */}
              {device.state.smoke !== undefined && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {i18n.t('devices.smoke')}
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontWeight: 500,
                      color: device.state.smoke ? 'error.main' : 'success.main'
                    }}
                  >
                    {device.state.smoke ? 'Détectée' : 'Aucune'}
                  </Typography>
                </Grid>
              )}
              
              {/* Informations système */}
              {device.state.battery !== undefined && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {i18n.t('devices.battery')}
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontWeight: 500,
                      color: device.state.battery < 20 ? 'error.main' : device.state.battery < 50 ? 'warning.main' : 'success.main'
                    }}
                  >
                    {typeof device.state.battery === 'number'
                      ? `${Math.round(device.state.battery)}%`
                      : `${device.state.battery}%`}
                  </Typography>
                </Grid>
              )}
              {device.state.voltage !== undefined && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {i18n.t('devices.voltage')}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {typeof device.state.voltage === 'number'
                      ? `${(device.state.voltage / 1000).toFixed(2)}V`
                      : `${device.state.voltage}V`}
                  </Typography>
                </Grid>
              )}
              {device.state.linkquality !== undefined && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {i18n.t('devices.signal')}
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontWeight: 500,
                      color: device.state.linkquality < 50 ? 'error.main' : device.state.linkquality < 100 ? 'warning.main' : 'success.main'
                    }}
                  >
                    {device.state.linkquality}
                  </Typography>
                </Grid>
              )}
              {device.type === 'cover' && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {i18n.t('devices.opening')}
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontWeight: 500,
                      color: coverPosition < 50 ? 'error.main' : coverPosition < 100 ? 'warning.main' : 'success.main'
                    }}
                  >
                    {coverPosition}%
                  </Typography>
                </Grid>
              )}
              
              {/* Position du volet (cover) */}
              {device.type === 'cover' && (
                <Grid item xs={12}>
                  <Box sx={{ px: 1, py: 1 }}>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1, fontSize: '0.75rem' }}>
                      {i18n.t('devices.position')}
                    </Typography>
                    <Box sx={{ position: 'relative', px: 1 }}>
                      <Slider
                        value={coverPosition}
                        onChange={handleCoverPositionChange}
                        disabled={!isOnline}
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
                          {i18n.t('devices.closed')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                          {i18n.t('devices.open')}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </Grid>
              )}
              
              {/* État ON/OFF pour les autres types */}
              {device.state.state !== undefined && device.type !== 'light' && device.type !== 'switch' && device.type !== 'plug' && device.type !== 'cover' && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {i18n.t('devices.state')}
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontWeight: 500,
                      color: (device.state.state === 'ON' || device.state.state === true) ? 'success.main' : 'text.secondary'
                    }}
                  >
                    {(device.state.state === 'ON' || device.state.state === true) ? 'Actif' : 'Inactif'}
                  </Typography>
                </Grid>
              )}
            </Grid>
          </Box>
        )}

        {!device.isSupported && (
          <Box
            sx={{
              mt: 2,
              p: 1.5,
              bgcolor: 'warning.light',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'warning.main',
            }}
          >
            <Typography variant="caption" color="warning.dark">
              ⚠️ {device.unsupportedReason || i18n.t('devices.unsupported')}
            </Typography>
          </Box>
        )}

        {/* Pied de carte - Dernière mise à jour - Toujours en bas */}
        {device.updatedAt && (
          <Box
            sx={{
              mt: 'auto',
              pt: 2,
              borderTop: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
              {i18n.t('devices.lastUpdate')}: {new Date(device.updatedAt).toLocaleTimeString('fr-FR')}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

