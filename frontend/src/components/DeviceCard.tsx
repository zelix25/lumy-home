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
  IconButton,
} from '@mui/material';
import {
  Add,
  Remove,
} from '@mui/icons-material';
import { Device } from '../services/devices.service';
import { devicesService } from '../services/devices.service';
import { useEffect, useMemo, useRef, useState } from 'react';
import i18n from '@/i18n';
import { translateRoomName } from '../utils/roomTranslations';
import {
  buildOnOffCommand,
  getSwitchChannels,
  isAnySwitchOn,
  isChannelOn,
} from '../utils/switchExposes';
import { DeviceIcon } from '../utils/deviceIcons';
import { formatVoltage } from '../utils/voltage';

function readCoverPosition(device: Device): number {
  if (device.type !== 'cover') return 0;
  if (device.state?.position !== undefined) {
    return typeof device.state.position === 'number'
      ? device.state.position
      : parseInt(device.state.position, 10) || 0;
  }
  if (device.state?.state === 'open' || device.state?.state === 'OPEN') return 100;
  if (device.state?.state === 'closed' || device.state?.state === 'CLOSED') return 0;
  return 0;
}

interface DeviceCardProps {
  device: Device;
  onToggle?: (device: Device, state: boolean) => void;
  onCoverPositionChange?: (device: Device, position: number) => void;
}

const getDeviceTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    energy: i18n.t('devices.energy'),
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
    humidity: i18n.t('devices.humidity'),
    pressure: i18n.t('devices.pressure'),
    illuminance: i18n.t('devices.illuminance'),
    occupancy: i18n.t('devices.occupancy'),
    presence: i18n.t('devices.presence'),
    contact: i18n.t('devices.contact'),
    water_leak: i18n.t('devices.water_leak'),
    smoke: i18n.t('devices.smoke'),
    battery: i18n.t('devices.battery'),
    voltage: i18n.t('devices.voltage'),
    linkquality: i18n.t('devices.linkquality'),
    state: i18n.t('devices.state'),
    brightness: i18n.t('devices.brightness'),
    color_temp: i18n.t('devices.color_temp'),
    other: i18n.t('devices.other'),
    unknown: i18n.t('devices.unknown'),
  };
  return labels[type] || type;
};

