import { useState, useMemo, useEffect } from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Chip,
  Stack,
  Switch,
  Slider,
  Divider,
  IconButton,
} from '@mui/material';
import {
  Thermostat,
  LightMode,
  Person,
  Lightbulb,
  Power,
  ElectricalServices,
  Sensors,
  Window,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';
import { Device } from '../services/devices.service';
import { devicesService } from '../services/devices.service';
import { SensorType } from '../services/sensor-history.service';
import i18n from '@/i18n';
import RoomSensorChartModal from './RoomSensorChartModal';

interface RoomCardProps {
  roomName: string;
  devices: Device[];
  onDeviceUpdate?: () => void;
}

interface RoomStats {
  temperature: number | null;
  illuminance: number | null;
  presence: boolean;
  humidity: number | null;
  deviceCount: number;
  onlineDeviceCount: number;
}

export default function RoomCard({ roomName, devices, onDeviceUpdate }: RoomCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [deviceStates, setDeviceStates] = useState<Record<string, boolean>>({});
  const [brightnessValues, setBrightnessValues] = useState<Record<string, number>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSensor, setSelectedSensor] = useState<{
    type: SensorType;
    label: string;
    unit: string;
    color: string;
  } | null>(null);

  // Filtrer le coordinateur
  const validDevices = useMemo(() => {
    return devices.filter((device) => {
      const isCoordinator =
        device.type === 'Coordinator' ||
        (device.friendlyName && device.friendlyName.toLowerCase() === 'coordinator') ||
        (device.meta?.originalType && device.meta.originalType.toLowerCase() === 'coordinator') ||
        device.ieeeAddress === '0x0000000000000000';
      return !isCoordinator;
    });
  }, [devices]);

  // Calculer les statistiques de la pièce
  const stats: RoomStats = useMemo(() => {
    const onlineDevices = validDevices.filter((d) => d.status === 'online');

    // Température moyenne
    const tempDevices = onlineDevices.filter((d) => d.state?.temperature !== undefined);
    const avgTemperature =
      tempDevices.length > 0
        ? tempDevices.reduce(
            (sum, d) =>
              sum + (typeof d.state?.temperature === 'number' ? d.state.temperature : 0),
            0
          ) / tempDevices.length
        : null;

    // Luminosité moyenne
    const illuminanceDevices = onlineDevices.filter((d) => d.state?.illuminance !== undefined);
    const avgIlluminance =
      illuminanceDevices.length > 0
        ? illuminanceDevices.reduce(
            (sum, d) =>
              sum + (typeof d.state?.illuminance === 'number' ? d.state.illuminance : 0),
            0
          ) / illuminanceDevices.length
        : null;

    // Humidité moyenne
    const humidityDevices = onlineDevices.filter((d) => d.state?.humidity !== undefined);
    const avgHumidity =
      humidityDevices.length > 0
        ? humidityDevices.reduce(
            (sum, d) =>
              sum + (typeof d.state?.humidity === 'number' ? d.state.humidity : 0),
            0
          ) / humidityDevices.length
        : null;

    // Présence
    const hasPresence = onlineDevices.some(
      (d) => d.state?.presence === true || d.state?.occupancy === true
    );

    return {
      temperature: avgTemperature,
      illuminance: avgIlluminance,
      presence: hasPresence,
      humidity: avgHumidity,
      deviceCount: validDevices.length,
      onlineDeviceCount: onlineDevices.length,
    };
  }, [validDevices]);

  // Grouper les appareils par type
  const controllableDevices = validDevices.filter(
    (d) => d.status === 'online' && (d.type === 'light' || d.type === 'switch' || d.type === 'plug')
  );
  const sensorDevices = validDevices.filter(
    (d) => d.status === 'online' && (d.type === 'sensor' || d.type === 'motion')
  );

  // Synchroniser les états des appareils avec les données
  useEffect(() => {
    const states: Record<string, boolean> = {};
    const brightness: Record<string, number> = {};
    validDevices.forEach((device) => {
      if (device.state?.state === 'ON' || device.state?.state === true) {
        states[device.ieeeAddress] = true;
      }
      if (device.state?.brightness !== undefined) {
        brightness[device.ieeeAddress] = Math.round(
          (typeof device.state.brightness === 'number' ? device.state.brightness : 0) / 2.55
        );
      }
    });
    setDeviceStates(states);
    setBrightnessValues(brightness);
  }, [validDevices]);

  const handleToggle = async (device: Device, checked: boolean) => {
    try {
      const command =
        device.type === 'light'
          ? { state: checked ? 'ON' : 'OFF' }
          : { state: checked ? 'ON' : 'OFF' };
      await devicesService.sendCommand(device.ieeeAddress, command);
      setDeviceStates((prev) => ({ ...prev, [device.ieeeAddress]: checked }));
      onDeviceUpdate?.();
    } catch (error) {
      console.error('Erreur lors de la commande:', error);
    }
  };

  const handleBrightnessChange = async (device: Device, value: number) => {
    try {
      const brightnessValue = Math.round((value / 100) * 255);
      await devicesService.sendCommand(device.ieeeAddress, {
        state: 'ON',
        brightness: brightnessValue,
      });
      setBrightnessValues((prev) => ({ ...prev, [device.ieeeAddress]: value }));
      setDeviceStates((prev) => ({ ...prev, [device.ieeeAddress]: value > 0 }));
      onDeviceUpdate?.();
    } catch (error) {
      console.error('Erreur lors du changement de luminosité:', error);
    }
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'light':
        return <Lightbulb sx={{ fontSize: 20 }} />;
      case 'switch':
        return <Power sx={{ fontSize: 20 }} />;
      case 'plug':
        return <ElectricalServices sx={{ fontSize: 20 }} />;
      case 'sensor':
        return <Sensors sx={{ fontSize: 20 }} />;
      case 'window':
        return <Window sx={{ fontSize: 20 }} />;
      default:
        return null;
    }
  };

  if (validDevices.length === 0) {
    return null;
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
        {/* En-tête de la pièce */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 500 }}>
            {roomName}
          </Typography>
          <IconButton
            size="small"
            onClick={() => setExpanded(!expanded)}
            sx={{ color: 'text.secondary' }}
          >
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>

        {/* Statistiques de la pièce */}
        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
          {stats.temperature !== null && (
            <Chip
              icon={<Thermostat sx={{ fontSize: 16 }} />}
              label={`${stats.temperature.toFixed(1)}°C`}
              size="small"
              sx={{ fontSize: '12px', cursor: 'pointer' }}
              onClick={() => {
                setSelectedSensor({
                  type: SensorType.TEMPERATURE,
                  label: i18n.t('devices.temperature'),
                  unit: '°C',
                  color: '#C4A5A5',
                });
                setModalOpen(true);
              }}
            />
          )}
          {stats.humidity !== null && (
            <Chip
              label={`${Math.round(stats.humidity)}%`}
              size="small"
              sx={{ fontSize: '12px', cursor: 'pointer' }}
              onClick={() => {
                setSelectedSensor({
                  type: SensorType.HUMIDITY,
                  label: i18n.t('devices.humidity'),
                  unit: '%',
                  color: '#86A6A0',
                });
                setModalOpen(true);
              }}
            />
          )}
          {stats.illuminance !== null && (
            <Chip
              icon={<LightMode sx={{ fontSize: 16 }} />}
              label={`${Math.round(stats.illuminance)} lux`}
              size="small"
              sx={{ fontSize: '12px', cursor: 'pointer' }}
              onClick={() => {
                setSelectedSensor({
                  type: SensorType.ILLUMINANCE,
                  label: i18n.t('devices.illuminance'),
                  unit: 'lux',
                  color: '#9BBEB7',
                });
                setModalOpen(true);
              }}
            />
          )}
          {stats.presence && (
            <Chip
              icon={<Person sx={{ fontSize: 16 }} />}
              label={i18n.t('devices.presence')}
              size="small"
              color="success"
              sx={{ fontSize: '12px' }}
            />
          )}
        </Stack>

        {expanded && (
          <>
            <Divider sx={{ my: 2 }} />

            {/* Appareils contrôlables */}
            {controllableDevices.length > 0 && (
              <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 500, color: 'text.secondary' }}>
                {i18n.t('deviceDetail.controls')}
              </Typography>
                <Stack spacing={2}>
                  {controllableDevices.map((device) => {
                    const isOn = deviceStates[device.ieeeAddress] || false;
                    const brightness = brightnessValues[device.ieeeAddress] || 0;
                    const isLight = device.type === 'light';

                    return (
                      <Box key={device.ieeeAddress}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: isLight ? 1 : 0 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {getDeviceIcon(device.type)}
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {device.friendlyName}
                            </Typography>
                          </Box>
                          <Switch
                            checked={isOn}
                            onChange={(e) => handleToggle(device, e.target.checked)}
                            size="small"
                          />
                        </Box>
                        {isLight && isOn && (
                          <Box sx={{ pl: 4, pr: 1 }}>
                            <Slider
                              value={brightness}
                              onChange={(_, value) => handleBrightnessChange(device, value as number)}
                              min={0}
                              max={100}
                              step={1}
                              size="small"
                              sx={{ mt: 1 }}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '10px' }}>
                              {brightness}%
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    );
                  })}
                </Stack>
              </Box>
            )}

            {/* Capteurs */}
            {sensorDevices.length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 500, color: 'text.secondary' }}>
                  {i18n.t('devices.sensors')}
                </Typography>
                <Stack spacing={1}>
                  {sensorDevices.map((device) => (
                    <Box
                      key={device.ieeeAddress}
                      sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                    >
                      {getDeviceIcon(device.type)}
                      <Typography variant="body2">{device.friendlyName}</Typography>
                      <Box sx={{ ml: 'auto', display: 'flex', gap: 0.5 }}>
                        {device.state?.contact !== undefined && (
                          <Chip
                            label={device.state.contact ? i18n.t('devices.closed') : i18n.t('devices.open')}
                            size="small"
                            color={device.state.contact ? 'success' : 'warning'}
                            sx={{ fontSize: '10px' }}
                          />
                        )}
                        {device.state?.vibration !== undefined && (
                          <Chip
                            label={device.state.vibration ? i18n.t('devices.detected') : i18n.t('devices.none')}
                            size="small"
                            color={device.state.vibration ? 'warning' : 'default'}
                            sx={{ fontSize: '10px' }}
                          />
                        )}
                      </Box>
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}

            {/* Aucun appareil en ligne */}
            {controllableDevices.length === 0 && sensorDevices.length === 0 && stats.onlineDeviceCount === 0 && stats.deviceCount === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                {i18n.t('devices.noDevices')}
              </Typography>
            )}
            {/* Appareils présents mais tous hors ligne */}
            {controllableDevices.length === 0 && sensorDevices.length === 0 && stats.onlineDeviceCount === 0 && stats.deviceCount > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                {i18n.t('devices.allDevicesOffline')}
              </Typography>
            )}
          </>
        )}
      </CardContent>

      {/* Modal pour le graphique des capteurs */}
      {selectedSensor && (
        <RoomSensorChartModal
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelectedSensor(null);
          }}
          roomName={roomName}
          devices={validDevices}
          sensorType={selectedSensor.type}
          sensorLabel={selectedSensor.label}
          sensorUnit={selectedSensor.unit}
          sensorColor={selectedSensor.color}
        />
      )}
    </Card>
  );
}

