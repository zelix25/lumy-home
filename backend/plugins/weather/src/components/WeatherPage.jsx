import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  CircularProgress,
  Alert,
  TextField,
  Button,
  Stack,
  Chip,
  Divider,
} from '@mui/material';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import CloudIcon from '@mui/icons-material/Cloud';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import AirIcon from '@mui/icons-material/Air';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import VisibilityIcon from '@mui/icons-material/Visibility';

/**
 * Page météo complète avec prévisions
 * 
 * Ce composant est chargé dynamiquement par le système de plugins.
 * Il affiche la météo actuelle et les prévisions.
 * 
 * @param {Object} props - Propriétés du composant
 * @param {Object} props.config - Configuration du plugin
 */
export default function WeatherPage({ config = {} }) {
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchCity, setSearchCity] = useState(config.city || 'Paris');

  useEffect(() => {
    if (config.apiKey) {
      fetchWeatherData();
      fetchForecast();
    } else {
      setError('Clé API non configurée. Veuillez configurer le plugin dans les paramètres.');
      setLoading(false);
    }
  }, [config, searchCity]);

  const fetchWeatherData = async () => {
    if (!config.apiKey) return;

    try {
      setLoading(true);
      setError(null);

      const city = searchCity || config.city || 'Paris';
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

  const fetchForecast = async () => {
    if (!config.apiKey) return;

    try {
      const city = searchCity || config.city || 'Paris';
      const country = config.country || 'FR';
      const units = config.units || 'metric';
      const apiKey = config.apiKey;

      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?q=${city},${country}&units=${units}&appid=${apiKey}&lang=fr`
      );

      if (!response.ok) {
        throw new Error(`Erreur API prévisions: ${response.statusText}`);
      }

      const data = await response.json();
      setForecast(data);
    } catch (err) {
      console.error('Erreur lors de la récupération des prévisions:', err);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchWeatherData();
    fetchForecast();
  };

  const getWeatherIcon = (main, size = 60) => {
    switch (main?.toLowerCase()) {
      case 'clear':
        return <WbSunnyIcon sx={{ fontSize: size, color: '#FFA500' }} />;
      case 'clouds':
        return <CloudIcon sx={{ fontSize: size, color: '#808080' }} />;
      default:
        return <WbSunnyIcon sx={{ fontSize: size }} />;
    }
  };

  if (loading && !weather) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Météo
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Conditions météorologiques actuelles et prévisions
      </Typography>

      <Box component="form" onSubmit={handleSearch} sx={{ mb: 3 }}>
        <Stack direction="row" spacing={2}>
          <TextField
            label="Ville"
            value={searchCity}
            onChange={(e) => setSearchCity(e.target.value)}
            size="small"
            sx={{ flexGrow: 1 }}
          />
          <Button type="submit" variant="contained">
            Rechercher
          </Button>
        </Stack>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {weather && (
        <Grid container spacing={3}>
          {/* Météo actuelle */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3}>
                  <Box>
                    <Typography variant="h5" gutterBottom>
                      {weather.name}, {weather.sys?.country}
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      {new Date().toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </Typography>
                  </Box>
                  {getWeatherIcon(weather.weather[0]?.main)}
                </Box>

                <Box display="flex" alignItems="baseline" mb={3}>
                  <Typography variant="h2" component="span" sx={{ fontWeight: 'bold' }}>
                    {Math.round(weather.main.temp)}°
                  </Typography>
                  <Typography variant="h6" color="text.secondary" sx={{ ml: 2 }}>
                    {weather.weather[0]?.description}
                  </Typography>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <ThermostatIcon color="action" />
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Ressenti
                        </Typography>
                        <Typography variant="body1" fontWeight="bold">
                          {Math.round(weather.main.feels_like)}°
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <WaterDropIcon color="action" />
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Humidité
                        </Typography>
                        <Typography variant="body1" fontWeight="bold">
                          {weather.main.humidity}%
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <AirIcon color="action" />
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Vent
                        </Typography>
                        <Typography variant="body1" fontWeight="bold">
                          {weather.wind?.speed || 0} km/h
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <VisibilityIcon color="action" />
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Visibilité
                        </Typography>
                        <Typography variant="body1" fontWeight="bold">
                          {(weather.visibility / 1000).toFixed(1)} km
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Détails supplémentaires */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Détails
                </Typography>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Pression
                    </Typography>
                    <Typography variant="body1">
                      {weather.main.pressure} hPa
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Température min/max
                    </Typography>
                    <Typography variant="body1">
                      {Math.round(weather.main.temp_min)}° / {Math.round(weather.main.temp_max)}°
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Lever du soleil
                    </Typography>
                    <Typography variant="body1">
                      {new Date(weather.sys.sunrise * 1000).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Coucher du soleil
                    </Typography>
                    <Typography variant="body1">
                      {new Date(weather.sys.sunset * 1000).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Prévisions */}
          {forecast && forecast.list && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Prévisions (5 jours)
                  </Typography>
                  <Grid container spacing={2}>
                    {forecast.list.slice(0, 8).map((item, index) => (
                      <Grid item xs={6} sm={4} md={3} key={index}>
                        <Box textAlign="center">
                          <Typography variant="caption" color="text.secondary">
                            {new Date(item.dt * 1000).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Typography>
                          <Box my={1}>
                            {getWeatherIcon(item.weather[0]?.main, 40)}
                          </Box>
                          <Typography variant="body1" fontWeight="bold">
                            {Math.round(item.main.temp)}°
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.weather[0]?.description}
                          </Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      )}
    </Box>
  );
}

