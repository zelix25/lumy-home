import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Settings } from './entities/settings.entity';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Settings)
    private readonly settingsRepository: Repository<Settings>,
    private readonly logger: LoggerService,
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
      });
      const saved = await this.settingsRepository.save(defaultSettings);
      this.logger.log('Paramètres par défaut créés', 'SettingsService');
      return saved;
    }

    return settings;
  }

  /**
   * Met à jour les paramètres
   */
  async updateSettings(dto: UpdateSettingsDto): Promise<Settings> {
    const [existingSettings] = await this.settingsRepository.find({
      order: { updatedAt: 'DESC' },
      take: 1,
    });

    if (existingSettings) {
      // Mettre à jour les paramètres existants
      Object.assign(existingSettings, dto);
      const saved = await this.settingsRepository.save(existingSettings);
      this.logger.log('Paramètres mis à jour', 'SettingsService');
      return saved;
    }

    // Créer de nouveaux paramètres
    const newSettings = this.settingsRepository.create({
      logout_delay: dto.logout_delay ?? 0,
      hostname: dto.hostname ?? '',
      setup: dto.setup ?? false,
    });
    const saved = await this.settingsRepository.save(newSettings);
    this.logger.log('Paramètres créés', 'SettingsService');
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

