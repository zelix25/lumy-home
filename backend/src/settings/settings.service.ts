import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Settings } from './entities/settings.entity';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { LoggerService } from '../logger/logger.service';
import { WeatherService } from '../weather/weather.service';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Settings)
    private readonly settingsRepository: Repository<Settings>,
    private readonly logger: LoggerService,
    @Inject(forwardRef(() => WeatherService))
    private readonly weatherService: WeatherService,
  ) {}

  /**
   * Récupère les paramètres (crée les paramètres par défaut s'ils n'existent pas)
   */
  async getSettings(): Promise<Settings> {
    const [settings] = await this.settingsRepository.find({
      order: { updatedAt: 'DESC' },
      take: 1,
    });

    if (!settings) {
      // Créer les paramètres par défaut
      const defaultSettings = this.settingsRepository.create({
        logout_delay: 0,
        hostname: '',
        setup: false,
        city: null,
        zipCode: null,
        country: null,
        latitude: null,
        longitude: null,
      } as Partial<Settings>);
      const saved = await this.settingsRepository.save(defaultSettings);
      this.logger.log('Paramètres par défaut créés', 'SettingsService');
      return saved;
    }

    return settings;
  }

  /**
   * Convertit une adresse en coordonnées GPS (géocodage)
   */
  private async geocodeAddress(
    city?: string,
    zipCode?: string,
    country?: string,
  ): Promise<{ latitude: number; longitude: number } | null> {
    // Construire l'adresse à partir des informations disponibles
    const addressParts: string[] = [];
    if (zipCode) addressParts.push(zipCode);
    if (city) addressParts.push(city);
    if (country) addressParts.push(country);

    if (addressParts.length === 0) {
      return null;
    }

    const address = addressParts.join(', ');

    try {
      // Utiliser l'API Nominatim (OpenStreetMap) - gratuite et sans clé API
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
      
      this.logger.log(`Géocodage de l'adresse: ${address}`, 'SettingsService');
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'LumyHome/1.0', // Nominatim exige un User-Agent
        },
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const data = await response.json();

      if (data && data.length > 0) {
        const result = data[0];
        const latitude = parseFloat(result.lat);
        const longitude = parseFloat(result.lon);

        this.logger.log(
          `Coordonnées trouvées: ${latitude}, ${longitude} pour ${address}`,
          'SettingsService',
        );

        return { latitude, longitude };
      } else {
        this.logger.warn(`Aucun résultat trouvé pour l'adresse: ${address}`, 'SettingsService');
        return null;
      }
    } catch (error) {
      this.logger.error(
        `Erreur lors du géocodage de l'adresse ${address}: ${error.message}`,
        error.stack,
        'SettingsService',
      );
      return null;
    }
  }

  /**
   * Met à jour les paramètres
   */
  async updateSettings(dto: UpdateSettingsDto): Promise<Settings> {
    const [existingSettings] = await this.settingsRepository.find({
      order: { updatedAt: 'DESC' },
      take: 1,
    });

    // Si les coordonnées ne sont pas fournies mais que l'adresse est modifiée, faire le géocodage
    if (
      (dto.city !== undefined || dto.zipCode !== undefined || dto.country !== undefined) &&
      (dto.latitude === undefined && dto.longitude === undefined)
    ) {
      const city = dto.city ?? existingSettings?.city ?? undefined;
      const zipCode = dto.zipCode ?? existingSettings?.zipCode ?? undefined;
      const country = dto.country ?? existingSettings?.country ?? undefined;

      const coordinates = await this.geocodeAddress(city, zipCode, country);
      if (coordinates) {
        dto.latitude = coordinates.latitude;
        dto.longitude = coordinates.longitude;
      }
    }

    // Vérifier si les coordonnées de localisation ont été modifiées ou ajoutées
    const locationChanged =
      (dto.city !== undefined && dto.city !== existingSettings?.city) ||
      (dto.zipCode !== undefined && dto.zipCode !== existingSettings?.zipCode) ||
      (dto.country !== undefined && dto.country !== existingSettings?.country) ||
      (dto.latitude !== undefined && dto.latitude !== existingSettings?.latitude) ||
      (dto.longitude !== undefined && dto.longitude !== existingSettings?.longitude);

    if (existingSettings) {
      // Mettre à jour les paramètres existants
      Object.assign(existingSettings, dto);
      const saved = await this.settingsRepository.save(existingSettings);
      this.logger.log('Paramètres mis à jour', 'SettingsService');

      // Si la localisation a été modifiée et que les coordonnées sont disponibles, mettre à jour la météo
      if (locationChanged && saved.latitude && saved.longitude) {
        this.logger.log(
          'Localisation modifiée, mise à jour de la météo en cours...',
          'SettingsService',
        );
        try {
          await this.weatherService.updateWeather();
          this.logger.log('✓ Météo mise à jour avec succès après modification de la localisation', 'SettingsService');
        } catch (error) {
          this.logger.error(
            `Erreur lors de la mise à jour de la météo: ${error.message}`,
            error.stack,
            'SettingsService',
          );
        }
      }

      return saved;
    }

    // Créer de nouveaux paramètres
    const newSettings = this.settingsRepository.create({
      logout_delay: dto.logout_delay ?? 0,
      hostname: dto.hostname ?? '',
      setup: dto.setup ?? false,
      city: dto.city ?? null,
      zipCode: dto.zipCode ?? null,
      country: dto.country ?? null,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
    } as Partial<Settings>);
    const saved = await this.settingsRepository.save(newSettings);
    this.logger.log('Paramètres créés', 'SettingsService');

    // Si les coordonnées sont disponibles, mettre à jour la météo
    if (saved.latitude && saved.longitude) {
      this.logger.log(
        'Nouvelle localisation configurée, mise à jour de la météo en cours...',
        'SettingsService',
      );
      try {
        await this.weatherService.updateWeather();
        this.logger.log('✓ Météo mise à jour avec succès après configuration de la localisation', 'SettingsService');
      } catch (error) {
        this.logger.error(
          `Erreur lors de la mise à jour de la météo: ${error.message}`,
          error.stack,
          'SettingsService',
        );
      }
    }

    return saved;
  }

  /**
   * Récupère une valeur de paramètre spécifique
   */
  async getSettingValue<K extends keyof Settings>(
    key: K,
  ): Promise<Settings[K]> {
    const settings = await this.getSettings();
    return settings[key];
  }
}

