import { Box, Typography, Grid, Card, CircularProgress } from '@mui/material';
import DevicesIcon from '@mui/icons-material/Devices';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import PersonPinCircleIcon from '@mui/icons-material/PersonPinCircle';
import { useEffect, useState, useMemo } from 'react';
import { devicesService, DeviceStats, Device } from '../services/devices.service';
import { settingsService, Settings } from '../services/settings.service';
import { useDevices } from '../hooks/useDevices';
import { usePluginWidgets } from '../hooks/usePluginWidgets';
import RoomCard from '../components/RoomCard';
import WeatherInline from '../components/WeatherInline';
import PluginWidgetLoader from '../components/PluginWidgetLoader';
import i18n from '@/i18n';

export default function HomePage() {
  const [stats, setStats] = useState<DeviceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings | null>(null);
  const { devices } = useDevices();
  const pluginWidgets = usePluginWidgets();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await devicesService.getStats();
        setStats(data);
      } catch (error) {
        console.error('Erreur lors du chargement des statistiques:', error);
      } finally {
        setLoading(false);
      }
    };

    const fetchSettings = async () => {
      try {
        const data = await settingsService.getSettings();
        setSettings(data);
      } catch (error) {
        console.error('Erreur lors du chargement des settings:', error);
      }
    };

    fetchStats();
    fetchSettings();
    const interval = setInterval(fetchStats, 30000); // Rafraîchir toutes les 30 secondes

    return () => clearInterval(interval);
  }, []);

  // Calculer les statistiques globales de la maison
  const houseStats = useMemo(() => {
    const onlineDevices = devices.filter((d) => d.status === 'online');

    // Filtrer les coordinateurs
    const validDevices = onlineDevices.filter((device) => {
      const isCoordinator =
        device.type === 'Coordinator' ||
        (device.friendlyName && device.friendlyName.toLowerCase() === 'coordinator') ||
        (device.meta?.originalType && device.meta.originalType.toLowerCase() === 'coordinator') ||
        device.ieeeAddress === '0x0000000000000000';
      return !isCoordinator;
    });

    // Température moyenne
    const tempDevices = validDevices.filter((d) => d.state?.temperature !== undefined);
    const avgTemperature =
      tempDevices.length > 0
        ? tempDevices.reduce(
            (sum, d) =>
              sum + (typeof d.state?.temperature === 'number' ? d.state.temperature : 0),
            0
          ) / tempDevices.length
        : null;

    // Humidité moyenne
    const humidityDevices = validDevices.filter((d) => d.state?.humidity !== undefined);
    const avgHumidity =
      humidityDevices.length > 0
        ? humidityDevices.reduce(
            (sum, d) =>
              sum + (typeof d.state?.humidity === 'number' ? d.state.humidity : 0),
            0
          ) / humidityDevices.length
        : null;

    // Présence détectée
    const hasPresence = validDevices.some(
      (d) => d.state?.presence === true || d.state?.occupancy === true
    );

    return {
      temperature: avgTemperature,
      humidity: avgHumidity,
      presence: hasPresence,
    };
  }, [devices]);


  // Grouper les appareils par pièce
  const devicesByRoom = useMemo(() => {
    const grouped: Record<string, Device[]> = {};
    const filteredDevices = devices.filter((device) => {
      const isCoordinator =
        device.type === 'Coordinator' ||
        (device.friendlyName && device.friendlyName.toLowerCase() === 'coordinator') ||
        (device.meta?.originalType && device.meta.originalType.toLowerCase() === 'coordinator') ||
        device.ieeeAddress === '0x0000000000000000';
      return !isCoordinator;
    });

    filteredDevices.forEach((device) => {
      const roomName = device.room || i18n.t('home.unnamedRoom');
      if (!grouped[roomName]) {
        grouped[roomName] = [];
      }
      grouped[roomName].push(device);
    });

    return grouped;
  }, [devices]);

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 500, mb: 1 }}>
            {i18n.t('home.title')}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ fontSize: '14px' }}>
            {i18n.t('home.subtitle')}
          </Typography>
        </Box>
      </Box>

      {/* Cartes séparées pour météo, température, humidité, présence et appareils en ligne */}
      {loading ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={2} sx={{ mb: 4, alignItems: 'stretch' }}>
          {/* Carte Météo */}
          <Grid item xs={12} sm={6} md="auto" sx={{ display: 'flex' }}>
            <Card
              sx={{
                backgroundColor: '#FFFFFF',
                border: 'none',
                borderRadius: 1,
                boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                p: 2,
                minWidth: { xs: '100%', sm: '200px' },
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Box sx={{ mb: 1 }}>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 500,
                    fontSize: '0.75rem',
                    color: 'text.secondary',
                  }}
                >
                  {settings?.city ? `Météo ${settings.city}` : 'Météo'}
                </Typography>
              </Box>
              <WeatherInline />
            </Card>
          </Grid>

          {/* Carte Température moyenne */}
          {houseStats.temperature !== null && (
            <Grid item xs={12} sm={6} md="auto" sx={{ display: 'flex' }}>
              <Card
                sx={{
                  backgroundColor: '#FFFFFF',
                  border: 'none',
                  borderRadius: 1,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                  p: 2,
                  minWidth: { xs: '100%', sm: '150px' },
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      color: '#C4A5A5',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <ThermostatIcon sx={{ fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography
                      variant="body1"
                      sx={{
                        fontWeight: 500,
                        color: '#C4A5A5',
                        fontSize: '0.95rem',
                      }}
                    >
                      {houseStats.temperature.toFixed(1)}°C
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'text.secondary',
                        fontSize: '0.7rem',
                      }}
                    >
                      {i18n.t('home.temperature')}
                    </Typography>
                  </Box>
                </Box>
              </Card>
            </Grid>
          )}

          {/* Carte Humidité moyenne */}
          {houseStats.humidity !== null && (
            <Grid item xs={12} sm={6} md="auto" sx={{ display: 'flex' }}>
              <Card
                sx={{
                  backgroundColor: '#FFFFFF',
                  border: 'none',
                  borderRadius: 1,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                  p: 2,
                  minWidth: { xs: '100%', sm: '150px' },
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      color: '#86A6A0',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <WaterDropIcon sx={{ fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography
                      variant="body1"
                      sx={{
                        fontWeight: 500,
                        color: '#86A6A0',
                        fontSize: '0.95rem',
                      }}
                    >
                      {Math.round(houseStats.humidity)}%
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'text.secondary',
                        fontSize: '0.7rem',
                      }}
                    >
                      {i18n.t('home.humidity')}
                    </Typography>
                  </Box>
                </Box>
              </Card>
            </Grid>
          )}

          {/* Carte Présence */}
          <Grid item xs={12} sm={6} md="auto" sx={{ display: 'flex' }}>
            <Card
              sx={{
                backgroundColor: '#FFFFFF',
                border: 'none',
                borderRadius: 1,
                boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                p: 2,
                minWidth: { xs: '100%', sm: '150px' },
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    color: houseStats.presence ? '#2e7d32' : '#9e9e9e',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <PersonPinCircleIcon sx={{ fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography
                    variant="body1"
                    sx={{
                      fontWeight: 500,
                      color: houseStats.presence ? '#2e7d32' : '#9e9e9e',
                      fontSize: '0.95rem',
                    }}
                  >
                    {houseStats.presence ? i18n.t('devices.detected') : i18n.t('devices.none')}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                      fontSize: '0.7rem',
                    }}
                  >
                    {i18n.t('devices.presence')}
                  </Typography>
                </Box>
              </Box>
            </Card>
          </Grid>

          {/* Carte Nombre d'appareils en ligne */}
          <Grid item xs={12} sm={6} md="auto" sx={{ display: 'flex' }}>
            <Card
              sx={{
                backgroundColor: '#FFFFFF',
                border: 'none',
                borderRadius: 1,
                boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                p: 2,
                minWidth: { xs: '100%', sm: '150px' },
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    color: '#86A6A0',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <DevicesIcon sx={{ fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography
                    variant="body1"
                    sx={{
                      fontWeight: 500,
                      color: '#86A6A0',
                      fontSize: '0.95rem',
                    }}
                  >
                    {stats?.online.toString() || '0'}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                      fontSize: '0.7rem',
                    }}
                  >
                    {i18n.t('home.onlineDevices')}
                  </Typography>
                </Box>
              </Box>
            </Card>
          </Grid>
        </Grid>
      )}

      <Grid container spacing={3} sx={{ mb: 4 }}>
          {loading ? (
            <Grid item xs={12} sx={{ textAlign: 'center', py: 4 }}>
              <CircularProgress />
            </Grid>
          ) : (
            <>

              {/* Widgets des plugins */}
              {pluginWidgets.map((widget) => (
                <PluginWidgetLoader
                  key={widget.id}
                  extension={widget}
                  xs={12}
                  sm={6}
                  md={4}
                  lg={3}
                />
              ))}

              {/* Cartes par pièce - Chaque pièce affiche ses appareils en grille */}
              {Object.entries(devicesByRoom).map(([roomName, roomDevices]) => (
                  <RoomCard
                  key={roomName}
                    roomName={roomName}
                    devices={roomDevices}
                    onDeviceUpdate={() => {
                      // Les mises à jour sont gérées automatiquement par useDevices via WebSocket
                    }}
                  />
              ))}

              {/* Aucune pièce avec appareils */}
              {Object.keys(devicesByRoom).length === 0 && (
                <Grid item xs={12}>
                  <Card
                    sx={{
                      backgroundColor: '#FFFFFF',
                      border: 'none',
                      borderRadius: 1,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                      p: 4,
                      textAlign: 'center',
                    }}
                  >
                    <Typography variant="body1" color="text.secondary">
                      {i18n.t('home.noRoomsWithDevices')}
                    </Typography>
                  </Card>
                </Grid>
              )}
            </>
          )}
        </Grid>
  </Box>
  );
}

