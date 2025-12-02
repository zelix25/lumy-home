import { Box, Typography, Grid, Card, CardContent, CircularProgress, ToggleButton, ToggleButtonGroup, Paper } from '@mui/material';
import DevicesIcon from '@mui/icons-material/Devices';
import SceneIcon from '@mui/icons-material/AutoAwesome';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import MapIcon from '@mui/icons-material/Map';
import { useEffect, useState, useMemo } from 'react';
import { devicesService, DeviceStats, Device } from '../services/devices.service';
import { useDevices } from '../hooks/useDevices';
import PlanViewMode from '../components/PlanViewMode';
import RoomCard from '../components/RoomCard';
import i18n from '@/i18n';

export default function HomePage() {
  const [stats, setStats] = useState<DeviceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { devices } = useDevices();
  const [viewMode, setViewMode] = useState<'normal' | 'plan'>('normal');

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

    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Rafraîchir toutes les 30 secondes

    return () => clearInterval(interval);
  }, []);

  const displayStats = [
    {
      title: i18n.t('home.totalDevices'),
      value: stats?.total.toString() || '0',
      icon: <DevicesIcon sx={{ fontSize: 40 }} />,
      color: '#86A6A0', // Vert-gris nordique
    },
    {
      title: i18n.t('home.onlineDevices'),
      value: stats?.online.toString() || '0',
      icon: <DevicesIcon sx={{ fontSize: 40 }} />,
      color: '#86A6A0', // Vert-gris nordique
    },
    {
      title: i18n.t('home.scenesActive'),
      value: '0',
      icon: <SceneIcon sx={{ fontSize: 40 }} />,
      color: '#D0BFAE', // Bois clair
    },
  ];

  const handleViewModeChange = (_event: React.MouseEvent<HTMLElement>, newMode: 'normal' | 'plan' | null) => {
    if (newMode !== null) {
      setViewMode(newMode);
    }
  };

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
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={handleViewModeChange}
          aria-label="mode d'affichage"
          size="small"
        >
          <ToggleButton value="normal" aria-label="vue normale">
            <ViewModuleIcon sx={{ mr: 1, fontSize: 18 }} />
            {i18n.t('home.normalView')}
          </ToggleButton>
          <ToggleButton value="plan" aria-label="vue plan">
            <MapIcon sx={{ mr: 1, fontSize: 18 }} />
            {i18n.t('home.planView')}
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {viewMode === 'plan' ? (
        <Paper sx={{ p: 3 }}>
          <PlanViewMode devices={devices} />
        </Paper>
      ) : (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {loading ? (
            <Grid item xs={12} sx={{ textAlign: 'center', py: 4 }}>
              <CircularProgress />
            </Grid>
          ) : (
            <>
              {/* Statistiques globales */}
              {displayStats.map((stat, index) => (
                <Grid item xs={12} sm={6} md={4} key={index}>
                  <Card
                    sx={{
                      height: '100%',
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
                        <Box
                          sx={{
                            color: stat.color,
                            mr: 2,
                            p: 1.5,
                            borderRadius: 1,
                            backgroundColor: `${stat.color}15`,
                          }}
                        >
                          {stat.icon}
                        </Box>
                        <Typography variant="h3" sx={{ fontWeight: 500, color: stat.color }}>
                          {stat.value}
                        </Typography>
                      </Box>
                      <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 400 }}>
                        {stat.title}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}

              {/* Cartes par pièce */}
              {Object.entries(devicesByRoom).map(([roomName, roomDevices]) => (
                <Grid item xs={12} md={6} lg={4} key={roomName}>
                  <RoomCard
                    roomName={roomName}
                    devices={roomDevices}
                    onDeviceUpdate={() => {
                      // Les mises à jour sont gérées automatiquement par useDevices via WebSocket
                    }}
                  />
                </Grid>
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
      )}
    </Box>
  );
}

