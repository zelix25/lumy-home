import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  Chip,
  Stack,
} from '@mui/material';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import CloudIcon from '@mui/icons-material/Cloud';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import AirIcon from '@mui/icons-material/Air';

/**
 * Widget météo pour le dashboard
 * 
 * Ce composant est chargé dynamiquement par le système de plugins.
 * Il reçoit la configuration du plugin via les props.
 * 
 * @param {Object} props - Propriétés du composant
 * @param {Object} props.config - Configuration du plugin (apiKey, city, units, etc.)
 * @param {boolean} props.showForecast - Afficher les prévisions (défaut: true)
 * @param {boolean} props.compact - Mode compact (défaut: false)
 */
export default function WeatherWidget({ config = {}, showForecast = true, compact = false }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (config.apiKey && config.city) {
      fetchWeatherData();
      // Mettre à jour périodiquement
      const interval = setInterval(() => {
        fetchWeatherData();
      }, (config.updateInterval || 30) * 60 * 1000);

      return () => clearInterval(interval);
    } else {
      setError('Configuration incomplète : apiKey et city requis');
      setLoading(false);
    }
  }, [config]);

  const fetchWeatherData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Appel à l'API météo (exemple avec OpenWeatherMap)
      // En production, cela devrait passer par l'API Lumy Home pour la sécurité
      const city = config.city || 'Paris';
      const country = config.country || 'FR';
      const units = config.units || 'metric';
      const apiKey = config.apiKey;

      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${city},${country}&units=${units}&appid=${apiKey}&lang=fr`
      );

      if (!response.ok) {
        throw new Error(`Erreur API météo: ${response.statusText}`);
      }

      const data = await response.json();
      setWeather(data);
    } catch (err) {
      console.error('Erreur lors de la récupération de la météo:', err);
      setError(err.message || 'Erreur lors du chargement de la météo');
    } finally {
      setLoading(false);
    }
  };

  const getWeatherIcon = (main) => {
    switch (main?.toLowerCase()) {
      case 'clear':
        return <WbSunnyIcon sx={{ fontSize: 40, color: '#FFA500' }} />;
      case 'clouds':
        return <CloudIcon sx={{ fontSize: 40, color: '#808080' }} />;
      default:
        return <WbSunnyIcon sx={{ fontSize: 40 }} />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={100}>
            <CircularProgress size={24} />
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Typography color="error" variant="body2">
            {error}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Vérifiez votre configuration dans les paramètres du plugin
          </Typography>
        </CardContent>
      </Card>
    );
  }

  if (!weather) {
    return (
      <Card>
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            Aucune donnée météo disponible
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const temperature = Math.round(weather.main.temp);
  const feelsLike = Math.round(weather.main.feels_like);
  const humidity = weather.main.humidity;
  const windSpeed = weather.wind?.speed || 0;
  const description = weather.weather[0]?.description || '';
  const main = weather.weather[0]?.main || '';

  return (
    <Card
      sx={{
        height: '100%',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
      }}
    >
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box>
            <Typography variant="h6" gutterBottom>
              {config.city || 'Météo'}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              {description}
            </Typography>
          </Box>
          {getWeatherIcon(main)}
        </Box>

        <Box display="flex" alignItems="baseline" mb={2}>
          <Typography variant="h3" component="span" sx={{ fontWeight: 'bold' }}>
            {temperature}°
          </Typography>
          <Typography variant="body2" sx={{ ml: 1, opacity: 0.8 }}>
            Ressenti {feelsLike}°
          </Typography>
        </Box>

        {!compact && (
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Chip
              icon={<WaterDropIcon />}
              label={`${humidity}%`}
              size="small"
              sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
            />
            <Chip
              icon={<AirIcon />}
              label={`${windSpeed} km/h`}
              size="small"
              sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
            />
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

