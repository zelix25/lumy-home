import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { Settings } from './entities/settings.entity';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { LoggerService } from '../logger/logger.service';
import { WeatherService } from '../weather/weather.service';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Settings)
    private readonly settingsRepository: Repository<Settings>,
    private readonly configService: ConfigService,
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
        setup: true,
        city: null,
        zipCode: null,
        country: null,
        latitude: null,
        longitude: null,
        timezone: 'Europe/Paris',
        boxId: null,
      } as Partial<Settings>);
      const saved = await this.settingsRepository.save(defaultSettings);
      this.logger.log('Paramètres par défaut créés', 'SettingsService');
      return this.syncBoxIdFromBackendEnv(saved);
    }

    return this.syncBoxIdFromBackendEnv(settings);
  }

  /**
   * Synchronise `settings.boxId` depuis `BOX_ID` (fichier `.env` backend).
   * Ne modifie la base que si `BOX_ID` est défini et différent de la valeur actuelle.
   */
  async syncBoxIdFromBackendEnv(settings?: Settings): Promise<Settings> {
    const target = settings ?? (await this.getSettings());
    const envBoxId = this.configService.get<string>('BOX_ID')?.trim();

    if (!envBoxId) {
      return target;
    }

    if (target.boxId === envBoxId) {
      return target;
    }

    target.boxId = envBoxId;
    const saved = await this.settingsRepository.save(target);
    this.logger.log(`BOX_ID synchronisé depuis .env vers settings.boxId: ${envBoxId}`, 'SettingsService');
    return saved;
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

      // Si le fuseau horaire a été modifié, tenter de l'appliquer sur l'hôte (optionnel en Docker)
      if (dto.timezone !== undefined && saved.timezone) {
        try {
          await this.setHostTimezone(saved.timezone);
          this.logger.log(`Fuseau horaire appliqué sur l'hôte: ${saved.timezone}`, 'SettingsService');
        } catch (err: any) {
          this.logger.warn(
            `Fuseau horaire enregistré mais non appliqué sur l'hôte (normal en Docker): ${err.message}`,
            'SettingsService',
          );
        }
      }

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
      setup: dto.setup ?? true,
      city: dto.city ?? null,
      zipCode: dto.zipCode ?? null,
      country: dto.country ?? null,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      timezone: dto.timezone ?? null,
      boxId: null,
    } as Partial<Settings>);
    const saved = await this.settingsRepository.save(newSettings);
    this.logger.log('Paramètres créés', 'SettingsService');

    // Si le fuseau horaire est défini, tenter de l'appliquer sur l'hôte (optionnel en Docker)
    if (saved.timezone) {
      try {
        await this.setHostTimezone(saved.timezone);
        this.logger.log(`Fuseau horaire appliqué sur l'hôte: ${saved.timezone}`, 'SettingsService');
      } catch (err: any) {
        this.logger.warn(
          `Fuseau horaire enregistré mais non appliqué sur l'hôte (normal en Docker): ${err.message}`,
          'SettingsService',
        );
      }
    }

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
   * Applique le fuseau horaire sur l'hôte Debian.
   * Utilise timedatectl si disponible (systemd), sinon crée le symlink /etc/localtime.
   * Nécessite les droits root ou sudo configuré.
   * En Docker, /usr/share/zoneinfo peut être incomplet : on tente timedatectl d'abord (sans vérifier le fichier).
   */
  async setHostTimezone(timezone: string): Promise<void> {
    const trimmed = timezone.trim();
    if (!trimmed || trimmed.includes('..') || trimmed.startsWith('/') || trimmed.includes('\0')) {
      throw new Error('Fuseau horaire invalide');
    }
    if (!/^[a-zA-Z0-9_/+-]+$/.test(trimmed)) {
      throw new Error('Fuseau horaire invalide');
    }

    try {
      // Méthode 1 : timedatectl (valide les fuseaux IANA sans dépendre de /usr/share/zoneinfo)
      execSync(`timedatectl set-timezone ${trimmed}`, {
        stdio: 'pipe',
        timeout: 5000,
      });
      return;
    } catch {
      // Méthode 2 : symlink (nécessite que le fichier existe - souvent absent en Docker)
      const zoneInfoPath = path.join('/usr/share/zoneinfo', trimmed);
      if (!fs.existsSync(zoneInfoPath) || !fs.statSync(zoneInfoPath).isFile()) {
        // tzdata incomplet (Docker minimal) : ne pas lever d'erreur, le fuseau est enregistré en base
        return;
      }
      try {
        execSync(`ln -sf ${zoneInfoPath} /etc/localtime`, {
          stdio: 'pipe',
          timeout: 5000,
        });
      } catch (err: any) {
        throw new Error(
          `Impossible de modifier le fuseau horaire. Vérifiez les droits root. Détail: ${err.message}`,
        );
      }
    }
  }

  /**
   * Récupère le fuseau horaire actuel de l'hôte
   */
  getHostTimezone(): string {
    try {
      const result = execSync('timedatectl show -p Timezone --value', {
        encoding: 'utf-8',
        timeout: 2000,
      });
      return result.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
  }

  /**
   * Heure actuelle de l'hôte (instant UTC + fuseau IANA utilisé par le système).
   */
  getHostTime(): { iso: string; timezone: string } {
    const now = new Date();
    return {
      iso: now.toISOString(),
      timezone: this.getHostTimezone(),
    };
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

  /**
   * Récupère les informations système (RAM en Go, architecture CPU, type CPU)
   */
  getSystemInfo(): { ram: number; cpuArch: string; cpuType: string } {
    const totalMemoryBytes = os.totalmem();
    const totalMemoryGB = totalMemoryBytes / (1024 * 1024 * 1024);
    const ram = Math.round(totalMemoryGB * 100) / 100; // Arrondir à 2 décimales

    const cpuArch = os.arch();
    const cpus = os.cpus();
    const cpuModel = cpus.length > 0 ? cpus[0].model : 'Unknown';
    
    // Détecter si c'est un CPU ARM
    const isARM = cpuArch.includes('arm') || cpuArch.includes('aarch64') || 
                  cpuModel.toLowerCase().includes('arm') || 
                  cpuModel.toLowerCase().includes('apple');

    return {
      ram,
      cpuArch,
      cpuType: isARM ? 'arm' : 'x86',
    };
  }

  /**
   * Récupère l'adresse IP principale de la machine
   * Retourne la première adresse IPv4 non-localhost trouvée
   */
  getServerIp(): string {
    const interfaces = os.networkInterfaces();
    
    // Parcourir toutes les interfaces réseau
    for (const interfaceName in interfaces) {
      const addresses = interfaces[interfaceName];
      if (addresses) {
        for (const address of addresses) {
          // Ignorer les adresses IPv6 et localhost
          if (address.family === 'IPv4' && !address.internal) {
            return address.address;
          }
        }
      }
    }
    
    // Si aucune adresse n'est trouvée, retourner localhost
    return '127.0.0.1';
  }

  private generateBoxId(email: string, timestamp: string): string {
    const source = `${email.toLowerCase().trim()}-${timestamp}`;
    let hash = 0;

    for (let i = 0; i < source.length; i += 1) {
      hash = (hash << 5) - hash + source.charCodeAt(i);
      hash |= 0;
    }

    const positiveHash = Math.abs(hash);
    const timestampPart = Number.parseInt(timestamp, 10).toString(36).toUpperCase();
    const hashPart = positiveHash.toString(36).toUpperCase();
    return `${timestampPart}${hashPart}`.padEnd(12, '0').slice(0, 12);
  }

  async getOrCreateBoxId(userEmail: string): Promise<string> {
    const settings = await this.getSettings();
    if (settings.boxId) {
      return settings.boxId;
    }

    const boxId = this.generateBoxId(userEmail, Date.now().toString());
    settings.boxId = boxId;
    await this.settingsRepository.save(settings);
    this.logger.log(`Box ID généré et sauvegardé: ${boxId}`, 'SettingsService');
    return boxId;
  }
}

