import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  CircularProgress,
  Grid,
} from '@mui/material';
import {
  WbSunny,
  Cloud,
  AcUnit,
  WaterDrop,
  Air,
  Opacity,
  Thunderstorm,
  Thermostat,
} from '@mui/icons-material';
import { weatherService, Weather } from '../services/weather.service';
import i18n from '@/i18n';

// Styles d'animation globaux
const animationStyles = `
  @keyframes weatherRotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes weatherFloat {
    0%, 100% { transform: translateX(0px) translateY(0px); }
    50% { transform: translateX(-10px) translateY(-5px); }
  }
  @keyframes weatherRain {
    0% { transform: translateY(0px); opacity: 1; }
    100% { transform: translateY(60px); opacity: 0; }
  }
  @keyframes weatherSnow {
    0% { transform: translateY(0px) rotate(0deg); opacity: 1; }
    100% { transform: translateY(60px) rotate(360deg); opacity: 0; }
  }
  @keyframes weatherFlash {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 0.8; }
  }
  .weather-rotate {
    animation: weatherRotate 20s linear infinite;
  }
  .weather-float {
    animation: weatherFloat 6s ease-in-out infinite;
  }
  .weather-rain {
    animation: weatherRain 1.5s linear infinite;
  }
  .weather-snow {
    animation: weatherSnow 2s linear infinite;
  }
  .weather-flash {
    animation: weatherFlash 2s ease-in-out infinite;
  }
`;

// Injecter les styles dans le document
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = animationStyles;
  if (!document.head.querySelector('style[data-weather-animations]')) {
    styleSheet.setAttribute('data-weather-animations', 'true');
    document.head.appendChild(styleSheet);
  }
}

