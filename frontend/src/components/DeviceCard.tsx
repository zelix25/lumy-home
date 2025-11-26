import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Switch,
  Chip,
  Grid,
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
} from '@mui/icons-material';
import { Device } from '../services/devices.service';

interface DeviceCardProps {
  device: Device;
  onToggle?: (device: Device, state: boolean) => void;
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

export default function DeviceCard({ device, onToggle }: DeviceCardProps) {
  const navigate = useNavigate();
  const isOnline = device.status === 'online';
  const isOn = device.state?.state === 'ON' || device.state?.state === true;
  
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

  return (
    <Card
      sx={{
        height: '100%',
        cursor: 'pointer',
        transition: 'all 0.2s',
        border: isOnline ? '2px solid transparent' : '2px solid #e0e0e0',
        display: 'flex',
        flexDirection: 'column',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 4,
        },
      }}
      onClick={handleCardClick}
    >
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
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
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {getDeviceTypeLabel(device.type)}
            </Typography>
            {device.room && (
              <Chip
                label={device.room}
                size="small"
                sx={{ mt: 0.5, fontSize: '0.75rem' }}
              />
            )}
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Chip
              label={isOnline ? 'En ligne' : 'Hors ligne'}
              size="small"
              color={isOnline ? 'success' : 'default'}
              sx={{ mb: 1, fontSize: '0.7rem' }}
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
              ⏳ En attente de données...
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
                    💡 Luminosité
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {Math.round((device.state.brightness / 255) * 100)}%
                  </Typography>
                </Grid>
              )}
              {device.state.color_temp !== undefined && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    🌡️ Temp. couleur
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {device.state.color_temp}K
                  </Typography>
                </Grid>
              )}
              
              {/* Données des capteurs - Température et Humidité */}
              {device.state.temperature !== undefined && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    🌡️ Température
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {typeof device.state.temperature === 'number' 
                      ? `${device.state.temperature.toFixed(1)}°C`
                      : `${device.state.temperature}°C`}
                  </Typography>
                </Grid>
              )}
              {device.state.humidity !== undefined && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    💧 Humidité
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
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
                    👤 Présence
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontWeight: 600,
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
                    ☀️ Luminosité
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
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
                    📊 Pression
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
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
                    🚪 Contact
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontWeight: 600,
                      color: device.state.contact ? 'success.main' : 'warning.main'
                    }}
                  >
                    {device.state.contact ? 'Fermé' : 'Ouvert'}
                  </Typography>
                </Grid>
              )}
              
              {/* Fuite d'eau */}
              {device.state.water_leak !== undefined && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    💦 Fuite d'eau
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontWeight: 600,
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
                    🔥 Fumée
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontWeight: 600,
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
                    🔋 Batterie
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontWeight: 600,
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
                    ⚡ Tension
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {typeof device.state.voltage === 'number'
                      ? `${(device.state.voltage / 1000).toFixed(2)}V`
                      : `${device.state.voltage}V`}
                  </Typography>
                </Grid>
              )}
              {device.state.linkquality !== undefined && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    📶 Signal
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontWeight: 600,
                      color: device.state.linkquality < 50 ? 'error.main' : device.state.linkquality < 100 ? 'warning.main' : 'success.main'
                    }}
                  >
                    {device.state.linkquality}
                  </Typography>
                </Grid>
              )}
              
              {/* État ON/OFF pour les autres types */}
              {device.state.state !== undefined && device.type !== 'light' && device.type !== 'switch' && device.type !== 'plug' && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    ⚙️ État
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontWeight: 600,
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
              ⚠️ {device.unsupportedReason || "Cet appareil n'est pas entièrement supporté"}
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
              Dernière mise à jour: {new Date(device.updatedAt).toLocaleTimeString('fr-FR')}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

