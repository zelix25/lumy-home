import { Injectable, OnModuleInit, OnModuleDestroy, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Telegram } from './entities/telegram.entity';
import { UpdateTelegramDto } from './dto/update-telegram.dto';
import { LoggerService } from '../logger/logger.service';
import { DevicesService } from '../devices/devices.service';
import { Device } from '../devices/entities/device.entity';
import { UpdaterService, CheckResult } from '../updater/updater.service';
import { t, getDefaultLocale } from './telegram-i18n';
import TelegramBot = require('node-telegram-bot-api');

/** Intention extraite d'un message en langage naturel (action + pièce + optionnel pourcentage) */
interface NaturalLanguageIntent {
  action: 'turn_on' | 'turn_off' | 'open_cover' | 'close_cover' | 'set_brightness' | 'set_cover_position';
  room: string;
  percentage?: number;
  deviceTypeHint?: 'light' | 'cover' | 'plug' | 'switch';
}

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private bot: TelegramBot | null = null;

  constructor(
    @InjectRepository(Telegram)
    private readonly telegramRepository: Repository<Telegram>,
    private readonly logger: LoggerService,
    @Inject(forwardRef(() => DevicesService))
    private readonly devicesService: DevicesService,
    @Inject(forwardRef(() => UpdaterService))
    private readonly updaterService: UpdaterService,
    private readonly eventEmitter: EventEmitter2,
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
   * Génère un PIN de 6 chiffres
   */
  private generatePin(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Met à jour la configuration Telegram
   */
  async updateTelegramConfig(dto: UpdateTelegramDto): Promise<Telegram> {
    const [existingConfig] = await this.telegramRepository.find({
      order: { updatedAt: 'DESC' },
      take: 1,
    });

    let config: Telegram;
    let isNewConfig = false;

    if (existingConfig) {
      // Mettre à jour la configuration existante
      config = existingConfig;
      Object.assign(config, dto);
    } else {
      // Créer une nouvelle configuration
      config = this.telegramRepository.create({
        chatId: dto.chatId ?? null,
        token_bot: dto.token_bot ?? null,
        isActive: dto.isActive ?? false,
        pin: null,
        language: dto.language ?? null,
      });
      isNewConfig = true;
    }

    // Générer un PIN si le chatId est fourni et que la configuration est activée
    const shouldGeneratePin = dto.chatId && dto.token_bot && (dto.isActive || config.isActive);
    const chatIdChanged = dto.chatId !== undefined && dto.chatId !== config.chatId;
    
    if (shouldGeneratePin && (isNewConfig || chatIdChanged)) {
      const pin = this.generatePin();
      config.pin = pin;
      this.logger.log(`PIN Telegram généré: ${pin}`, 'TelegramService');
    }

    const saved = await this.telegramRepository.save(config);
    
    if (isNewConfig) {
      this.logger.log('Configuration Telegram créée', 'TelegramService');
    } else {
      this.logger.log('Configuration Telegram mise à jour', 'TelegramService');
    }
    
    // Réinitialiser le bot si le token ou l'état actif a changé
    if (dto.token_bot !== undefined || dto.isActive !== undefined) {
      await this.initializeBot();
    }

    // Envoyer le PIN au bot si un PIN a été généré et que le bot est actif
    if (saved.pin && saved.chatId && saved.isActive && this.bot) {
      await this.sendPinToBot(saved.chatId, saved.pin);
    }
    
    return saved;
  }

  /**
   * Envoie le PIN au bot Telegram
   */
  private async sendPinToBot(chatId: string, pin: string): Promise<void> {
    if (!this.bot) {
      this.logger.warn('Bot Telegram non initialisé, impossible d\'envoyer le PIN', 'TelegramService');
      return;
    }

    try {
      const lang = await this.getLang();
      const pinMessage = `
${t(lang, 'pin.title')}

${t(lang, 'pin.intro')}

*${pin}*

${t(lang, 'pin.useCode')}

${t(lang, 'pin.important')}
      `;

      await this.bot.sendMessage(chatId, pinMessage, {
        parse_mode: 'Markdown',
      });
      
      this.logger.log(`PIN ${pin} envoyé au chat ${chatId}`, 'TelegramService');
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de l'envoi du PIN au bot: ${error.message}`,
        error.stack,
        'TelegramService',
      );
    }
  }

  /**
   * Initialise le bot Telegram au démarrage du module
   */
  async onModuleInit() {
    await this.initializeBot();
    this.setupEventListeners();
  }

  /**
   * Configure les listeners d'événements pour les notifications
   */
  private setupEventListeners(): void {
    // Écouter les événements d'appareils hors ligne
    this.eventEmitter.on('device.offline', async (data: { device: Device }) => {
      await this.sendDeviceOfflineNotification(data.device);
    });

    // Écouter les événements d'appareils en ligne
    this.eventEmitter.on('device.online', async (data: { device: Device }) => {
      await this.sendDeviceOnlineNotification(data.device);
    });

    // Écouter les exécutions d'automatisations
    this.eventEmitter.on('automation.executed', async (data: {
      automationId: string;
      automationName: string;
      success: boolean;
      timestamp: Date;
    }) => {
      await this.sendAutomationExecutedNotification(data);
    });

    // Écouter les mises à jour disponibles
    this.eventEmitter.on('update.available', async (data: {
      hasUpdates: boolean;
      services: string[];
      updates?: any[];
      mode?: 'beta' | 'stable';
      timestamp: Date;
    }) => {
      await this.sendUpdateAvailableNotification(data);
    });
  }

  /**
   * Nettoie le bot Telegram à l'arrêt du module
   */
  async onModuleDestroy() {
    if (this.bot) {
      await this.bot.close();
      this.bot = null;
    }
  }

  /**
   * Initialise ou réinitialise le bot Telegram
   */
  private async initializeBot(): Promise<void> {
    // Fermer le bot existant s'il y en a un
    if (this.bot) {
      try {
        await this.bot.close();
      } catch (error) {
        // Ignorer les erreurs de fermeture
      }
      this.bot = null;
    }

    const config = await this.getTelegramConfig();

    // Vérifier si le bot doit être actif et si un token est configuré
    if (!config.isActive || !config.token_bot) {
      this.logger.log('Bot Telegram désactivé ou token non configuré', 'TelegramService');
      return;
    }

    try {
      // Créer une nouvelle instance du bot
      this.bot = new TelegramBot(config.token_bot, { polling: true });
      
      // Configurer les handlers de commandes
      this.setupCommandHandlers();
      
      this.logger.log('Bot Telegram initialisé avec succès', 'TelegramService');
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'initialisation du bot Telegram: ${error.message}`,
        error.stack,
        'TelegramService',
      );
      this.bot = null;
    }
  }

  /**
   * Langue du bot (config ou défaut fr)
   */
  private async getLang(): Promise<string> {
    const config = await this.getTelegramConfig();
    return config.language && ['fr', 'en'].includes(config.language) ? config.language : getDefaultLocale();
  }

  /**
   * Clavier principal (menu en bas du chat), libellés selon la langue configurée
   */
  private async getMainMenuKeyboard(): Promise<TelegramBot.ReplyKeyboardMarkup> {
    const lang = await this.getLang();
    return {
      keyboard: [
        [{ text: t(lang, 'menu.devices') }, { text: t(lang, 'menu.stats') }],
        [{ text: t(lang, 'menu.checkUpdates') }, { text: t(lang, 'menu.applyUpdate') }],
        [{ text: t(lang, 'menu.help') }, { text: t(lang, 'menu.menu') }],
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
    };
  }

  /**
   * Configure les handlers de commandes Telegram
   */
  private setupCommandHandlers(): void {
    if (!this.bot) {
      return;
    }

    // Commande /start - Retourne le chatId + affiche le menu
    this.bot.onText(/\/start/, async (msg: TelegramBot.Message) => {
      const chatId = msg.chat.id;
      const lang = await this.getLang();
      const welcomeMessage = `
${t(lang, 'welcome.title')}

${t(lang, 'welcome.chatId')}
\`${chatId}\`

${t(lang, 'welcome.useChatId')}

${t(lang, 'welcome.commands')}

${t(lang, 'welcome.naturalLanguage')}
${t(lang, 'welcome.example1')}
${t(lang, 'welcome.example2')}
${t(lang, 'welcome.example3')}
      `;

      try {
        await this.bot!.sendMessage(chatId, welcomeMessage, {
          parse_mode: 'Markdown',
          reply_markup: await this.getMainMenuKeyboard(),
        });
        this.logger.log(`Chat ID ${chatId} envoyé à l'utilisateur`, 'TelegramService');
      } catch (error: any) {
        this.logger.error(
          `Erreur lors de l'envoi du message: ${error.message}`,
          error.stack,
          'TelegramService',
        );
      }
    });

    // Commande /help
    this.bot.onText(/\/help/, async (msg: TelegramBot.Message) => {
      try {
        await this.runHelp(msg.chat.id);
      } catch (error: any) {
        this.logger.error(`Erreur /help: ${error.message}`, error.stack, 'TelegramService');
        const lang = await this.getLang();
        await this.bot!.sendMessage(msg.chat.id, t(lang, 'error.generic', { message: error.message })).catch(() => {});
      }
    });

    // Commande /check-updates
    this.bot.onText(/\/check-updates/, async (msg: TelegramBot.Message) => {
      try {
        await this.runCheckUpdates(msg.chat.id);
      } catch (error: any) {
        this.logger.error(`Erreur /check-updates: ${error.message}`, error.stack, 'TelegramService');
        const lang = await this.getLang();
        await this.bot!.sendMessage(msg.chat.id, t(lang, 'error.checkUpdates', { message: error.message })).catch(() => {});
      }
    });

    // Commande /update
    this.bot.onText(/\/update/, async (msg: TelegramBot.Message) => {
      try {
        await this.runUpdate(msg.chat.id);
      } catch (error: any) {
        this.logger.error(`Erreur /update: ${error.message}`, error.stack, 'TelegramService');
        const lang = await this.getLang();
        await this.bot!.sendMessage(msg.chat.id, t(lang, 'error.update', { message: error.message })).catch(() => {});
      }
    });

    // Commande /devices
    this.bot.onText(/\/devices/, async (msg: TelegramBot.Message) => {
      try {
        await this.runDevices(msg.chat.id);
      } catch (error: any) {
        this.logger.error(`Erreur /devices: ${error.message}`, error.stack, 'TelegramService');
        const lang = await this.getLang();
        await this.bot!.sendMessage(msg.chat.id, t(lang, 'error.devices')).catch(() => {});
      }
    });

    // Commande /stats
    this.bot.onText(/\/stats/, async (msg: TelegramBot.Message) => {
      try {
        await this.runStats(msg.chat.id);
      } catch (error: any) {
        this.logger.error(`Erreur /stats: ${error.message}`, error.stack, 'TelegramService');
        const lang = await this.getLang();
        await this.bot!.sendMessage(msg.chat.id, t(lang, 'error.stats')).catch(() => {});
      }
    });

    // Commande /status <nom> - État d'un appareil
    this.bot.onText(/\/status (.+)/, async (msg: TelegramBot.Message, match: RegExpExecArray | null) => {
      const chatId = msg.chat.id;
      const lang = await this.getLang();
      if (!match || !match[1]) {
        await this.bot!.sendMessage(chatId, t(lang, 'error.statusUsage'));
        return;
      }
      const deviceName = match[1].trim();
      
      try {
        const device = await this.findDeviceByName(deviceName);
        if (!device) {
          await this.bot!.sendMessage(chatId, t(lang, 'error.deviceNotFound', { name: deviceName }));
          return;
        }

        const statusEmoji = device.status === 'online' ? '🟢' : '🔴';
        const statusLabel = device.status === 'online' ? t(lang, 'status.online') : t(lang, 'status.offline');
        const roomLabel = device.room || t(lang, 'status.roomUndefined');
        let message = `
${statusEmoji} *${device.friendlyName}*

*Type:* ${this.getTypeLabel(device.type, lang)}
*Statut:* ${statusLabel}
*Pièce:* ${roomLabel}
*Fabricant:* ${device.manufacturer || t(lang, 'status.unknown')}
*Modèle:* ${device.model || t(lang, 'status.unknown')}
        `;

        if (device.state) {
          message += `\n${t(lang, 'status.currentState')}\n`;
          const stateEntries = Object.entries(device.state).slice(0, 10);
          stateEntries.forEach(([key, value]) => {
            const formattedKey = this.formatStateKey(key, lang);
            const formattedValue = this.formatStateValue(key, value);
            message += `• ${formattedKey}: ${formattedValue}\n`;
          });
        }

        if (device.status === 'online' && this.isControllableDevice(device)) {
          const inlineKeyboard = await this.createDeviceControlKeyboard(device);
          await this.bot!.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: inlineKeyboard,
          });
        } else {
          await this.bot!.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
          });
        }
      } catch (error: any) {
        this.logger.error(
          `Erreur lors de la récupération de l'état: ${error.message}`,
          error.stack,
          'TelegramService',
        );
        await this.bot!.sendMessage(chatId, t(lang, 'error.stateFetch'));
      }
    });

    // Commande /on <nom> - Allumer un appareil
    this.bot.onText(/\/on (.+)/, async (msg: TelegramBot.Message, match: RegExpExecArray | null) => {
      const chatId = msg.chat.id;
      const lang = await this.getLang();
      if (!match || !match[1]) {
        await this.bot!.sendMessage(chatId, t(lang, 'error.onUsage'));
        return;
      }
      const deviceName = match[1].trim();
      
      try {
        const device = await this.findDeviceByName(deviceName);
        if (!device) {
          await this.bot!.sendMessage(chatId, t(lang, 'error.deviceNotFound', { name: deviceName }));
          return;
        }

        if (device.status !== 'online') {
          await this.bot!.sendMessage(chatId, t(lang, 'error.offline', { name: device.friendlyName || deviceName }));
          return;
        }

        await this.devicesService.sendCommand(device.ieeeAddress, { state: 'ON' });
        await this.bot!.sendMessage(chatId, t(lang, 'messages.deviceOn', { name: device.friendlyName || deviceName }));
      } catch (error: any) {
        this.logger.error(
          `Erreur lors de l'allumage: ${error.message}`,
          error.stack,
          'TelegramService',
        );
        await this.bot!.sendMessage(chatId, t(lang, 'error.turnOn', { name: deviceName }));
      }
    });

    // Commande /off <nom> - Éteindre un appareil
    this.bot.onText(/\/off (.+)/, async (msg: TelegramBot.Message, match: RegExpExecArray | null) => {
      const chatId = msg.chat.id;
      const lang = await this.getLang();
      if (!match || !match[1]) {
        await this.bot!.sendMessage(chatId, t(lang, 'error.offUsage'));
        return;
      }
      const deviceName = match[1].trim();
      
      try {
        const device = await this.findDeviceByName(deviceName);
        if (!device) {
          await this.bot!.sendMessage(chatId, t(lang, 'error.deviceNotFound', { name: deviceName }));
          return;
        }

        if (device.status !== 'online') {
          await this.bot!.sendMessage(chatId, t(lang, 'error.offline', { name: device.friendlyName || deviceName }));
          return;
        }

        await this.devicesService.sendCommand(device.ieeeAddress, { state: 'OFF' });
        await this.bot!.sendMessage(chatId, t(lang, 'messages.deviceOff', { name: device.friendlyName || deviceName }));
      } catch (error: any) {
        this.logger.error(
          `Erreur lors de l'extinction: ${error.message}`,
          error.stack,
          'TelegramService',
        );
        await this.bot!.sendMessage(chatId, t(lang, 'error.turnOff', { name: deviceName }));
      }
    });

    // Commande /brightness <nom> <valeur> - Ajuster la luminosité
    this.bot.onText(/\/brightness (.+) (\d+)/, async (msg: TelegramBot.Message, match: RegExpExecArray | null) => {
      const chatId = msg.chat.id;
      const lang = await this.getLang();
      if (!match || !match[1] || !match[2]) {
        await this.bot!.sendMessage(chatId, t(lang, 'error.brightnessUsage'));
        return;
      }
      const deviceName = match[1].trim();
      const brightness = parseInt(match[2], 10);
      
      if (brightness < 0 || brightness > 100) {
        await this.bot!.sendMessage(chatId, t(lang, 'error.brightnessRange'));
        return;
      }

      try {
        const device = await this.findDeviceByName(deviceName);
        if (!device) {
          await this.bot!.sendMessage(chatId, t(lang, 'error.deviceNotFound', { name: deviceName }));
          return;
        }

        if (device.status !== 'online') {
          await this.bot!.sendMessage(chatId, t(lang, 'error.offline', { name: device.friendlyName || deviceName }));
          return;
        }

        const zigbeeBrightness = Math.round((brightness / 100) * 254);
        await this.devicesService.sendCommand(device.ieeeAddress, { 
          state: 'ON',
          brightness: zigbeeBrightness,
        });
        await this.bot!.sendMessage(chatId, t(lang, 'messages.brightnessOf', { name: device.friendlyName || deviceName, pct: brightness }));
      } catch (error: any) {
        this.logger.error(
          `Erreur lors du réglage de la luminosité: ${error.message}`,
          error.stack,
          'TelegramService',
        );
        await this.bot!.sendMessage(chatId, t(lang, 'error.brightnessSet', { name: deviceName }));
      }
    });

    // Réponses aux boutons du menu (clavier en bas du chat)
    this.bot.on('message', async (msg: TelegramBot.Message) => {
      const text = msg.text?.trim();
      if (!text || text.startsWith('/')) {
        return;
      }
      const chatId = msg.chat.id;
      const lang = await this.getLang();
      try {
        if (text === t(lang, 'menu.menu')) {
          await this.bot!.sendMessage(chatId, t(lang, 'messages.menuHint'), {
            reply_markup: await this.getMainMenuKeyboard(),
          });
          return;
        }
        if (text === t(lang, 'menu.help')) {
          await this.runHelp(chatId);
          return;
        }
        if (text === t(lang, 'menu.devices')) {
          await this.runDevices(chatId);
          return;
        }
        if (text === t(lang, 'menu.stats')) {
          await this.runStats(chatId);
          return;
        }
        if (text === t(lang, 'menu.checkUpdates')) {
          await this.runCheckUpdates(chatId);
          return;
        }
        if (text === t(lang, 'menu.applyUpdate')) {
          await this.runUpdate(chatId);
          return;
        }
        const intent = this.parseNaturalLanguageCommand(text);
        if (intent) {
          await this.executeNaturalLanguageCommand(chatId, intent);
          return;
        }
      } catch (error: any) {
        this.logger.error(
          `Erreur traitement bouton menu: ${error.message}`,
          error.stack,
          'TelegramService',
        );
        await this.bot!.sendMessage(chatId, t(lang, 'error.generic', { message: error.message })).catch(() => {});
      }
    });

    // Gestion des callbacks des boutons inline
    this.bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
      const chatId = query.message?.chat.id;
      const data = query.data;

      if (!chatId || !data) {
        return;
      }

      try {
        // Format: action:ieeeAddress ou action:ieeeAddress:value
        const [action, ieeeAddress, value] = data.split(':');

        const lang = await this.getLang();
        if (action === 'device_on') {
          const device = await this.devicesService.findOne(ieeeAddress);
          await this.devicesService.sendCommand(ieeeAddress, { state: 'ON' });
          await this.bot!.answerCallbackQuery(query.id, { text: t(lang, 'messages.deviceTurnedOn') });
          await this.bot!.editMessageReplyMarkup(
            { inline_keyboard: await this.createDeviceControlKeyboardButtons(ieeeAddress, device.type, true, lang) },
            { chat_id: chatId, message_id: query.message?.message_id },
          );
        } else if (action === 'device_off') {
          const device = await this.devicesService.findOne(ieeeAddress);
          await this.devicesService.sendCommand(ieeeAddress, { state: 'OFF' });
          await this.bot!.answerCallbackQuery(query.id, { text: t(lang, 'messages.deviceTurnedOff') });
          await this.bot!.editMessageReplyMarkup(
            { inline_keyboard: await this.createDeviceControlKeyboardButtons(ieeeAddress, device.type, false, lang) },
            { chat_id: chatId, message_id: query.message?.message_id },
          );
        } else if (action === 'device_brightness') {
          const brightness = parseInt(value || '50', 10);
          const zigbeeBrightness = Math.round((brightness / 100) * 254);
          await this.devicesService.sendCommand(ieeeAddress, { 
            state: 'ON',
            brightness: zigbeeBrightness,
          });
          await this.bot!.answerCallbackQuery(query.id, { text: t(lang, 'messages.brightnessSetPct', { pct: brightness }) });
        } else if (action === 'device_status') {
          const device = await this.devicesService.findOne(ieeeAddress);
          const statusEmoji = device.status === 'online' ? '🟢' : '🔴';
          let statusMessage = `${statusEmoji} *${device.friendlyName}*\n\n`;
          if (device.state) {
            const state = device.state;
            if (state.state) statusMessage += `${t(lang, 'stateKeys.state')}: ${state.state}\n`;
            if (state.brightness) {
              const brightnessPercent = Math.round((state.brightness / 254) * 100);
              statusMessage += `${t(lang, 'stateKeys.brightness')}: ${brightnessPercent}%\n`;
            }
            if (state.temperature) statusMessage += `${t(lang, 'stateKeys.temperature')}: ${state.temperature}°C\n`;
          }
          await this.bot!.answerCallbackQuery(query.id, { text: statusMessage, show_alert: true });
        }
      } catch (error: any) {
        this.logger.error(
          `Erreur lors du traitement du callback: ${error.message}`,
          error.stack,
          'TelegramService',
        );
        const lang = await this.getLang();
        await this.bot!.answerCallbackQuery(query.id, { text: t(lang, 'error.callback') });
      }
    });

    // Gérer les erreurs du bot
    this.bot.on('error', (error: Error) => {
      this.logger.error(
        `Erreur du bot Telegram: ${error.message}`,
        error.stack,
        'TelegramService',
      );
    });
  }

  /**
   * Parse un message en langage naturel : action + pièce + optionnel pourcentage.
   * Ex. : "Allume la lumière du salon", "Ouvre le volet de la cuisine à 50%"
   */
  private parseNaturalLanguageCommand(text: string): NaturalLanguageIntent | null {
    // On parse en version "normalisée" (sans accents) pour tolérer les variations :
    // "lumière" / "lumiere" / "lumiére", "éteins" / "eteins", etc.
    const raw = (text || '').trim();
    const t = raw.toLowerCase();
    const tNorm = raw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
    const roomPrefix = '(?:du|de la|de l\'|dans le|dans la|dans l\'|de)\\s+';
    const stripPercent = (s: string) => (s || '').replace(/\s*(?:a)\s*\d+\s*%?\s*$/, '').trim();
    const extractRoom = (s: string) => stripPercent(s.replace(new RegExp(`^.*${roomPrefix}`, 'i'), ''));

    // Allumer + pièce [à X%]
    let m = tNorm.match(/allum(?:e|er|es)?\s+(?:la|les)?\s*(?:lumiere|lumieres|lampes?|prises?)?\s+(?:du|de la|de l'|dans le|dans la|dans l'|de)\s+(.+)/);
    if (m) {
      const room = stripPercent(m[1]);
      const pct = tNorm.match(/(?:a)\s*(\d+)\s*%?/);
      return { action: 'turn_on', room, percentage: pct ? Math.min(100, Math.max(0, parseInt(pct[1], 10))) : undefined, deviceTypeHint: 'light' };
    }

    // Éteindre + pièce
    // Gère « éteins la lumière du salon » et « éteindre la lumière du salon »
    m = tNorm.match(/(?:eteins?|eteindre)\s+(?:la|les)?\s*(?:lumiere|lumieres|lampes?|prises?)?\s+(?:du|de la|de l'|dans le|dans la|dans l'|de)\s+(.+)/);
    if (m) return { action: 'turn_off', room: stripPercent(m[1]), deviceTypeHint: 'light' };

    // Ouvrir volet + pièce [à X%]
    m = tNorm.match(/ouvr(?:e|er)?\s+(?:le|les)?\s*volet(s)?\s+(?:du|de la|de l'|dans le|dans la|dans l'|de)\s+(.+)/);
    if (m) {
      const room = stripPercent(m[2]);
      const pct = tNorm.match(/(?:a)\s*(\d+)\s*%?/);
      return { action: 'open_cover', room, percentage: pct ? parseInt(pct[1], 10) : 100, deviceTypeHint: 'cover' };
    }

    // Fermer volet + pièce [à X%]
    m = tNorm.match(/ferm(?:e|er)?\s+(?:le|les)?\s*volet(s)?\s+(?:du|de la|de l'|dans le|dans la|dans l'|de)\s+(.+)/);
    if (m) {
      const room = stripPercent(m[2]);
      const pct = tNorm.match(/(?:a)\s*(\d+)\s*%?/);
      return { action: 'close_cover', room, percentage: pct ? parseInt(pct[1], 10) : 0, deviceTypeHint: 'cover' };
    }

    // Luminosité (du/de la) pièce à X%
    m = tNorm.match(/(?:mets?|regl?e?|luminosite)\s+(?:la|les)?\s*(?:lumiere|lumieres)?\s+(?:du|de la|de l'|dans)\s+(.+?)\s+(?:a)\s*(\d+)\s*%?/);
    if (m) {
      const room = m[1].trim();
      const pct = parseInt(m[2], 10);
      if (!isNaN(pct)) return { action: 'set_brightness', room, percentage: Math.min(100, Math.max(0, pct)), deviceTypeHint: 'light' };
    }

    // Court : "allume le salon", "éteins la cuisine", "éteindre la cuisine"
    m = tNorm.match(/^(allume|(?:eteins?|eteindre))\s+(?:la|les)?\s*(?:lumiere|lumieres)?\s+(.+)/);
    if (m) {
      const room = stripPercent(m[2]);
      if (room && room.length < 40) {
        if (m[1].startsWith('allum')) return { action: 'turn_on', room, deviceTypeHint: 'light' };
        return { action: 'turn_off', room, deviceTypeHint: 'light' };
      }
    }

    // "ouvre le volet cuisine à 50"
    m = tNorm.match(/^(ouvre|ferme)\s+(?:le|les)?\s*volet(s)?\s+(.+)/);
    if (m) {
      const rest = m[3].replace(/^(?:du|de la|de l'|dans le|dans la|dans l'|de)\s*/i, '').trim();
      const pctMatch = rest.match(/(.+?)\s+(?:a)\s*(\d+)\s*%?$/);
      const room = pctMatch ? pctMatch[1].trim() : stripPercent(rest);
      const pct = pctMatch ? parseInt(pctMatch[2], 10) : (m[1].startsWith('ouvre') ? 100 : 0);
      if (room && room.length < 40) {
        if (m[1].startsWith('ouvre')) return { action: 'open_cover', room, percentage: pct, deviceTypeHint: 'cover' };
        return { action: 'close_cover', room, percentage: pct, deviceTypeHint: 'cover' };
      }
    }

    return null;
  }

  /**
   * Normalise le nom de pièce pour la comparaison (minuscules, sans accents optionnel)
   */
  private normalizeRoomName(room: string): string {
    return (room || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  /**
   * Retourne les appareils dont la pièce correspond (insensible à la casse, accents)
   */
  private async findDevicesByRoom(room: string, typeHint?: string): Promise<Device[]> {
    const devices = await this.devicesService.findAll();
    const normalizedSearch = this.normalizeRoomName(room);
    return devices.filter((d) => {
      const deviceRoomNorm = this.normalizeRoomName(d.room || '');
      const match = deviceRoomNorm && (deviceRoomNorm.includes(normalizedSearch) || normalizedSearch.includes(deviceRoomNorm));
      if (!match) return false;
      if (typeHint === 'light') return ['light', 'switch', 'plug'].includes(d.type?.toLowerCase() || '');
      if (typeHint === 'cover') return (d.type?.toLowerCase() || '') === 'cover';
      if (typeHint === 'plug') return ['plug', 'switch'].includes(d.type?.toLowerCase() || '');
      return true;
    });
  }

  /**
   * Exécute une commande issue du langage naturel et envoie la réponse Telegram
   */
  private async executeNaturalLanguageCommand(chatId: number, intent: NaturalLanguageIntent): Promise<void> {
    const lang = await this.getLang();
    const devices = await this.findDevicesByRoom(intent.room, intent.deviceTypeHint);
    const online = devices.filter((d) => d.status === 'online');
    const controllable = online.filter((d) => this.isControllableDevice(d));

    if (controllable.length === 0) {
      if (online.length === 0 && devices.length === 0) {
        await this.bot!.sendMessage(chatId, t(lang, 'nl.noDeviceInRoom', { room: intent.room }));
        return;
      }
      if (online.length === 0) {
        await this.bot!.sendMessage(chatId, t(lang, 'nl.devicesOffline', { room: intent.room }));
        return;
      }
      await this.bot!.sendMessage(chatId, t(lang, 'nl.noControllable', { room: intent.room }));
      return;
    }

    const results: string[] = [];
    for (const device of controllable) {
      const name = device.friendlyName || device.ieeeAddress;
      try {
        switch (intent.action) {
          case 'turn_on':
            if (device.type?.toLowerCase() === 'light' && intent.percentage == null) {
              await this.devicesService.sendCommand(device.ieeeAddress, { state: 'TOGGLE' });
            } else {
              await this.devicesService.sendCommand(device.ieeeAddress, { state: 'ON' });
            }
            if (intent.percentage != null && device.type?.toLowerCase() === 'light') {
              const zigbee = Math.round((intent.percentage / 100) * 254);
              await this.devicesService.sendCommand(device.ieeeAddress, { state: 'ON', brightness: zigbee });
            }
            results.push(`✅ ${name}`);
            break;
          case 'turn_off':
            await this.devicesService.sendCommand(device.ieeeAddress, { state: 'OFF' });
            results.push(t(lang, 'nl.deviceOff', { name }));
            break;
          case 'open_cover':
          case 'set_cover_position': {
            const position = intent.percentage ?? 100;
            const zigbeePosition = Math.round((position / 100) * 254);
            await this.devicesService.sendCommand(device.ieeeAddress, { position: zigbeePosition });
            results.push(t(lang, 'nl.coverOpen', { name, pct: position }));
            break;
          }
          case 'close_cover': {
            const position = intent.percentage ?? 0;
            const zigbeePosition = Math.round((position / 100) * 254);
            await this.devicesService.sendCommand(device.ieeeAddress, { position: zigbeePosition });
            results.push(t(lang, 'nl.coverClose', { name, pct: position }));
            break;
          }
          case 'set_brightness':
            if (device.type?.toLowerCase() === 'light') {
              const pct = Math.min(100, Math.max(0, intent.percentage ?? 50));
              const zigbee = Math.round((pct / 100) * 254);
              await this.devicesService.sendCommand(device.ieeeAddress, { state: 'ON', brightness: zigbee });
              results.push(t(lang, 'nl.brightnessSet', { name, pct }));
            }
            break;
          default:
            break;
        }
      } catch (err: any) {
        this.logger.error(`Erreur commande NL sur ${device.ieeeAddress}: ${err.message}`, err.stack, 'TelegramService');
        results.push(t(lang, 'error.generic', { message: err.message }));
      }
    }

    if (results.length === 0) {
      await this.bot!.sendMessage(chatId, t(lang, 'nl.noAction', { room: intent.room }));
      return;
    }

    if (intent.action === 'turn_on' && intent.deviceTypeHint === 'light') {
      await this.bot!.sendMessage(chatId, results.length > 1 ? t(lang, 'nl.lightsOn') : t(lang, 'nl.lightOn'));
      return;
    }
    if (intent.action === 'turn_off' && intent.deviceTypeHint === 'light') {
      await this.bot!.sendMessage(chatId, results.length > 1 ? t(lang, 'nl.lightsOff') : t(lang, 'nl.lightOff'));
      return;
    }

    await this.bot!.sendMessage(chatId, results.join('\n'));
  }

  /**
   * Trouve un appareil par son nom (friendlyName ou ieeeAddress)
   */
  private async findDeviceByName(name: string): Promise<Device | null> {
    try {
      const devices = await this.devicesService.findAll();
      
      // Recherche exacte par friendlyName
      let device = devices.find((d) => 
        d.friendlyName?.toLowerCase() === name.toLowerCase()
      );
      
      // Recherche partielle si pas trouvé
      if (!device) {
        device = devices.find((d) => 
          d.friendlyName?.toLowerCase().includes(name.toLowerCase())
        );
      }
      
      // Recherche par ieeeAddress
      if (!device) {
        device = devices.find((d) => 
          d.ieeeAddress.toLowerCase() === name.toLowerCase()
        );
      }
      
      return device || null;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la recherche d'appareil: ${error.message}`,
        error.stack,
        'TelegramService',
      );
      return null;
    }
  }

  /**
   * Vérifie si un appareil est contrôlable
   */
  private isControllableDevice(device: Device): boolean {
    const controllableTypes = ['light', 'switch', 'plug', 'cover'];
    return controllableTypes.includes(device.type?.toLowerCase() || '');
  }

  /**
   * Crée un clavier inline pour les appareils
   */
  private createDevicesInlineKeyboard(devices: Device[]): TelegramBot.InlineKeyboardMarkup {
    const buttons: TelegramBot.InlineKeyboardButton[][] = [];
    
    devices.forEach((device) => {
      if (this.isControllableDevice(device) && device.status === 'online') {
        buttons.push([
          {
            text: `${device.friendlyName || device.ieeeAddress}`,
            callback_data: `device_status:${device.ieeeAddress}`,
          },
        ]);
      }
    });

    if (buttons.length === 0) {
      return { inline_keyboard: [] };
    }

    return { inline_keyboard: buttons };
  }

  /**
   * Crée un clavier de contrôle pour un appareil
   */
  private async createDeviceControlKeyboard(device: Device): Promise<TelegramBot.InlineKeyboardMarkup> {
    const lang = await this.getLang();
    return {
      inline_keyboard: await this.createDeviceControlKeyboardButtons(
        device.ieeeAddress,
        device.type,
        device.state?.state === 'ON',
        lang,
      ),
    };
  }

  /**
   * Crée les boutons de contrôle pour un appareil
   */
  private async createDeviceControlKeyboardButtons(
    ieeeAddress: string,
    deviceType: string,
    isOn: boolean,
    lang: string,
  ): Promise<TelegramBot.InlineKeyboardButton[][]> {
    const buttons: TelegramBot.InlineKeyboardButton[][] = [
      [
        {
          text: isOn ? t(lang, 'buttons.turnOff') : t(lang, 'buttons.turnOn'),
          callback_data: isOn ? `device_off:${ieeeAddress}` : `device_on:${ieeeAddress}`,
        },
      ],
    ];

    // Ajouter des boutons de luminosité uniquement pour les lumières
    if (deviceType?.toLowerCase() === 'light') {
      buttons.push([
        { text: '25%', callback_data: `device_brightness:${ieeeAddress}:25` },
        { text: '50%', callback_data: `device_brightness:${ieeeAddress}:50` },
        { text: '75%', callback_data: `device_brightness:${ieeeAddress}:75` },
        { text: '100%', callback_data: `device_brightness:${ieeeAddress}:100` },
      ]);
    }

    return buttons;
  }

  /**
   * Obtient l'emoji pour un type d'appareil
   */
  private getTypeEmoji(type: string): string {
    const emojiMap: Record<string, string> = {
      light: '💡',
      switch: '🔌',
      sensor: '📡',
      plug: '🔌',
      door: '🚪',
      window: '🪟',
      temperature: '🌡️',
      humidity: '💧',
      cover: '🪟',
      motion: '👁️',
      button: '🔘',
      energy: '⚡',
      unknown: '❓',
      other: '📦',
    };
    return emojiMap[type.toLowerCase()] || '📦';
  }

  /**
   * Obtient le label pour un type d'appareil (traduit)
   */
  private getTypeLabel(type: string, lang: string): string {
    const key = `deviceTypes.${type?.toLowerCase() || 'other'}`;
    const translated = t(lang, key);
    return translated !== key ? translated : type;
  }

  /**
   * Vérifie si le chatId est celui configuré (admin autorisé pour les commandes sensibles)
   */
  private async isAllowedChat(chatId: number): Promise<boolean> {
    const config = await this.getTelegramConfig();
    return config.chatId != null && String(chatId) === String(config.chatId);
  }

  /**
   * Formate le résultat de vérification des mises à jour pour Telegram
   */
  private async formatCheckUpdatesResult(result: CheckResult, lang: string): Promise<string> {
    if (!result.ok) {
      return t(lang, 'updates.updateServiceError');
    }
    const modeLabel = result.mode === 'beta' ? 'Beta' : 'Stable';
    const hasUpdates = result.hasUpdates && result.updates?.some((u) => u.hasUpdate);
    if (!hasUpdates) {
      return t(lang, 'updates.noUpdateAvailable', { mode: modeLabel });
    }
    let message = t(lang, 'updates.updatesAvailable', { mode: modeLabel }) + '\n';
    for (const u of result.updates!.filter((u) => u.hasUpdate)) {
      message += `• *${u.service}*\n  ${t(lang, 'updates.currentImage')} \`${u.currentImage || 'N/A'}\`\n  ${t(lang, 'updates.newImage')} \`${u.lastImage || 'N/A'}\`\n`;
    }
    message += '\n' + t(lang, 'updates.useButtonUpdate');
    return message;
  }

  /** Envoie le message d'aide (réutilisé par /help et le bouton Aide) */
  private async runHelp(chatId: number): Promise<void> {
    const lang = await this.getLang();
    const helpMessage = `
${t(lang, 'help.title')}

${t(lang, 'help.naturalIntro')}
${t(lang, 'help.example1')}
${t(lang, 'help.example2')}
${t(lang, 'help.example3')}
${t(lang, 'help.example4')}
${t(lang, 'help.example5')}

${t(lang, 'help.devicesSection')}
${t(lang, 'help.devicesCmd')}

${t(lang, 'help.controlSection')}
${t(lang, 'help.controlCmd')}

${t(lang, 'help.infoSection')}
${t(lang, 'help.infoCmd')}

${t(lang, 'help.updatesSection')}
${t(lang, 'help.updatesCmd')}
    `;
    await this.bot!.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
  }

  /** Liste les appareils (réutilisé par /devices et le bouton Appareils) */
  private async runDevices(chatId: number): Promise<void> {
    const lang = await this.getLang();
    const devices = await this.devicesService.findAll();
    const userDevices = devices.filter((d) => String(d.type).toLowerCase() !== 'coordinator');
    if (userDevices.length === 0) {
      await this.bot!.sendMessage(chatId, t(lang, 'devices.none'));
      return;
    }
    let message = `${t(lang, 'devices.available', { count: userDevices.length })}\n\n`;
    const devicesByType: Record<string, Device[]> = {};
    userDevices.forEach((d) => {
      const typ = d.type || 'other';
      if (!devicesByType[typ]) devicesByType[typ] = [];
      devicesByType[typ].push(d);
    });
    for (const [type, list] of Object.entries(devicesByType)) {
      message += `${this.getTypeEmoji(type)} *${this.getTypeLabel(type, lang)}* (${list.length}):\n`;
      list.forEach((d) => {
        const emoji = d.status === 'online' ? '🟢' : '🔴';
        const room = d.room && d.room !== 'Non défini' ? ` (${d.room})` : '';
        message += `${emoji} ${d.friendlyName || d.ieeeAddress}${room}\n`;
      });
      message += '\n';
    }
    const inlineKeyboard = this.createDevicesInlineKeyboard(userDevices.slice(0, 10));
    await this.bot!.sendMessage(chatId, message, { parse_mode: 'Markdown', reply_markup: inlineKeyboard });
  }

  /** Envoie les statistiques (réutilisé par /stats et le bouton Stats) */
  private async runStats(chatId: number): Promise<void> {
    const lang = await this.getLang();
    const stats = await this.devicesService.getDeviceStats();
    const message = `
${t(lang, 'stats.title')}

${t(lang, 'stats.total', { count: stats.total })}
${t(lang, 'stats.online')} ${stats.online}  |  ${t(lang, 'stats.offline')} ${stats.offline}
${t(lang, 'stats.supported')} ${stats.supported}  |  ${t(lang, 'stats.unsupported')} ${stats.unsupported}

${t(lang, 'stats.byType')}
${Object.entries(stats.byType)
  .map(([type, count]) => `${this.getTypeEmoji(type)} ${this.getTypeLabel(type, lang)}: ${count}`)
  .join('\n')}
    `;
    await this.bot!.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  }

  /** Vérifie les mises à jour (réutilisé par /check-updates et le bouton Vérifier MAJ) */
  private async runCheckUpdates(chatId: number): Promise<void> {
    const lang = await this.getLang();
    if (!(await this.isAllowedChat(chatId))) {
      await this.bot!.sendMessage(chatId, t(lang, 'updates.reserved'));
      return;
    }
    await this.bot!.sendMessage(chatId, t(lang, 'updates.checking'));
    const result = await this.updaterService.checkForUpdates();
    const message = await this.formatCheckUpdatesResult(result, lang);
    await this.bot!.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  }

  /** Applique les mises à jour (réutilisé par /update et le bouton Mettre à jour) */
  private async runUpdate(chatId: number): Promise<void> {
    const lang = await this.getLang();
    if (!(await this.isAllowedChat(chatId))) {
      await this.bot!.sendMessage(chatId, t(lang, 'updates.reserved'));
      return;
    }
    let result: CheckResult;
    const lastCheck = this.updaterService.getLastCheckResult();
    if (lastCheck?.hasUpdates && lastCheck.updates?.length) {
      result = lastCheck;
    } else {
      await this.bot!.sendMessage(chatId, t(lang, 'updates.checkingShort'));
      result = await this.updaterService.checkForUpdates();
    }
    if (!result.hasUpdates || !result.updates?.some((u) => u.hasUpdate)) {
      await this.bot!.sendMessage(chatId, t(lang, 'updates.noneAvailable'));
      return;
    }
    const servicesToUpdate = result.updates!.filter((u) => u.hasUpdate).map((u) => u.service);
    await this.bot!.sendMessage(
      chatId,
      t(lang, 'updates.applyConfirm', { services: servicesToUpdate.join(', ') }),
      { parse_mode: 'Markdown' },
    );
    const updateResult = await this.updaterService.applyUpdate(servicesToUpdate);
    if (updateResult.ok) {
      await this.bot!.sendMessage(
        chatId,
        t(lang, 'updates.applied', { list: updateResult.updated.join(', ') }),
        { parse_mode: 'Markdown' },
      );
    } else {
      await this.bot!.sendMessage(
        chatId,
        t(lang, 'updates.failed', { logs: updateResult.logs?.join('\n') || t(lang, 'updates.seeServerLogs') }),
        { parse_mode: 'Markdown' },
      );
    }
  }

  /**
   * Formate une clé d'état pour l'affichage (traduit)
   */
  private formatStateKey(key: string, lang: string): string {
    const tKey = `stateKeys.${key?.toLowerCase() || ''}`;
    const translated = t(lang, tKey);
    return translated !== tKey ? translated : key;
  }

  /**
   * Formate une valeur d'état pour l'affichage
   */
  private formatStateValue(key: string, value: any): string {
    if (key.toLowerCase() === 'brightness' && typeof value === 'number') {
      const percent = Math.round((value / 254) * 100);
      return `${percent}%`;
    }
    if (key.toLowerCase() === 'battery' && typeof value === 'number') {
      return `${value}%`;
    }
    if (key.toLowerCase() === 'temperature' && typeof value === 'number') {
      return `${value}°C`;
    }
    if (key.toLowerCase() === 'humidity' && typeof value === 'number') {
      return `${value}%`;
    }
    if (key.toLowerCase() === 'position' && typeof value === 'number') {
      return `${value}%`;
    }
    return String(value);
  }

  /**
   * Envoie une notification Telegram
   */
  public async sendNotification(message: string, parseMode: 'Markdown' | 'HTML' = 'Markdown'): Promise<void> {
    try {
      const config = await this.getTelegramConfig();
      
      if (!config.isActive || !config.chatId || !this.bot) {
        return; // Bot non configuré ou inactif
      }

      await this.bot.sendMessage(config.chatId, message, {
        parse_mode: parseMode,
      });
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de l'envoi de la notification Telegram: ${error.message}`,
        error.stack,
        'TelegramService',
      );
    }
  }

  /**
   * Envoie une notification quand un appareil passe hors ligne
   */
  private async sendDeviceOfflineNotification(device: Device): Promise<void> {
    const lang = await this.getLang();
    const typeEmoji = this.getTypeEmoji(device.type);
    const room = device.room && device.room !== 'Non défini' ? ` (${device.room})` : '';
    const message = `
${t(lang, 'notify.deviceOfflineTitle')}

${typeEmoji} *${device.friendlyName || device.ieeeAddress}*${room}

${t(lang, 'notify.deviceOfflineDesc')}
    `;
    await this.sendNotification(message);
  }

  /**
   * Envoie une notification quand un appareil revient en ligne
   */
  private async sendDeviceOnlineNotification(device: Device): Promise<void> {
    const lang = await this.getLang();
    const typeEmoji = this.getTypeEmoji(device.type);
    const room = device.room && device.room !== 'Non défini' ? ` (${device.room})` : '';
    const message = `
${t(lang, 'notify.deviceOnlineTitle')}

${typeEmoji} *${device.friendlyName || device.ieeeAddress}*${room}

${t(lang, 'notify.deviceOnlineDesc')}
    `;
    await this.sendNotification(message);
  }

  /**
   * Envoie une notification quand une automatisation est exécutée
   */
  private async sendAutomationExecutedNotification(data: {
    automationId: string;
    automationName: string;
    success: boolean;
    timestamp: Date;
  }): Promise<void> {
    const lang = await this.getLang();
    const emoji = data.success ? '✅' : '❌';
    const status = data.success ? t(lang, 'notify.automationSuccess') : t(lang, 'notify.automationFailed');
    const locale = lang === 'en' ? 'en-GB' : 'fr-FR';
    const message = `
${t(lang, 'notify.automationTitle', { status })}

${emoji} *${data.automationName}*

${t(lang, 'notify.automationAt', { status, time: new Date(data.timestamp).toLocaleTimeString(locale) })}
    `;
    await this.sendNotification(message);
  }

  /**
   * Envoie une notification quand une mise à jour est disponible
   */
  private async sendUpdateAvailableNotification(data: {
    hasUpdates: boolean;
    services: string[];
    updates?: any[];
    mode?: 'beta' | 'stable';
    timestamp: Date;
  }): Promise<void> {
    if (!data.hasUpdates || data.services.length === 0) {
      return;
    }

    const lang = await this.getLang();
    const modeLabel = data.mode === 'beta' ? 'Beta' : 'Stable';
    const servicesList = data.services.join(', ');
    
    let message = `
${t(lang, 'notify.updateAvailableTitle')}

${t(lang, 'notify.updateAvailableDesc')}

*${servicesList}*

${t(lang, 'notify.updateMode')} ${modeLabel}
    `;

    if (data.updates && data.updates.length > 0) {
      const updateDetails = data.updates
        .filter((u) => u.hasUpdate)
        .map((u) => {
          const serviceName = u.service || t(lang, 'notify.serviceUnknown');
          const currentImage = u.currentImage || 'N/A';
          const lastImage = u.lastImage || 'N/A';
          return `• *${serviceName}*\n  ${t(lang, 'updates.currentImage')} \`${currentImage}\`\n  ${t(lang, 'updates.newImage')} \`${lastImage}\``;
        })
        .join('\n\n');

      if (updateDetails) {
        message += `\n\n${t(lang, 'notify.updateDetails')}\n${updateDetails}`;
      }
    }

    message += `\n\n${t(lang, 'notify.updateApplyFromUI')}`;

    await this.sendNotification(message);
  }
}
