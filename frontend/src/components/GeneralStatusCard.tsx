import { Box, Typography, Card, CardContent, Button, Stack } from '@mui/material';
import StatusIndicator from './StatusIndicator';
import { Device } from '../services/devices.service';
import i18n from '@/i18n';
import { useNavigate } from 'react-router-dom';

interface GeneralStatusCardProps {
  devices: Device[];
}

export default function GeneralStatusCard({ devices }: GeneralStatusCardProps) {
  const navigate = useNavigate();

  // Filtrer le coordinateur
  const filteredDevices = devices.filter((device) => {
    const isCoordinator =
      device.type === 'Coordinator' ||
      (device.friendlyName && device.friendlyName.toLowerCase() === 'coordinator') ||
      (device.meta?.originalType && device.meta.originalType.toLowerCase() === 'coordinator') ||
      device.ieeeAddress === '0x0000000000000000';
    return !isCoordinator;
  });

  // Calculer la température moyenne
  const temperatureDevices = filteredDevices.filter(
    (d) => d.state?.temperature !== undefined && d.status === 'online'
  );
  const avgTemperature =
    temperatureDevices.length > 0
      ? temperatureDevices.reduce(
          (sum, d) => sum + (typeof d.state?.temperature === 'number' ? d.state.temperature : 0),
          0
        ) / temperatureDevices.length
      : null;

  // Compter les fenêtres ouvertes (capteurs de contact)
  const contactDevices = filteredDevices.filter(
    (d) =>
      d.state?.contact !== undefined &&
      d.status === 'online' &&
      (d.type?.toLowerCase().includes('contact') ||
        d.friendlyName?.toLowerCase().includes('fenêtre') ||
        d.friendlyName?.toLowerCase().includes('window'))
  );
  const openWindows = contactDevices.filter((d) => !d.state?.contact).length;

  // Compter les capteurs offline
  const offlineSensors = filteredDevices.filter(
    (d) => d.status === 'offline' && (d.type?.toLowerCase().includes('sensor') || d.type?.toLowerCase().includes('capteur'))
  );

  // Déterminer le statut global
  const getOverallStatus = (): 'good' | 'warning' | 'error' => {
    if (offlineSensors.length > 0) return 'error';
    if (openWindows > 0 || !avgTemperature) return 'warning';
    return 'good';
  };

  const status = getOverallStatus();
  const statusLines: string[] = [];

  if (avgTemperature !== null) {
    statusLines.push(`${i18n.t('home.temperature')}: ${avgTemperature.toFixed(1)}°C`);
  }

  if (openWindows > 0) {
    statusLines.push(`${openWindows} ${i18n.t('home.windowsOpen')}`);
  }

  if (offlineSensors.length > 0) {
    offlineSensors.slice(0, 2).forEach((sensor) => {
      statusLines.push(
        `${i18n.t('home.sensorOffline')} ${sensor.friendlyName} ${i18n.t('home.offline')}`
      );
    });
    if (offlineSensors.length > 2) {
      statusLines.push(`+${offlineSensors.length - 2} ${i18n.t('home.offline')}`);
    }
  }

  return (
    <Card
      sx={{
        backgroundColor: '#FFFFFF',
        border: 'none',
        borderRadius: 1,
        boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
        transition: 'all 0.15s ease-in-out',
        '&:hover': {
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        },
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <StatusIndicator status={status} size={20} />
          <Typography variant="h6" sx={{ ml: 1.5, fontWeight: 500 }}>
            {i18n.t('home.generalStatus')}
          </Typography>
        </Box>

        {statusLines.length > 0 ? (
          <Stack spacing={0.5} sx={{ mb: 2 }}>
            {statusLines.map((line, index) => (
              <Typography
                key={index}
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: '13px' }}
              >
                {line}
              </Typography>
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '13px' }}>
            {i18n.t('home.noStatusInfo')}
          </Typography>
        )}

        <Button
          variant="text"
          size="small"
          onClick={() => navigate('/appareils')}
          sx={{
            textTransform: 'none',
            fontSize: '12px',
            color: 'primary.main',
            '&:hover': {
              backgroundColor: 'transparent',
              textDecoration: 'underline',
            },
          }}
        >
          {i18n.t('home.viewDetails')}
        </Button>
      </CardContent>
    </Card>
  );
}