export default function WeatherCard() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        setLoading(true);
        const data = await weatherService.getTodayWeather();
        setWeather(data);
      } catch (error) {
        console.error('Erreur lors du chargement de la météo:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
    // Rafraîchir toutes les heures
    const interval = setInterval(fetchWeather, 3600000);

    return () => clearInterval(interval);
  }, []);

  const getWeatherIcon = (code: number | null) => {
    if (code === null) return <Cloud />;
    
    // Codes météo WMO (World Meteorological Organization)
    // 0-2: Clear, 3: Partly cloudy, 45-48: Fog, 51-67: Drizzle/Rain, 71-77: Snow, 80-99: Rain/Thunderstorm
    if (code === 0 || code === 1) return <WbSunny />;
    if (code >= 2 && code <= 3) return <Cloud />;
    if (code >= 45 && code <= 48) return <Cloud />;
    if (code >= 51 && code <= 67) return <WaterDrop />;
    if (code >= 71 && code <= 77) return <AcUnit />;
    if (code >= 80 && code <= 99) return <WaterDrop />;
    return <Cloud />;
  };

  const getWeatherDescription = (code: number | null): string => {
    if (code === null) return i18n.t('weather.unknown');
    
    if (code === 0) return i18n.t('weather.clear');
    if (code === 1) return i18n.t('weather.mostlyClear');
    if (code === 2) return i18n.t('weather.partlyCloudy');
    if (code === 3) return i18n.t('weather.overcast');
    if (code >= 45 && code <= 48) return i18n.t('weather.foggy');
    if (code >= 51 && code <= 67) return i18n.t('weather.rainy');
    if (code >= 71 && code <= 77) return i18n.t('weather.snowy');
    if (code >= 80 && code <= 99) return i18n.t('weather.stormy');
    return i18n.t('weather.unknown');
  };

  const getWeatherAnimation = (code: number | null) => {
    if (code === null) return null;

    // Soleil (0-1) : rotation
    if (code === 0 || code === 1) {
      return (
        <Box
          className="weather-rotate"
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
          }}
        >
          <WbSunny sx={{ fontSize: 48, color: '#FFA726', opacity: 0.3 }} />
        </Box>
      );
    }

    // Nuages (2-3, 45-48) : mouvement horizontal
    if ((code >= 2 && code <= 3) || (code >= 45 && code <= 48)) {
      return (
        <Box
          className="weather-float"
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
          }}
        >
          <Cloud sx={{ fontSize: 48, color: '#9E9E9E', opacity: 0.3 }} />
        </Box>
      );
    }

    // Pluie (51-67, 80-82) : gouttes qui tombent
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
      return (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 48,
            height: 48,
            overflow: 'hidden',
          }}
        >
          {[...Array(3)].map((_, i) => (
            <Box
              key={i}
              className="weather-rain"
              sx={{
                position: 'absolute',
                left: `${20 + i * 12}px`,
                top: '-10px',
                animationDelay: `${i * 0.3}s`,
                animationDuration: `${1.5 + i * 0.2}s`,
              }}
            >
              <WaterDrop sx={{ fontSize: 16, color: '#64B5F6', opacity: 0.6 }} />
            </Box>
          ))}
        </Box>
      );
    }

    // Neige (71-77) : flocons qui tombent
    if (code >= 71 && code <= 77) {
      return (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 48,
            height: 48,
            overflow: 'hidden',
          }}
        >
          {[...Array(4)].map((_, i) => (
            <Box
              key={i}
              className="weather-snow"
              sx={{
                position: 'absolute',
                left: `${10 + i * 10}px`,
                top: '-10px',
                animationDelay: `${i * 0.4}s`,
                animationDuration: `${2 + i * 0.3}s`,
              }}
            >
              <AcUnit sx={{ fontSize: 14, color: '#BBDEFB', opacity: 0.7 }} />
            </Box>
          ))}
        </Box>
      );
    }

    // Orage (95-99) : éclairs
    if (code >= 95 && code <= 99) {
      return (
        <Box
          className="weather-flash"
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
          }}
        >
          <Thunderstorm sx={{ fontSize: 48, color: '#FFC107', opacity: 0.4 }} />
        </Box>
      );
    }

    // Pluie forte / Orage (83-94) : pluie + éclairs
    if (code >= 83 && code <= 94) {
      return (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 48,
            height: 48,
            overflow: 'hidden',
          }}
        >
          {[...Array(4)].map((_, i) => (
            <Box
              key={i}
              className="weather-rain"
              sx={{
                position: 'absolute',
                left: `${15 + i * 8}px`,
                top: '-10px',
                animationDelay: `${i * 0.2}s`,
                animationDuration: `${1 + i * 0.15}s`,
              }}
            >
              <WaterDrop sx={{ fontSize: 18, color: '#42A5F5', opacity: 0.7 }} />
            </Box>
          ))}
          <Box
            className="weather-flash"
            sx={{
              position: 'absolute',
              top: 10,
              right: 10,
            }}
          >
            <Thunderstorm sx={{ fontSize: 32, color: '#FFC107', opacity: 0.5 }} />
          </Box>
        </Box>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <Grid container spacing={2}>
        {[1, 2, 3, 4].map((i) => (
          <Grid item xs={6} sm={3} key={i}>
            <Card
              sx={{
                height: '100%',
                backgroundColor: '#FFFFFF',
                border: 'none',
                borderRadius: 1,
                boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
              }}
            >
              <CardContent sx={{ p: 2, textAlign: 'center' }}>
                <CircularProgress size={24} />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  }

  if (!weather) {
    return (
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Card
            sx={{
              height: '100%',
              backgroundColor: '#FFFFFF',
              border: 'none',
              borderRadius: 1,
              boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
            }}
          >
            <CardContent sx={{ p: 2 }}>
              <Typography 
                variant="body2" 
                color="text.secondary"
                sx={{ whiteSpace: 'pre-line' }}
              >
                {i18n.t('weather.noData')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  }

  return (
    <Grid container spacing={2}>
      {/* Carte principale - Condition météo */}
      <Grid item xs={6} sm={3}>
        <Card
          sx={{
            height: '100%',
            backgroundColor: '#FFFFFF',
            border: 'none',
            borderRadius: 1,
            boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
            transition: 'all 0.15s ease-in-out',
            position: 'relative',
            overflow: 'hidden',
            '&:hover': {
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            },
          }}
        >
          {/* Animation météo en haut à droite */}
          {getWeatherAnimation(weather.weather_code)}
          
          <CardContent sx={{ p: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Box
                sx={{
                  color: '#86A6A0',
                  mr: 1,
                  p: 0.75,
                  borderRadius: 1,
                  backgroundColor: '#86A6A015',
                }}
              >
                {getWeatherIcon(weather.weather_code)}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.75rem' }}>
                  {i18n.t('weather.title')}
                </Typography>
              </Box>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
              {getWeatherDescription(weather.weather_code)}
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* Carte température */}
      {weather.temperature_2m !== null && (
        <Grid item xs={6} sm={3}>
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
            <CardContent sx={{ p: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Box
                  sx={{
                    color: '#C4A5A5',
                    mr: 1,
                    p: 0.75,
                    borderRadius: 1,
                    backgroundColor: '#C4A5A515',
                  }}
                >
                  <Thermostat sx={{ fontSize: 20 }} />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  {i18n.t('devices.temperature')}
                </Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 500, color: '#C4A5A5' }}>
                {weather.temperature_2m.toFixed(1)}°C
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* Carte humidité */}
      {weather.relative_humidity_2m !== null && (
        <Grid item xs={6} sm={3}>
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
            <CardContent sx={{ p: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Box
                  sx={{
                    color: '#86A6A0',
                    mr: 1,
                    p: 0.75,
                    borderRadius: 1,
                    backgroundColor: '#86A6A015',
                  }}
                >
                  <Opacity sx={{ fontSize: 20 }} />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  {i18n.t('devices.humidity')}
                </Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 500, color: '#86A6A0' }}>
                {weather.relative_humidity_2m}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* Carte vent */}
      {weather.wind_speed_10m !== null && (
        <Grid item xs={6} sm={3}>
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
            <CardContent sx={{ p: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Box
                  sx={{
                    color: '#86A6A0',
                    mr: 1,
                    p: 0.75,
                    borderRadius: 1,
                    backgroundColor: '#86A6A015',
                  }}
                >
                  <Air sx={{ fontSize: 20 }} />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  {i18n.t('weather.windSpeed')}
                </Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 500, color: '#86A6A0' }}>
                {weather.wind_speed_10m.toFixed(1)} {i18n.t('weather.kmh')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* Carte précipitations */}
      {weather.precipitation !== null && weather.precipitation > 0 && (
        <Grid item xs={6} sm={3}>
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
            <CardContent sx={{ p: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Box
                  sx={{
                    color: '#86A6A0',
                    mr: 1,
                    p: 0.75,
                    borderRadius: 1,
                    backgroundColor: '#86A6A015',
                  }}
                >
                  <WaterDrop sx={{ fontSize: 20 }} />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  {i18n.t('weather.precipitation')}
                </Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 500, color: '#86A6A0' }}>
                {weather.precipitation.toFixed(1)} mm
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      )}
    </Grid>
  );
}

