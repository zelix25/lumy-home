import { Box, Typography, Grid, Card, CardContent, CircularProgress } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import DevicesIcon from '@mui/icons-material/Devices';
import SceneIcon from '@mui/icons-material/AutoAwesome';
import { useEffect, useState } from 'react';
import { devicesService, DeviceStats } from '../services/devices.service';
import i18n from '@/i18n';

export default function HomePage() {
  const [stats, setStats] = useState<DeviceStats | null>(null);
  const [loading, setLoading] = useState(true);

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
      color: '#667eea',
    },
    {
      title: i18n.t('home.onlineDevices'),
      value: stats?.online.toString() || '0',
      icon: <DevicesIcon sx={{ fontSize: 40 }} />,
      color: '#48bb78',
    },
    {
      title: i18n.t('home.scenesActive'),
      value: '0',
      icon: <SceneIcon sx={{ fontSize: 40 }} />,
      color: '#764ba2',
    },
  ];

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, mb: 1 }}>
          {i18n.t('home.title')}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {i18n.t('home.subtitle')}
        </Typography>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {loading ? (
          <Grid item xs={12} sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress />
          </Grid>
        ) : (
          displayStats.map((stat, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <Card
              sx={{
                height: '100%',
                background: `linear-gradient(135deg, ${stat.color}15 0%, ${stat.color}05 100%)`,
                border: `1px solid ${stat.color}30`,
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Box
                    sx={{
                      color: stat.color,
                      mr: 2,
                      p: 1.5,
                      borderRadius: 2,
                      backgroundColor: `${stat.color}15`,
                    }}
                  >
                    {stat.icon}
                  </Box>
                  <Typography variant="h3" sx={{ fontWeight: 700, color: stat.color }}>
                    {stat.value}
                  </Typography>
                </Box>
                <Typography variant="h6" color="text.secondary">
                  {stat.title}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          ))
        )}
      </Grid>

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <HomeIcon sx={{ fontSize: 48, color: 'primary.main', mr: 2 }} />
            <Box>
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
                {i18n.t('home.title')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {i18n.t('home.subtitle')}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

