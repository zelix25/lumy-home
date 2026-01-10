import { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, Chip } from '@mui/material';
import {
  WbSunny,
  Cloud,
  AcUnit,
  WaterDrop,
  Air,
  Opacity,
  Thermostat,
} from '@mui/icons-material';
import { weatherService, Weather } from '../services/weather.service';
import i18n from '@/i18n';

export default function WeatherInline() {
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
    if (code === null) return <Cloud sx={{ fontSize: 16 }} />;
    
    if (code === 0 || code === 1) return <WbSunny sx={{ fontSize: 16 }} />;
    if (code >= 2 && code <= 3) return <Cloud sx={{ fontSize: 16 }} />;
    if (code >= 45 && code <= 48) return <Cloud sx={{ fontSize: 16 }} />;
    if (code >= 51 && code <= 67) return <WaterDrop sx={{ fontSize: 16 }} />;
    if (code >= 71 && code <= 77) return <AcUnit sx={{ fontSize: 16 }} />;
    if (code >= 80 && code <= 99) return <WaterDrop sx={{ fontSize: 16 }} />;
    return <Cloud sx={{ fontSize: 16 }} />;
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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CircularProgress size={16} />
      </Box>
    );
  }

  if (!weather) {
    return null;
  }

  // Créer un tableau des données météo disponibles
  const weatherData = [
    {
      value: weather.temperature_2m !== null ? `${weather.temperature_2m.toFixed(1)}°C` : null,
      icon: <Thermostat sx={{ fontSize: 14 }} />,
      color: '#C4A5A5',
    },
    {
      value: weather.relative_humidity_2m !== null ? `${weather.relative_humidity_2m}%` : null,
      icon: <Opacity sx={{ fontSize: 14 }} />,
      color: '#86A6A0',
    },
    {
      value: weather.wind_speed_10m !== null ? `${weather.wind_speed_10m.toFixed(1)} ${i18n.t('weather.kmh')}` : null,
      icon: <Air sx={{ fontSize: 14 }} />,
      color: '#86A6A0',
    },
    {
      value: weather.precipitation !== null && weather.precipitation > 0 ? `${weather.precipitation.toFixed(1)} mm` : null,
      icon: <WaterDrop sx={{ fontSize: 14 }} />,
      color: '#86A6A0',
    },
  ].filter((item) => item.value !== null);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      {/* Icône météo et description */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mr: 0.5 }}>
        <Box sx={{ color: '#86A6A0', display: 'flex', alignItems: 'center' }}>
          {getWeatherIcon(weather.weather_code)}
        </Box>
        <Typography 
          variant="caption" 
          sx={{ 
            fontWeight: 500, 
            fontSize: '0.7rem',
            color: '#86A6A0',
          }}
        >
          {getWeatherDescription(weather.weather_code)}
        </Typography>
      </Box>

      {/* Badges météo compacts */}
      {weatherData.map((item, index) => (
        <Chip
          key={index}
          icon={
            <Box sx={{ color: item.color, display: 'flex', alignItems: 'center' }}>
              {item.icon}
            </Box>
          }
          label={
            <Typography
              variant="caption"
              sx={{
                fontWeight: 500,
                fontSize: '0.65rem',
                color: item.color,
                ml: 0.5,
              }}
            >
              {item.value}
            </Typography>
          }
          sx={{
            height: 22,
            backgroundColor: `${item.color}10`,
            border: `1px solid ${item.color}30`,
            borderRadius: 1,
            '& .MuiChip-icon': {
              marginLeft: '4px',
              marginRight: '-4px',
            },
            '& .MuiChip-label': {
              paddingLeft: '2px',
              paddingRight: '6px',
            },
          }}
        />
      ))}
    </Box>
  );
}
