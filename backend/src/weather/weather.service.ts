import { Injectable, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
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
    @Inject(forwardRef(() => SettingsService))
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

  @Cron(CronExpression.EVERY_10_MINUTES)
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

        // Utiliser upsert pour éviter les problèmes de concurrence
        // Cette méthode TypeORM est atomique et gère automatiquement l'insertion ou la mise à jour
        const dateStrForDB = date.toISOString().split('T')[0];
        const dateForDB = new Date(dateStrForDB + 'T00:00:00');
        
        this.logger.log(
          `  📅 Traitement de la date: ${dateStr} (format DB: ${dateStrForDB})`,
          'WeatherService',
        );

        // Utiliser upsert avec les champs de l'index unique comme critère de conflit
        // Cela évite les conditions de course (race conditions) et les erreurs UNIQUE constraint
        await this.weatherRepository.upsert(
          {
            latitude,
            longitude,
            date: dateForDB,
            sunrise,
            sunset,
            temperature_2m,
            relative_humidity_2m,
            wind_speed_10m,
            precipitation,
            weather_code,
            raw_data: JSON.stringify(data),
            updatedAt: new Date(),
          },
          {
            conflictPaths: ['latitude', 'longitude', 'date'],
          },
        );

        this.logger.log(`  ✓ Météo enregistrée pour ${dateStr} (${dateStrForDB})`, 'WeatherService');
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
    try {
      const settings = await this.settingsService.getSettings();
      
      if (!settings.latitude || !settings.longitude) {
        this.logger.warn(
          `⚠ Coordonnées GPS non configurées. Latitude: ${settings.latitude}, Longitude: ${settings.longitude}`,
          'WeatherService',
        );
        return null;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0]; // Format YYYY-MM-DD

      this.logger.log(
        `🔍 Recherche météo pour aujourd'hui (${todayStr}) aux coordonnées: ${settings.latitude}, ${settings.longitude}`,
        'WeatherService',
      );

      // SQLite stocke les dates comme des chaînes, utiliser une comparaison de chaînes
      // pour être sûr de trouver la bonne date
      let result = await this.weatherRepository
        .createQueryBuilder('weather')
        .where('weather.latitude = :latitude', { latitude: settings.latitude })
        .andWhere('weather.longitude = :longitude', { longitude: settings.longitude })
        .andWhere("DATE(weather.date) = :today", { today: todayStr })
        .getOne();
      
      // Si la première méthode ne fonctionne pas, essayer avec strftime
      if (!result) {
        result = await this.weatherRepository
          .createQueryBuilder('weather')
          .where('weather.latitude = :latitude', { latitude: settings.latitude })
          .andWhere('weather.longitude = :longitude', { longitude: settings.longitude })
          .andWhere("strftime('%Y-%m-%d', weather.date) = :today", { today: todayStr })
          .getOne();
      }
      
      // Si toujours rien, essayer avec TypeORM findOne (pour les cas où la date est stockée comme Date)
      if (!result) {
        const todayForDB = new Date(todayStr + 'T00:00:00');
        result = await this.weatherRepository.findOne({
          where: {
            latitude: settings.latitude,
            longitude: settings.longitude,
            date: todayForDB,
          },
        });
      }

      // Si pas trouvé avec la recherche directe, essayer avec une comparaison de chaînes
      if (!result) {
        this.logger.log(
          `⚠ Aucune donnée trouvée avec la recherche directe, tentative avec comparaison de chaînes`,
          'WeatherService',
        );
        
        // Récupérer toutes les données pour cette localisation et comparer manuellement
        const allWeatherForLocation = await this.weatherRepository.find({
          where: {
            latitude: settings.latitude,
            longitude: settings.longitude,
          },
        });

        this.logger.log(
          `🔍 ${allWeatherForLocation.length} enregistrement(s) météo trouvé(s) pour ces coordonnées`,
          'WeatherService',
        );

        // Comparer les dates en format string
        for (const weather of allWeatherForLocation) {
          const weatherDate: any = weather.date;
          let weatherDateStr: string;
          
          if (weatherDate instanceof Date) {
            weatherDateStr = weatherDate.toISOString().split('T')[0];
          } else if (typeof weatherDate === 'string') {
            weatherDateStr = weatherDate.split('T')[0].split(' ')[0];
          } else {
            weatherDateStr = String(weatherDate).split('T')[0].split(' ')[0];
          }

          this.logger.log(
            `  📅 Date en base: ${weatherDateStr} (recherche: ${todayStr})`,
            'WeatherService',
          );

          if (weatherDateStr === todayStr) {
            this.logger.log('✓ Données trouvées avec comparaison manuelle de dates', 'WeatherService');
            result = weather;
            break;
          }
        }
      }

      if (result) {
        const resultDate: any = result.date;
        let resultDateStr: string;
        if (resultDate instanceof Date) {
          resultDateStr = resultDate.toISOString().split('T')[0];
        } else if (typeof resultDate === 'string') {
          resultDateStr = resultDate.split('T')[0].split(' ')[0];
        } else {
          resultDateStr = String(resultDate).split('T')[0].split(' ')[0];
        }
        
        this.logger.log(
          `✓ Données météo trouvées pour ${resultDateStr}`,
          'WeatherService',
        );
        return result;
      }

      // Si aucune donnée pour aujourd'hui, retourner null (ne pas utiliser de fallback)
      this.logger.warn(
        `⚠ Aucune donnée météo trouvée pour aujourd'hui (${todayStr}). Vérifiez que la mise à jour météo a été exécutée.`,
        'WeatherService',
      );
      
      return null;
    } catch (error) {
      this.logger.error(
        `✗ Erreur lors de la récupération de la météo d'aujourd'hui: ${error.message}`,
        error.stack,
        'WeatherService',
      );
      return null;
    }
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

  /**
   * Récupère des informations de diagnostic
   */
  async getDebugInfo(): Promise<{
    hasCoordinates: boolean;
    coordinates: { latitude: number | null; longitude: number | null } | null;
    todayWeatherExists: boolean;
    totalWeatherRecords: number;
    lastWeatherDate: string | null;
    allDates: string[];
    todayStr: string;
  }> {
    const settings = await this.settingsService.getSettings();
    const hasCoordinates = !!(settings.latitude && settings.longitude);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    
    let todayWeatherExists = false;
    if (hasCoordinates) {
      const todayWeather = await this.getTodayWeather();
      todayWeatherExists = !!todayWeather;
    }

    // Récupérer toutes les données météo pour cette localisation
    const allWeather = hasCoordinates && settings.latitude && settings.longitude
      ? await this.weatherRepository.find({
          where: {
            latitude: settings.latitude,
            longitude: settings.longitude,
          },
          order: { date: 'DESC' },
        })
      : await this.weatherRepository.find({
          order: { date: 'DESC' },
          take: 10,
        });

    // Extraire toutes les dates disponibles
    const allDates: string[] = [];
    let lastWeatherDate: string | null = null;
    
    for (const weather of allWeather) {
      const dateValue: any = weather.date;
      let dateStr: string;
      
      if (dateValue instanceof Date) {
        dateStr = dateValue.toISOString().split('T')[0];
      } else if (typeof dateValue === 'string') {
        dateStr = dateValue.split('T')[0].split(' ')[0];
      } else {
        dateStr = String(dateValue).split('T')[0].split(' ')[0];
      }
      
      if (!allDates.includes(dateStr)) {
        allDates.push(dateStr);
      }
      
      if (!lastWeatherDate) {
        lastWeatherDate = dateStr;
      }
    }

    return {
      hasCoordinates,
      coordinates: hasCoordinates
        ? { latitude: settings.latitude, longitude: settings.longitude }
        : null,
      todayWeatherExists,
      totalWeatherRecords: await this.weatherRepository.count(),
      lastWeatherDate,
      allDates: allDates.sort().reverse(), // Plus récentes en premier
      todayStr,
    };
  }
}