export default function DeviceCard({ device, onToggle, onCoverPositionChange }: DeviceCardProps) {
  const navigate = useNavigate();
  const isOnline = device.status === 'online';
  const deviceModel = device.model || device.meta?.model || null;
  const switchChannels = useMemo(
    () => getSwitchChannels(device.meta?.exposes, device.state, deviceModel),
    [device.meta?.exposes, device.state, deviceModel],
  );
  const isMultiChannelSwitch =
    (device.type === 'switch' || device.type === 'plug' || device.type === 'light') &&
    switchChannels.length > 1;
  const serverIsOn = isAnySwitchOn(device.state, device.meta?.exposes, deviceModel);
  const [localIsOn, setLocalIsOn] = useState(serverIsOn);
  const [localChannelState, setLocalChannelState] = useState<Record<string, boolean>>({});
  const switchOptimisticUntilRef = useRef(0);
  const [heatingSetpoints, setHeatingSetpoints] = useState<Record<string, number>>({});
  const [coverPosition, setCoverPosition] = useState(() => readCoverPosition(device));
  const isDraggingCoverRef = useRef(false);

  // Sync ON/OFF serveur → UI, sauf juste après une action utilisateur
  useEffect(() => {
    if (Date.now() < switchOptimisticUntilRef.current) return;
    setLocalIsOn(serverIsOn);
    const nextChannels: Record<string, boolean> = {};
    for (const channel of switchChannels) {
      nextChannels[channel.property] = isChannelOn(device.state, channel);
    }
    setLocalChannelState(nextChannels);
  }, [serverIsOn, device.state, switchChannels]);
  
  // Sync position serveur → UI, sauf pendant un drag (évite les sauts sur mobile)
  useEffect(() => {
    if (device.type !== 'cover' || isDraggingCoverRef.current) return;
    setCoverPosition(readCoverPosition(device));
  }, [device.type, device.state?.position, device.state?.state]);
  
  const handleCardClick = () => {
    navigate(`/appareils/${device.ieeeAddress}`);
  };

  const handleToggle = (
    event: React.ChangeEvent<HTMLInputElement>,
    checked: boolean,
  ) => {
    event.stopPropagation();
    if (!(device.type === 'light' || device.type === 'switch' || device.type === 'plug')) {
      return;
    }
    switchOptimisticUntilRef.current = Date.now() + 2000;
    setLocalIsOn(checked);
    onToggle?.(device, checked);
  };

  const handleChannelToggle = async (
    event: React.ChangeEvent<HTMLInputElement>,
    property: string,
    checked: boolean,
  ) => {
    event.stopPropagation();
    switchOptimisticUntilRef.current = Date.now() + 2000;
    setLocalChannelState((prev) => ({ ...prev, [property]: checked }));
    setLocalIsOn(
      switchChannels.some((channel) =>
        channel.property === property
          ? checked
          : (localChannelState[channel.property] ?? isChannelOn(device.state, channel)),
      ),
    );
    try {
      await devicesService.sendCommand(
        device.ieeeAddress,
        buildOnOffCommand(device.meta?.exposes, device.state, checked, property, deviceModel),
      );
    } catch (error) {
      console.error('Erreur lors de la commande multi-canal:', error);
      switchOptimisticUntilRef.current = 0;
      setLocalChannelState((prev) => ({ ...prev, [property]: !checked }));
    }
  };

  const stopCardNavigation = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  const handleCoverPositionPreview = (
    event: Event | React.SyntheticEvent,
    newValue: number | number[],
  ) => {
    event.stopPropagation();
    if (device.type !== 'cover') return;
    isDraggingCoverRef.current = true;
    const position = typeof newValue === 'number' ? newValue : newValue[0];
    setCoverPosition(position);
  };

  const handleCoverPositionCommit = (
    event: Event | React.SyntheticEvent,
    newValue: number | number[],
  ) => {
    event.stopPropagation();
    if (device.type !== 'cover') return;
    const position = typeof newValue === 'number' ? newValue : newValue[0];
    setCoverPosition(position);
    onCoverPositionChange?.(device, position);
    window.setTimeout(() => {
      isDraggingCoverRef.current = false;
    }, 1500);
  };

  const handleSetpointChange = async (device: Device, delta: number) => {
    try {
      // Récupérer la valeur actuelle (optimiste ou depuis l'état)
      const currentSetpoint = heatingSetpoints[device.ieeeAddress] !== undefined
        ? heatingSetpoints[device.ieeeAddress]
        : (typeof device.state?.occupied_heating_setpoint === 'number' 
          ? device.state.occupied_heating_setpoint 
          : typeof device.state?.current_heating_setpoint === 'number'
          ? device.state.current_heating_setpoint
          : parseFloat(device.state?.occupied_heating_setpoint) || parseFloat(device.state?.current_heating_setpoint) || 20);
      const newSetpoint = Math.max(5, Math.min(35, currentSetpoint + delta));
      
      // Mise à jour optimiste immédiate
      setHeatingSetpoints((prev) => ({ ...prev, [device.ieeeAddress]: newSetpoint }));
      
      // Envoi de la commande au serveur
      const command = { occupied_heating_setpoint: newSetpoint };
      await devicesService.sendCommand(device.ieeeAddress, command);
    } catch (error) {
      console.error('Erreur lors du changement de consigne:', error);
      // En cas d'erreur, restaurer la valeur précédente
      const originalSetpoint = typeof device.state?.occupied_heating_setpoint === 'number' 
        ? device.state.occupied_heating_setpoint 
        : typeof device.state?.current_heating_setpoint === 'number'
        ? device.state.current_heating_setpoint
        : parseFloat(device.state?.occupied_heating_setpoint) || parseFloat(device.state?.current_heating_setpoint) || 20;
      setHeatingSetpoints((prev) => ({ ...prev, [device.ieeeAddress]: originalSetpoint }));
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
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              flexGrow: 1,
              cursor: 'pointer',
              minWidth: 0,
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
              <DeviceIcon device={device} fontSize={48} />
            </Box>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                {device.friendlyName}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="body2" color="text.secondary">
                  {getDeviceTypeLabel(device.type)}
                </Typography>
                {device.room && (
                  <Chip
                    label={translateRoomName(device.room)}
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
          </Box>
          <Box
            sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', ml: 1 }}
            onClick={stopCardNavigation}
            onMouseDown={stopCardNavigation}
            onTouchStart={stopCardNavigation}
          >
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
            {(device.type === 'light' || device.type === 'switch' || device.type === 'plug') &&
              !isMultiChannelSwitch && (
                <Switch
                  checked={localIsOn}
                  onChange={handleToggle}
                  disabled={!isOnline}
                  color="primary"
                  size="medium"
                  inputProps={{
                    'aria-label': localIsOn ? 'Éteindre' : 'Allumer',
                  }}
                />
              )}
          </Box>
        </Box>

        {isMultiChannelSwitch && (
          <Box
            sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1 }}
            onClick={stopCardNavigation}
            onMouseDown={stopCardNavigation}
            onTouchStart={stopCardNavigation}
          >
            {switchChannels.map((channel) => (
              <Box
                key={channel.property}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  px: 0.5,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  {channel.label}
                </Typography>
                <Switch
                  checked={localChannelState[channel.property] ?? isChannelOn(device.state, channel)}
                  onChange={(e, checked) => handleChannelToggle(e, channel.property, checked)}
                  disabled={!isOnline}
                  color="primary"
                  size="small"
                  inputProps={{ 'aria-label': channel.label }}
                />
              </Box>
            ))}
          </Box>
        )}

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
              
              {/* Consigne de chauffage avec contrôle +/- */}
              {(device.state?.occupied_heating_setpoint !== undefined || device.state?.current_heating_setpoint !== undefined) && (
                <Grid item xs={12}>
                  <Box sx={{ mb: 1 }}>
                    {/* Température locale */}
                    {device.state?.local_temperature !== undefined && (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5, fontSize: '0.7rem' }}>
                        {i18n.t('devices.exposes.local_temperature')}: {typeof device.state.local_temperature === 'number' 
                          ? `${device.state.local_temperature.toFixed(1)}°C`
                          : `${device.state.local_temperature}°C`}
                      </Typography>
                    )}
                    {/* Consigne avec boutons +/- */}
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      gap: 0.5,
                      backgroundColor: '#F5F5F5',
                      borderRadius: 1,
                      p: 1,
                    }} onClick={(e) => e.stopPropagation()}>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetpointChange(device, -0.5);
                        }}
                        disabled={!isOnline}
                        sx={{ 
                          color: 'text.primary',
                          padding: '4px',
                          '&:hover': { backgroundColor: 'rgba(0,0,0,0.1)' },
                        }}
                      >
                        <Remove sx={{ fontSize: 16 }} />
                      </IconButton>
                      <Box sx={{ minWidth: '50px', textAlign: 'center' }}>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            fontWeight: 500,
                            fontSize: '0.95rem',
                            color: 'text.primary',
                          }}
                        >
                          {(heatingSetpoints[device.ieeeAddress] !== undefined
                            ? heatingSetpoints[device.ieeeAddress]
                            : (typeof device.state?.occupied_heating_setpoint === 'number' 
                              ? device.state.occupied_heating_setpoint 
                              : typeof device.state?.current_heating_setpoint === 'number'
                              ? device.state.current_heating_setpoint
                              : parseFloat(device.state?.occupied_heating_setpoint) || parseFloat(device.state?.current_heating_setpoint) || 20)).toFixed(1)}°C
                        </Typography>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetpointChange(device, 0.5);
                        }}
                        disabled={!isOnline}
                        sx={{ 
                          color: 'text.primary',
                          padding: '4px',
                          '&:hover': { backgroundColor: 'rgba(0,0,0,0.1)' },
                        }}
                      >
                        <Add sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Box>
                  </Box>
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
                    {(device.state.presence || device.state.occupancy) ? i18n.t('devices.detected') : i18n.t('devices.none')}
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
                    {device.state.contact ? i18n.t('devices.closed') : i18n.t('devices.open')}
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
                    {formatVoltage(device.state.voltage)}
                  </Typography>
                </Grid>
              )}
              {/* Puissance / intensité : energy, prises avec mesure, etc. */}
              {device.state.power !== undefined && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {i18n.t('devices.power')}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {typeof device.state.power === 'number'
                      ? `${device.state.power.toFixed(1)} W`
                      : `${device.state.power} W`}
                  </Typography>
                </Grid>
              )}
              {device.state.current !== undefined && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {i18n.t('devices.current')}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {typeof device.state.current === 'number'
                      ? `${device.state.current.toFixed(2)} A`
                      : `${device.state.current} A`}
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
                  <Box 
                    sx={{ px: 1, py: 1, touchAction: 'none' }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseUp={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                  >
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1, fontSize: '0.75rem' }}>
                      {i18n.t('devices.position')}
                    </Typography>
                    <Box 
                      sx={{ position: 'relative', px: 1, touchAction: 'none' }}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onMouseUp={(e) => e.stopPropagation()}
                    >
                      <Slider
                        value={coverPosition}
                        onChange={handleCoverPositionPreview}
                        onChangeCommitted={handleCoverPositionCommit}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
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
                          touchAction: 'none',
                          '& .MuiSlider-thumb': {
                            width: 24,
                            height: 24,
                            touchAction: 'none',
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
                      color: isAnySwitchOn(device.state, device.meta?.exposes, device.model) ? 'success.main' : 'text.secondary'
                    }}
                  >
                    {isAnySwitchOn(device.state, device.meta?.exposes, device.model) ? 'Actif' : 'Inactif'}
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

