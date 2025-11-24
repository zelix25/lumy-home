import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Switch,
  Chip,
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
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 4,
        },
      }}
      onClick={handleCardClick}
    >
      <CardContent>
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

        {device.state && (
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            {device.state.brightness !== undefined && (
              <Typography variant="body2" color="text.secondary">
                Luminosité: {Math.round((device.state.brightness / 255) * 100)}%
              </Typography>
            )}
            {device.state.temperature !== undefined && (
              <Typography variant="body2" color="text.secondary">
                Température: {device.state.temperature}°C
              </Typography>
            )}
            {device.state.battery !== undefined && (
              <Typography variant="body2" color="text.secondary">
                Batterie: {device.state.battery}%
              </Typography>
            )}
            {device.state.linkquality !== undefined && (
              <Typography variant="body2" color="text.secondary">
                Signal: {device.state.linkquality}
              </Typography>
            )}
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
      </CardContent>
    </Card>
  );
}

