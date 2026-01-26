import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Telegram } from './entities/telegram.entity';
import { UpdateTelegramDto } from './dto/update-telegram.dto';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class TelegramService {
  constructor(
    @InjectRepository(Telegram)
    private readonly telegramRepository: Repository<Telegram>,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Récupère la configuration Telegram (crée une configuration par défaut si elle n'existe pas)
   */
  async getTelegramConfig(): Promise<Telegram> {
    const [config] = await this.telegramRepository.find({
      order: { updatedAt: 'DESC' },
      take: 1,
    });

    if (!config) {
      // Créer la configuration par défaut
      const defaultConfig = this.telegramRepository.create({
        chatId: null,
        token_bot: null,
        isActive: false,
      });
      const saved = await this.telegramRepository.save(defaultConfig);
      this.logger.log('Configuration Telegram par défaut créée', 'TelegramService');
      return saved;
    }

    return config;
  }

  /**
   * Met à jour la configuration Telegram
   */
  async updateTelegramConfig(dto: UpdateTelegramDto): Promise<Telegram> {
    const [existingConfig] = await this.telegramRepository.find({
      order: { updatedAt: 'DESC' },
      take: 1,
    });

    if (existingConfig) {
      // Mettre à jour la configuration existante
      Object.assign(existingConfig, dto);
      const saved = await this.telegramRepository.save(existingConfig);
      this.logger.log('Configuration Telegram mise à jour', 'TelegramService');
      return saved;
    }

    // Créer une nouvelle configuration
    const newConfig = this.telegramRepository.create({
      chatId: dto.chatId ?? null,
      token_bot: dto.token_bot ?? null,
      isActive: dto.isActive ?? false,
    });
    const saved = await this.telegramRepository.save(newConfig);
    this.logger.log('Configuration Telegram créée', 'TelegramService');
    return saved;
  }
}
