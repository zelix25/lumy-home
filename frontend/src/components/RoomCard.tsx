import { useState, useMemo, useEffect } from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Switch,
  Slider,
  Grid,
  Chip,
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
  Blinds,
  DirectionsRun,
  WaterDrop,
  RadioButtonUnchecked,
  Warning,
  LocalFireDepartment,
  BatteryFull,
  Add,
  Remove,
} from '@mui/icons-material';
import { Device } from '../services/devices.service';
import { devicesService } from '../services/devices.service';
import { SensorType } from '../services/sensor-history.service';
import i18n from '@/i18n';
import RoomSensorChartModal from './RoomSensorChartModal';
import DeviceChartModal from './DeviceChartModal';
import { translateRoomName } from '../utils/roomTranslations';

interface RoomCardProps {
  roomName: string;
  devices: Device[];
  onDeviceUpdate?: () => void;
}

export default function RoomCard({ roomName, devices, onDeviceUpdate }: RoomCardProps) {
  const [deviceStates, setDeviceStates] = useState<Record<string, boolean>>({});
  const [brightnessValues, setBrightnessValues] = useState<Record<string, number>>({});
  const [coverPositions, setCoverPositions] = useState<Record<string, number>>({});
  const [heatingSetpoints, setHeatingSetpoints] = useState<Record<string, number>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSensor, setSelectedSensor] = useState<{
    type: SensorType;
    label: string;
    unit: string;
    color: string;
  } | null>(null);
  const [deviceChartModalOpen, setDeviceChartModalOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

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

  // Synchroniser les états des appareils avec les données
  useEffect(() => {
    const states: Record<string, boolean> = {};
    const brightness: Record<string, number> = {};
    const coverPos: Record<string, number> = {};
    validDevices.forEach((device) => {
      if (device.state?.state === 'ON' || device.state?.state === true) {
        states[device.ieeeAddress] = true;
      }
      if (device.state?.brightness !== undefined) {
        brightness[device.ieeeAddress] = Math.round(
          (typeof device.state.brightness === 'number' ? device.state.brightness : 0) / 2.55
        );
      }
      // Pour les volets, récupérer la position (0-100, où 0 = fermé, 100 = ouvert)
      if (device.type === 'cover') {
        if (device.state?.position !== undefined) {
          coverPos[device.ieeeAddress] = typeof device.state.position === 'number' 
            ? device.state.position 
            : parseInt(device.state.position) || 0;
        } else if (device.state?.state === 'open' || device.state?.state === 'OPEN') {
          coverPos[device.ieeeAddress] = 100;
        } else if (device.state?.state === 'closed' || device.state?.state === 'CLOSED') {
          coverPos[device.ieeeAddress] = 0;
        } else {
          coverPos[device.ieeeAddress] = 0;
        }
      }
    });
    setDeviceStates(states);
    setBrightnessValues(brightness);
    setCoverPositions(coverPos);
    
    // Synchroniser les consignes de chauffage
    const setpoints: Record<string, number> = {};
    validDevices.forEach((device) => {
      if (device.state?.occupied_heating_setpoint !== undefined) {
        const setpoint = typeof device.state.occupied_heating_setpoint === 'number' 
          ? device.state.occupied_heating_setpoint 
          : parseFloat(device.state.occupied_heating_setpoint) || 20;
        setpoints[device.ieeeAddress] = setpoint;
      }
    });
    setHeatingSetpoints((prev) => {
      // Ne mettre à jour que les valeurs qui ont changé depuis le serveur
      const updated = { ...prev };
      Object.keys(setpoints).forEach((address) => {
        // Ne mettre à jour que si la valeur n'est pas déjà optimiste ou si elle a changé
        if (updated[address] === undefined || Math.abs(updated[address] - setpoints[address]) > 0.1) {
          updated[address] = setpoints[address];
        }
      });
      return updated;
    });
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

  const handleCoverPositionChange = async (device: Device, position: number) => {
    try {
      const command = { position };
      await devicesService.sendCommand(device.ieeeAddress, command);
      setCoverPositions((prev) => ({ ...prev, [device.ieeeAddress]: position }));
      onDeviceUpdate?.();
    } catch (error) {
      console.error('Erreur lors du changement de position du volet:', error);
    }
  };

  const handleSetpointChange = async (device: Device, delta: number) => {
    try {
      // Récupérer la valeur actuelle (optimiste ou depuis l'état)
      const currentSetpoint = heatingSetpoints[device.ieeeAddress] !== undefined
        ? heatingSetpoints[device.ieeeAddress]
        : (typeof device.state?.occupied_heating_setpoint === 'number' 
          ? device.state.occupied_heating_setpoint 
          : parseFloat(device.state?.occupied_heating_setpoint) || 20);
      const newSetpoint = Math.max(5, Math.min(35, currentSetpoint + delta));
      
      // Mise à jour optimiste immédiate
      setHeatingSetpoints((prev) => ({ ...prev, [device.ieeeAddress]: newSetpoint }));
      
      // Envoi de la commande au serveur
      const command = { occupied_heating_setpoint: newSetpoint };
      await devicesService.sendCommand(device.ieeeAddress, command);
      onDeviceUpdate?.();
    } catch (error) {
      console.error('Erreur lors du changement de consigne:', error);
      // En cas d'erreur, restaurer la valeur précédente
      const originalSetpoint = typeof device.state?.occupied_heating_setpoint === 'number' 
        ? device.state.occupied_heating_setpoint 
        : parseFloat(device.state?.occupied_heating_setpoint) || 20;
      setHeatingSetpoints((prev) => ({ ...prev, [device.ieeeAddress]: originalSetpoint }));
    }
  };

  const getDeviceIcon = (device: Device, isOn?: boolean) => {
    const iconColor = device.status === 'online' 
      ? (isOn ? '#FFA726' : '#9E9E9E')
      : '#BDBDBD';
    const iconSize = 32;

    // Pour les capteurs, déterminer l'icône en fonction des données disponibles
    if (device.type === 'sensor' || device.type === 'temperature') {
      // Détecter le type de capteur en fonction des données disponibles
      if (device.state?.temperature !== undefined) {
        return <Thermostat sx={{ fontSize: iconSize, color: '#2196F3' }} />;
      }
      if (device.state?.humidity !== undefined) {
        return <WaterDrop sx={{ fontSize: iconSize, color: '#2196F3' }} />;
      }
      if (device.state?.motion !== undefined || device.state?.presence !== undefined || device.state?.occupancy !== undefined) {
        return <DirectionsRun sx={{ fontSize: iconSize, color: '#FF9800' }} />;
      }
      if (device.state?.illuminance !== undefined) {
        return <LightMode sx={{ fontSize: iconSize, color: '#FFC107' }} />;
      }
      if (device.state?.contact !== undefined) {
        return <Window sx={{ fontSize: iconSize, color: iconColor }} />;
      }
      if (device.state?.water_leak !== undefined) {
        return <WaterDrop sx={{ fontSize: iconSize, color: '#F44336' }} />;
      }
      if (device.state?.smoke !== undefined) {
        return <LocalFireDepartment sx={{ fontSize: iconSize, color: '#F44336' }} />;
      }
      if (device.state?.vibration !== undefined) {
        return <Warning sx={{ fontSize: iconSize, color: '#FF9800' }} />;
      }
      if (device.state?.battery !== undefined) {
        return <BatteryFull sx={{ fontSize: iconSize, color: iconColor }} />;
      }
      // Capteur générique par défaut
      return <Sensors sx={{ fontSize: iconSize, color: iconColor }} />;
    }

    switch (device.type) {
      case 'light':
        return <Lightbulb sx={{ fontSize: iconSize, color: iconColor }} />;
      case 'switch':
        return <Power sx={{ fontSize: iconSize, color: iconColor }} />;
      case 'plug':
        return <ElectricalServices sx={{ fontSize: iconSize, color: iconColor }} />;
      case 'energy':
        return <ElectricalServices sx={{ fontSize: iconSize, color: '#FF9800' }} />;
      case 'cover':
        return <Blinds sx={{ fontSize: iconSize, color: iconColor }} />;
      case 'temperature':
        return <Thermostat sx={{ fontSize: iconSize, color: '#2196F3' }} />;
      case 'motion':
        return <DirectionsRun sx={{ fontSize: iconSize, color: iconColor }} />;
      case 'illuminance':
        return <LightMode sx={{ fontSize: iconSize, color: '#FFC107' }} />;
      case 'humidity':
        return <WaterDrop sx={{ fontSize: iconSize, color: '#2196F3' }} />;
      case 'window':
        return <Window sx={{ fontSize: iconSize, color: iconColor }} />;
      case 'presence':
      case 'occupancy':
        return <Person sx={{ fontSize: iconSize, color: iconColor }} />;
      case 'contact':
        return <Window sx={{ fontSize: iconSize, color: iconColor }} />;
      case 'water_leak':
        return <WaterDrop sx={{ fontSize: iconSize, color: '#F44336' }} />;
      case 'smoke':
        return <LocalFireDepartment sx={{ fontSize: iconSize, color: '#F44336' }} />;
      case 'button':
        return <RadioButtonUnchecked sx={{ fontSize: iconSize, color: iconColor }} />;
      default:
        return <Sensors sx={{ fontSize: iconSize, color: iconColor }} />;
    }
  };

  const getDeviceValue = (device: Device): string => {
    if (device.type === 'light') {
      const isOn = deviceStates[device.ieeeAddress] || false;
      const brightness = brightnessValues[device.ieeeAddress] || 0;
      return isOn ? `${brightness} %` : i18n.t('devices.off');
    }
    if (device.type === 'switch' || device.type === 'plug') {
      const isOn = deviceStates[device.ieeeAddress] || false;
      return isOn ? i18n.t('devices.on') : i18n.t('devices.off');
    }
    if (device.type === 'cover') {
      const position = coverPositions[device.ieeeAddress] ?? 0;
      return `${position} %`;
    }
    // Pour les appareils energy, afficher la puissance si disponible
    if (device.type === 'energy') {
      if (device.state?.power !== undefined) {
        const power = typeof device.state.power === 'number' 
          ? device.state.power.toFixed(1) 
          : device.state.power;
        return `${power} W`;
      }
      // Sinon, afficher la tension si disponible
      if (device.state?.voltage !== undefined) {
        const voltage = typeof device.state.voltage === 'number' 
          ? device.state.voltage.toFixed(2) 
          : device.state.voltage;
        return `${voltage} V`;
      }
    }
    if (device.state?.temperature !== undefined) {
      const temp = typeof device.state.temperature === 'number' 
        ? device.state.temperature.toFixed(1) 
        : device.state.temperature;
      return `${temp} °C`;
    }
    if (device.state?.humidity !== undefined) {
      const hum = typeof device.state.humidity === 'number' 
        ? Math.round(device.state.humidity) 
        : device.state.humidity;
      return `${hum} %`;
    }
    if (device.state?.illuminance !== undefined) {
      const lux = typeof device.state.illuminance === 'number' 
        ? device.state.illuminance.toLocaleString() 
        : device.state.illuminance;
      return `${lux} lx`;
    }
    if (device.state?.presence !== undefined || device.state?.occupancy !== undefined) {
      const hasPresence = device.state.presence || device.state.occupancy;
      return hasPresence ? i18n.t('devices.detected') : i18n.t('devices.notDetected');
    }
    if (device.state?.motion !== undefined) {
      return device.state.motion ? i18n.t('devices.detected') : i18n.t('devices.notDetected');
    }
    if (device.state?.contact !== undefined) {
      return device.state.contact ? i18n.t('devices.closed') : i18n.t('devices.open');
    }
    if (device.state?.water_leak !== undefined) {
      return device.state.water_leak ? i18n.t('devices.detected') : i18n.t('devices.notDetected');
    }
    if (device.state?.vibration !== undefined) {
      return device.state.vibration ? i18n.t('devices.detected') : i18n.t('devices.notDetected');
    }
    return '';
  };

  // Générer des données de graphique simulées pour les capteurs de température
  const generateChartData = (device: Device) => {
    const baseValue = device.state?.temperature 
      ? (typeof device.state.temperature === 'number' ? device.state.temperature : parseFloat(device.state.temperature) || 0)
      : 20;
    const data = [];
    for (let i = 0; i < 10; i++) {
      data.push({
        value: baseValue + (Math.random() - 0.5) * 2,
      });
    }
    return data;
  };

  if (validDevices.length === 0) {
    return null;
  }

  // Filtrer les appareils en ligne pour l'affichage
  const onlineDevices = validDevices.filter((d) => d.status === 'online');

  // Trouver les capteurs de température et d'humidité dans la pièce
  const temperatureSensors = onlineDevices.filter((d) => d.state?.temperature !== undefined);
  const humiditySensors = onlineDevices.filter((d) => d.state?.humidity !== undefined);

  // Créer un ensemble des IDs des capteurs à exclure (ceux affichés dans le titre)
  const sensorsToExclude = useMemo(() => {
    const excludeSet = new Set<string>();
    // Exclure tous les capteurs de température
    temperatureSensors.forEach((d) => excludeSet.add(d.ieeeAddress));
    // Exclure tous les capteurs d'humidité
    humiditySensors.forEach((d) => excludeSet.add(d.ieeeAddress));
    return excludeSet;
  }, [temperatureSensors, humiditySensors]);

  // Filtrer les appareils à afficher (exclure les capteurs de température/humidité)
  const devicesToDisplay = useMemo(() => {
    return onlineDevices.filter((d) => !sensorsToExclude.has(d.ieeeAddress));
  }, [onlineDevices, sensorsToExclude]);

  // Calculer les valeurs moyennes
  const roomTemperature = useMemo(() => {
    if (temperatureSensors.length === 0) return null;
    const sum = temperatureSensors.reduce((acc, device) => {
      const temp = typeof device.state?.temperature === 'number' 
        ? device.state.temperature 
        : parseFloat(device.state?.temperature) || 0;
      return acc + temp;
    }, 0);
    return sum / temperatureSensors.length;
  }, [temperatureSensors]);

  const roomHumidity = useMemo(() => {
    if (humiditySensors.length === 0) return null;
    const sum = humiditySensors.reduce((acc, device) => {
      const hum = typeof device.state?.humidity === 'number' 
        ? device.state.humidity 
        : parseFloat(device.state?.humidity) || 0;
      return acc + hum;
    }, 0);
    return sum / humiditySensors.length;
  }, [humiditySensors]);

  // Fonction pour obtenir l'icône de la pièce
  const getRoomIcon = (room: string) => {
    const roomLower = room.toLowerCase();
    if (roomLower.includes('salon') || roomLower.includes('living')) {
      return '🛋️';
    } else if (roomLower.includes('cuisine') || roomLower.includes('kitchen')) {
      return '🧊';
    } else if (roomLower.includes('chambre') || roomLower.includes('bedroom')) {
      return '🛏️';
    } else if (roomLower.includes('salle de bain') || roomLower.includes('bathroom')) {
      return '🚿';
    } else if (roomLower.includes('bureau') || roomLower.includes('office')) {
      return '💼';
    } else if (roomLower.includes('énergie') || roomLower.includes('energy')) {
      return '⚡';
    }
    return '🏠';
  };

  return (
    <>
      <Grid item xs={12} sm={6} md={4}>
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Titre de la pièce avec icône et valeurs environnementales */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, mt: 1, flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="h6" sx={{ fontWeight: 500, fontSize: '1.1rem', mr: 1 }}>
                {getRoomIcon(roomName)}
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 500, fontSize: '1.1rem' }}>
            {translateRoomName(roomName)}
          </Typography>
        </Box>

            {/* Affichage de la température si disponible */}
            {roomTemperature !== null && (
              <Box sx={{ display: 'flex', alignItems: 'center', ml: 'auto' }}>
                <Thermostat sx={{ fontSize: 18, color: '#C4A5A5', mr: 0.5 }} />
                <Typography variant="body2" sx={{ fontSize: '0.875rem', color: 'text.primary' }}>
                  {roomTemperature.toFixed(1)} °C
                </Typography>
              </Box>
            )}
            
            {/* Affichage de l'humidité si disponible */}
            {roomHumidity !== null && (
              <Box sx={{ display: 'flex', alignItems: 'center', ml: roomTemperature !== null ? 1 : 'auto' }}>
                <WaterDrop sx={{ fontSize: 18, color: '#86A6A0', mr: 0.5 }} />
                <Typography variant="body2" sx={{ fontSize: '0.875rem', color: 'text.primary' }}>
                  {Math.round(roomHumidity)} %
              </Typography>
              </Box>
            )}
          </Box>

          {/* Cartes individuelles pour chaque appareil - 2 par ligne */}
          <Grid container spacing={1}>
            {devicesToDisplay.map((device) => {
                    const isOn = deviceStates[device.ieeeAddress] || false;
                    const brightness = brightnessValues[device.ieeeAddress] || 0;
              const coverPosition = coverPositions[device.ieeeAddress] ?? 0;
              const hasTemperature = device.state?.temperature !== undefined;
              const chartData = hasTemperature ? generateChartData(device) : [];
              const hasHeatingSetpoint = device.state?.occupied_heating_setpoint !== undefined || device.state?.current_heating_setpoint !== undefined;
              const localTemperature = typeof device.state?.local_temperature === 'number' 
                ? device.state.local_temperature 
                : parseFloat(device.state?.local_temperature) || null;
              const heatingSetpoint = heatingSetpoints[device.ieeeAddress] !== undefined
                ? heatingSetpoints[device.ieeeAddress]
                : (typeof device.state?.occupied_heating_setpoint === 'number' || typeof device.state?.current_heating_setpoint === 'number'
                  ? device.state.occupied_heating_setpoint 
                  : parseFloat(device.state?.occupied_heating_setpoint) || parseFloat(device.state?.current_heating_setpoint) || 20);

                    return (
                <Grid item xs={6} key={device.ieeeAddress}>
                  <Card
                    onClick={() => {
                      setSelectedDevice(device);
                      setDeviceChartModalOpen(true);
                    }}
                    sx={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E0E0E0',
                      borderRadius: '8px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      },
                    }}
                  >
                    <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 1.25 }}>
                      {/* Icône et titre */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontWeight: 500, 
                              fontSize: '0.75rem',
                              mb: 0.25,
                              lineHeight: 1.2,
                            }}
                          >
                              {device.friendlyName}
                            </Typography>
                          </Box>
                        <Box sx={{ ml: 0.5 }}>
                          {getDeviceIcon(device, isOn)}
                        </Box>
                      </Box>

                      {/* Valeur/Statut */}
                      {device.type === 'energy' ? (
                        <Box sx={{ mb: 0.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {/* Tension - Badge vert */}
                          {device.state?.voltage !== undefined && (
                            <Chip
                              label={`${typeof device.state.voltage === 'number' 
                                ? `${device.state.voltage.toFixed(2)} V`
                                : `${device.state.voltage} V`}`}
                              size="small"
                              sx={{
                                fontSize: '0.7rem',
                                fontWeight: 500,
                                height: '20px',
                                backgroundColor: '#4CAF50', // Vert
                                color: '#FFFFFF',
                                '& .MuiChip-label': {
                                  px: 0.75,
                                },
                              }}
                            />
                          )}
                          {/* Intensité - Badge rouge */}
                          {device.state?.current !== undefined && (
                            <Chip
                              label={`${typeof device.state.current === 'number' 
                                ? `${device.state.current.toFixed(2)} A`
                                : `${device.state.current} A`}`}
                              size="small"
                              sx={{
                                fontSize: '0.7rem',
                                fontWeight: 500,
                                height: '20px',
                                backgroundColor: '#F44336', // Rouge
                                color: '#FFFFFF',
                                '& .MuiChip-label': {
                                  px: 0.75,
                                },
                              }}
                            />
                          )}
                          {/* Puissance - Badge orange */}
                          {device.state?.power !== undefined && (
                            <Chip
                              label={`${typeof device.state.power === 'number' 
                                ? `${device.state.power.toFixed(1)} W`
                                : `${device.state.power} W`}`}
                              size="small"
                              sx={{
                                fontSize: '0.7rem',
                                fontWeight: 500,
                                height: '20px',
                                backgroundColor: '#FF9800', // Orange
                                color: '#FFFFFF',
                                '& .MuiChip-label': {
                                  px: 0.75,
                                },
                              }}
                            />
                          )}
                          {/* Si aucune donnée disponible */}
                          {!device.state?.voltage && !device.state?.power && !device.state?.current && (
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                fontWeight: 400,
                                fontSize: '0.75rem',
                                color: 'text.secondary',
                              }}
                            >
                              {getDeviceValue(device)}
                            </Typography>
                          )}
                        </Box>
                      ) : hasHeatingSetpoint ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }} onClick={(e) => e.stopPropagation()}>
                          {/* Température locale */}
                          {localTemperature !== null && (
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                fontWeight: 400,
                                fontSize: '0.75rem',
                                color: 'text.secondary',
                              }}
                            >
                              {i18n.t('devices.exposes.local_temperature')}: {localTemperature.toFixed(1)}°C
                            </Typography>
                          )}
                          {/* Consigne avec boutons +/- */}
                          <Box sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            gap: 1,
                            backgroundColor: '#F5F5F5',
                            borderRadius: 1,
                            p: 1,
                          }}>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSetpointChange(device, -0.5);
                              }}
                              sx={{ 
                                color: 'text.primary',
                                '&:hover': { backgroundColor: 'rgba(0,0,0,0.1)' },
                              }}
                            >
                              <Remove sx={{ fontSize: 18 }} />
                            </IconButton>
                            <Typography 
                              variant="h6" 
                              sx={{ 
                                fontWeight: 400,
                                fontSize: '1rem',
                                color: 'text.primary',
                                minWidth: '60px',
                                textAlign: 'center',
                              }}
                            >
                              {heatingSetpoint.toFixed(1)}°C
                            </Typography>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSetpointChange(device, 0.5);
                              }}
                              sx={{ 
                                color: 'text.primary',
                                '&:hover': { backgroundColor: 'rgba(0,0,0,0.1)' },
                              }}
                            >
                              <Add sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Box>
                        </Box>
                      ) : (device.type === 'switch' || device.type === 'plug') ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }} onClick={(e) => e.stopPropagation()}>
                          <Typography 
                            variant="h6" 
                            sx={{ 
                              fontWeight: 400,
                              fontSize: '1rem',
                              color: 'text.primary',
                            }}
                          >
                            {getDeviceValue(device)}
                          </Typography>
                          <Switch
                            checked={isOn}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleToggle(device, e.target.checked);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            size="small"
                          />
                        </Box>
                      ) : (
                        <Typography 
                          variant="h6" 
                          sx={{ 
                            fontWeight: 400,
                            fontSize: '1rem',
                            mb: hasTemperature ? 0.5 : 0,
                            color: 'text.primary',
                          }}
                        >
                          {getDeviceValue(device)}
                        </Typography>
                      )}

                      {/* Graphique pour température */}
                      {hasTemperature && chartData.length > 0 && (
                        <Box sx={{ height: 30, width: '100%', mt: 0.5, overflow: 'hidden' }}>
                          <svg width="100%" height="100%" viewBox="0 0 100 40" preserveAspectRatio="none">
                            <polyline
                              points={chartData.map((d, i) => `${(i / (chartData.length - 1)) * 100},${40 - ((d.value - Math.min(...chartData.map(x => x.value))) / (Math.max(...chartData.map(x => x.value)) - Math.min(...chartData.map(x => x.value)) || 1)) * 30}`).join(' ')}
                              fill="none"
                              stroke="#FF9800"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </Box>
                      )}

                      {/* Contrôles pour les lumières */}
                      {device.type === 'light' && (
                        <Box sx={{ mt: 1 }} onClick={(e) => e.stopPropagation()}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: isOn ? 0.5 : 0 }}>
                          <Switch
                            checked={isOn}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleToggle(device, e.target.checked);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            size="small"
                          />
                        </Box>
                          {isOn && (
                            <Slider
                              value={brightness}
                              onChange={(_, value) => handleBrightnessChange(device, value as number)}
                              onClick={(e) => e.stopPropagation()}
                              min={0}
                              max={100}
                              step={1}
                              size="small"
                              sx={{
                                '& .MuiSlider-thumb': {
                                  width: 12,
                                  height: 12,
                                },
                                '& .MuiSlider-track': {
                                  height: 2,
                                },
                                '& .MuiSlider-rail': {
                                  height: 2,
                                },
                              }}
                            />
                        )}
              </Box>
            )}

                      {/* Contrôles pour les volets */}
                      {device.type === 'cover' && (
                        <Box 
                          sx={{ mt: 1 }} 
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onMouseUp={(e) => e.stopPropagation()}
                        >
                          <Slider
                            value={coverPosition}
                            onChange={(e, value) => {
                              e.stopPropagation();
                              handleCoverPositionChange(device, value as number);
                            }}
                            onChangeCommitted={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            onMouseUp={(e) => e.stopPropagation()}
                            disabled={device.status !== 'online'}
                            min={0}
                            max={100}
                            step={1}
                            size="small"
                            sx={{
                              '& .MuiSlider-thumb': {
                                width: 12,
                                height: 12,
                              },
                              '& .MuiSlider-track': {
                                height: 2,
                              },
                              '& .MuiSlider-rail': {
                                height: 2,
                              },
                            }}
                          />
              </Box>
        )}
      </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      </Grid>

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

      {/* Modal pour les graphiques d'un appareil */}
      <DeviceChartModal
        open={deviceChartModalOpen}
        onClose={() => {
          setDeviceChartModalOpen(false);
          setSelectedDevice(null);
        }}
        device={selectedDevice}
      />
    </>
  );
}
