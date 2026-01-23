import {
  Injectable,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Telegram } from './entities/telegram.entity';
import { RegisterTelegramDto } from './dto/register-telegram.dto';
import { UpdateTelegramDto } from './dto/update-telegram.dto';
import { LoggerService } from '../logger/logger.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly telegramApiUrl: string;

  constructor(
    @InjectRepository(Telegram)
    private telegramRepository: Repository<Telegram>,
    private logger: LoggerService,
    private configService: ConfigService,
  ) {
    this.telegramApiUrl =
      this.configService.get<string>('TELEGRAM_API_URL') ||
      'https://telegram.lumy-home.com/api';
  }

  async onModuleInit() {
    this.logger.log('TelegramService initialisé', 'TelegramService');
  }

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
        setup: true,
        uuid: null,
        chatId: null,
      });
      const saved = await this.telegramRepository.save(defaultConfig);
      this.logger.log(
        'Configuration Telegram par défaut créée',
        'TelegramService',
      );
      return saved;
    }

    return config;
  }

  /**
   * Génère un UUID basé sur le temps et l'enregistre
   */
  async generateUuid(): Promise<Telegram> {
    const config = await this.getTelegramConfig();

    // Générer un UUID basé sur le temps
    const uuid = randomUUID();

    config.uuid = uuid;
    const updated = await this.telegramRepository.save(config);

    this.logger.log(
      `UUID Telegram généré: ${uuid}`,
      'TelegramService',
    );

    return updated;
  }

  /**
   * Enregistre le chat Telegram sur le relais
   * Génère automatiquement un UUID s'il n'existe pas
   */
  async registerChat(dto: RegisterTelegramDto): Promise<Telegram> {
    const config = await this.getTelegramConfig();

    // Générer automatiquement l'UUID s'il n'existe pas
    if (!config.uuid) {
      const uuid = randomUUID();
      config.uuid = uuid;
      await this.telegramRepository.save(config);
      this.logger.log(
        `UUID Telegram généré automatiquement: ${uuid}`,
        'TelegramService',
      );
    }

    const chatIdNumber = parseInt(dto.chatId, 10);
    if (isNaN(chatIdNumber)) {
      throw new BadRequestException('chatId doit être un nombre valide');
    }

    try {
      // Appeler l'API du relais Telegram
      const response = await axios.post(
        `${this.telegramApiUrl}/instances/register-chat`,
        {
          instanceId: config.uuid,
          chatId: chatIdNumber,
          chatType: dto.chatType || 'private',
          chatTitle: dto.chatTitle || 'Chat privé',
        },
        {
          timeout: 10000, // 10 secondes de timeout
        },
      );

      this.logger.log(
        `Chat Telegram enregistré avec succès: ${chatIdNumber}`,
        'TelegramService',
      );

      // Mettre à jour la configuration locale
      config.chatId = chatIdNumber;
      config.setup = false; // La configuration est terminée
      const updated = await this.telegramRepository.save(config);

      return updated;
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de l'enregistrement du chat Telegram: ${error.message}`,
        error.stack,
        'TelegramService',
      );

      if (error.response) {
        throw new BadRequestException(
          `Erreur du serveur Telegram: ${error.response.data?.message || error.response.statusText}`,
        );
      } else if (error.request) {
        throw new BadRequestException(
          'Impossible de contacter le serveur Telegram. Vérifiez votre connexion internet.',
        );
      } else {
        throw new BadRequestException(
          `Erreur lors de l'enregistrement: ${error.message}`,
        );
      }
    }
  }

  /**
   * Met à jour la configuration Telegram
   */
  async updateTelegramConfig(dto: UpdateTelegramDto): Promise<Telegram> {
    const config = await this.getTelegramConfig();

    if (dto.setup !== undefined) {
      config.setup = dto.setup;
    }
    if (dto.uuid !== undefined) {
      config.uuid = dto.uuid;
    }
    if (dto.chatId !== undefined) {
      config.chatId = dto.chatId;
    }

    const updated = await this.telegramRepository.save(config);
    this.logger.log('Configuration Telegram mise à jour', 'TelegramService');

    return updated;
  }

  /**
   * Réinitialise la configuration Telegram
   */
  async resetTelegramConfig(): Promise<Telegram> {
    const config = await this.getTelegramConfig();

    config.setup = true;
    config.uuid = null;
    config.chatId = null;

    const updated = await this.telegramRepository.save(config);
    this.logger.log('Configuration Telegram réinitialisée', 'TelegramService');

    return updated;
  }
}
