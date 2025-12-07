import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Weather } from './entities/weather.entity';
import { SettingsService } from '../settings/settings.service';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class WeatherService implements OnModuleInit {
  constructor(
    @InjectRepository(Weather)
    private readonly weatherRepository: Repository<Weather>,
    private readonly settingsService: SettingsService,
    private readonly logger: LoggerService,
  ) {}

  async onModuleInit() {
    this.logger.log('=== INITIALISATION DU MODULE MÉTÉO ===', 'WeatherService');
    // Ajouter un petit délai pour s'assurer que SettingsModule est bien initialisé
    await new Promise((resolve) => setTimeout(resolve, 2000));
    try {
      this.logger.log('Démarrage de la mise à jour de la météo...', 'WeatherService');
      await this.updateWeather();
      this.logger.log('✓ Météo mise à jour au démarrage avec succès', 'WeatherService');
    } catch (error) {
      this.logger.error(
        `✗ Erreur lors de la mise à jour de la météo au démarrage: ${error.message}`,
        error.stack,
        'WeatherService',
      );
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async handleCron() {
    this.logger.log('=== MISE À JOUR HORAIRE DE LA MÉTÉO ===', 'WeatherService');
    try {
      await this.updateWeather();
      this.logger.log('✓ Météo mise à jour avec succès (cron horaire)', 'WeatherService');
    } catch (error) {
      this.logger.error(
        `✗ Erreur lors de la mise à jour horaire de la météo: ${error.message}`,
        error.stack,
        'WeatherService',
      );
    }
  }

  /**
   * Met à jour les données météo depuis l'API Open-Meteo
   */
  async updateWeather(): Promise<void> {
    try {
      // Récupérer les coordonnées depuis les paramètres
      const settings = await this.settingsService.getSettings();

      if (!settings.latitude || !settings.longitude) {
        this.logger.warn(
          '⚠ Coordonnées GPS non configurées dans les paramètres. Impossible de récupérer les données météo.',
          'WeatherService',
        );
        this.logger.warn(
          `Ville: ${settings.city || 'non définie'}, Code postal: ${settings.zipCode || 'non défini'}, Pays: ${settings.country || 'non défini'}`,
          'WeatherService',
        );
        return;
      }

      const latitude = settings.latitude;
      const longitude = settings.longitude;

      this.logger.log(
        `📍 Récupération des données météo pour les coordonnées: ${latitude}, ${longitude}`,
        'WeatherService',
      );

      // Construire l'URL de l'API Open-Meteo
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.searchParams.append('latitude', latitude.toString());
      url.searchParams.append('longitude', longitude.toString());
      url.searchParams.append('daily', 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum');
      url.searchParams.append('hourly', 'temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code');
      url.searchParams.append('timezone', 'auto');
      url.searchParams.append('forecast_days', '7');

      this.logger.log(`🌐 Appel API Open-Meteo: ${url.toString()}`, 'WeatherService');

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.daily || !data.hourly) {
        throw new Error('Format de réponse API invalide');
      }

      this.logger.log('✓ Données météo récupérées avec succès depuis l\'API', 'WeatherService');

      // Traiter les données quotidiennes
      const dailyData = data.daily;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (let i = 0; i < dailyData.time.length; i++) {
        const dateStr = dailyData.time[i];
        const date = new Date(dateStr);
        date.setHours(0, 0, 0, 0);

        // Extraire l'heure de lever/coucher du soleil
        const sunriseStr = dailyData.sunrise?.[i];
        const sunsetStr = dailyData.sunset?.[i];
        const sunrise = sunriseStr ? this.extractTime(sunriseStr) : null;
        const sunset = sunsetStr ? this.extractTime(sunsetStr) : null;

        // Température moyenne (max + min) / 2
        const tempMax = dailyData.temperature_2m_max?.[i] ?? null;
        const tempMin = dailyData.temperature_2m_min?.[i] ?? null;
        const temperature_2m = tempMax !== null && tempMin !== null ? (tempMax + tempMin) / 2 : null;

        // Précipitations
        const precipitation = dailyData.precipitation_sum?.[i] ?? null;

        // Code météo
        const weather_code = dailyData.weather_code?.[i] ?? null;

        // Récupérer les données horaires pour ce jour
        const hourlyForDay = this.getHourlyDataForDate(data.hourly, date);
        const relative_humidity_2m = hourlyForDay.humidity;
        const wind_speed_10m = hourlyForDay.windSpeed;

        // Vérifier si une entrée existe déjà
        const existing = await this.weatherRepository.findOne({
          where: {
            latitude,
            longitude,
            date,
          },
        });

        const weatherData = {
          latitude,
          longitude,
          date,
          sunrise,
          sunset,
          temperature_2m,
          relative_humidity_2m,
          wind_speed_10m,
          precipitation,
          weather_code,
          raw_data: JSON.stringify(data),
        };

        if (existing) {
          // Mettre à jour l'entrée existante
          Object.assign(existing, weatherData);
          await this.weatherRepository.save(existing);
          this.logger.log(`  ✓ Météo mise à jour pour ${dateStr}`, 'WeatherService');
        } else {
          // Créer une nouvelle entrée
          const newWeather = this.weatherRepository.create(weatherData);
          await this.weatherRepository.save(newWeather);
          this.logger.log(`  ✓ Météo créée pour ${dateStr}`, 'WeatherService');
        }
      }

      this.logger.log('✓ Toutes les données météo ont été enregistrées en base de données', 'WeatherService');
    } catch (error) {
      this.logger.error(
        `Erreur lors de la mise à jour de la météo: ${error.message}`,
        error.stack,
        'WeatherService',
      );
      throw error;
    }
  }

  /**
   * Extrait l'heure (HH:mm:ss) d'une chaîne datetime ISO
   */
  private extractTime(datetimeStr: string): string {
    const date = new Date(datetimeStr);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  /**
   * Récupère les données horaires moyennes pour une date donnée
   */
  private getHourlyDataForDate(hourlyData: any, date: Date): {
    humidity: number | null;
    windSpeed: number | null;
  } {
    const dateStr = date.toISOString().split('T')[0];
    const indices: number[] = [];

    // Trouver les indices correspondant à cette date
    for (let i = 0; i < hourlyData.time.length; i++) {
      if (hourlyData.time[i].startsWith(dateStr)) {
        indices.push(i);
      }
    }

    if (indices.length === 0) {
      return { humidity: null, windSpeed: null };
    }

    // Calculer les moyennes
    const humidities = indices
      .map((idx) => hourlyData.relative_humidity_2m?.[idx])
      .filter((val) => val !== null && val !== undefined);
    const windSpeeds = indices
      .map((idx) => hourlyData.wind_speed_10m?.[idx])
      .filter((val) => val !== null && val !== undefined);

    const avgHumidity =
      humidities.length > 0
        ? Math.round(humidities.reduce((a, b) => a + b, 0) / humidities.length)
        : null;
    const avgWindSpeed =
      windSpeeds.length > 0
        ? windSpeeds.reduce((a, b) => a + b, 0) / windSpeeds.length
        : null;

    return {
      humidity: avgHumidity,
      windSpeed: avgWindSpeed,
    };
  }

  /**
   * Récupère les données météo d'aujourd'hui
   */
  async getTodayWeather(): Promise<Weather | null> {
    const settings = await this.settingsService.getSettings();
    if (!settings.latitude || !settings.longitude) {
      return null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return await this.weatherRepository.findOne({
      where: {
        latitude: settings.latitude,
        longitude: settings.longitude,
        date: today,
      },
    });
  }

  /**
   * Récupère les données météo pour une date spécifique
   */
  async getWeatherByDate(date: Date): Promise<Weather | null> {
    const settings = await this.settingsService.getSettings();
    if (!settings.latitude || !settings.longitude) {
      return null;
    }

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    return await this.weatherRepository.findOne({
      where: {
        latitude: settings.latitude,
        longitude: settings.longitude,
        date: targetDate,
      },
    });
  }

  /**
   * Récupère l'historique météo
   */
  async getWeatherHistory(limit: number = 30): Promise<Weather[]> {
    const settings = await this.settingsService.getSettings();
    if (!settings.latitude || !settings.longitude) {
      return [];
    }

    return await this.weatherRepository.find({
      where: {
        latitude: settings.latitude,
        longitude: settings.longitude,
      },
      order: {
        date: 'DESC',
      },
      take: limit,
    });
  }
}

