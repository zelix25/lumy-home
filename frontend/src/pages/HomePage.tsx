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

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 500, mb: 1 }}>
          {i18n.t('home.title')}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ fontSize: '14px' }}>
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
                backgroundColor: '#FFFFFF',
                border: 'none',
                borderRadius: 8,
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
                      borderRadius: 8,
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
          ))
        )}
      </Grid>

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <HomeIcon sx={{ fontSize: 48, color: 'primary.main', mr: 2 }} />
            <Box>
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 500 }}>
                {i18n.t('home.title')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '14px' }}>
                {i18n.t('home.subtitle')}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

