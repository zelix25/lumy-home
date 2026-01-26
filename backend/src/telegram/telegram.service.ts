import { Injectable, OnModuleInit, OnModuleDestroy, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Telegram } from './entities/telegram.entity';
import { UpdateTelegramDto } from './dto/update-telegram.dto';
import { LoggerService } from '../logger/logger.service';
import { DevicesService } from '../devices/devices.service';
import { Device } from '../devices/entities/device.entity';
import TelegramBot = require('node-telegram-bot-api');

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private bot: TelegramBot | null = null;

  constructor(
    @InjectRepository(Telegram)
    private readonly telegramRepository: Repository<Telegram>,
    private readonly logger: LoggerService,
    @Inject(forwardRef(() => DevicesService))
    private readonly devicesService: DevicesService,
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
      const pinMessage = `
🔐 *Code de validation Telegram*

Votre code PIN de validation est :

*${pin}*

Utilisez ce code pour valider la connexion de votre instance Lumy Home avec Telegram.

⚠️ *Important* : Ce code est valable uniquement pour cette configuration.
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
   * Configure les handlers de commandes Telegram
   */
  private setupCommandHandlers(): void {
    if (!this.bot) {
      return;
    }

    // Commande /start - Retourne le chatId de l'utilisateur
    this.bot.onText(/\/start/, async (msg: TelegramBot.Message) => {
      const chatId = msg.chat.id;
      const welcomeMessage = `
🤖 *Bienvenue sur Lumy Home Bot*

*Votre Chat ID:*
\`${chatId}\`

Utilisez ce Chat ID dans les paramètres de votre instance Lumy Home pour activer les notifications Telegram.

*Commandes disponibles:*
/start - Afficher ce message
/help - Afficher l'aide complète
/devices - Lister tous les appareils
/stats - Statistiques des appareils
/status <nom> - État d'un appareil
/on <nom> - Allumer un appareil
/off <nom> - Éteindre un appareil
/brightness <nom> <0-100> - Ajuster la luminosité
      `;

      try {
        await this.bot!.sendMessage(chatId, welcomeMessage, {
          parse_mode: 'Markdown',
        });
        this.logger.log(`Chat ID ${chatId} envoyé à l'utilisateur`, 'TelegramService');
      } catch (error) {
        this.logger.error(
          `Erreur lors de l'envoi du message: ${error.message}`,
          error.stack,
          'TelegramService',
        );
      }
    });

    // Commande /help
    this.bot.onText(/\/help/, async (msg: TelegramBot.Message) => {
      const chatId = msg.chat.id;
      const helpMessage = `
📖 *Aide - Commandes Lumy Home Bot*

*Liste des appareils:*
\`/devices\` - Afficher tous les appareils disponibles

*Contrôle des appareils:*
\`/on <nom>\` - Allumer un appareil
\`/off <nom>\` - Éteindre un appareil
\`/brightness <nom> <0-100>\` - Ajuster la luminosité (0-100%)

*Informations:*
\`/status <nom>\` - Voir l'état détaillé d'un appareil
\`/stats\` - Statistiques globales

*Exemples:*
\`/on Lumière Salon\`
\`/off Lumière Salon\`
\`/brightness Lumière Salon 50\`
\`/status Lumière Salon\`
      `;

      try {
        await this.bot!.sendMessage(chatId, helpMessage, {
          parse_mode: 'Markdown',
        });
      } catch (error) {
        this.logger.error(
          `Erreur lors de l'envoi de l'aide: ${error.message}`,
          error.stack,
          'TelegramService',
        );
      }
    });

    // Commande /devices - Lister tous les appareils
    this.bot.onText(/\/devices/, async (msg: TelegramBot.Message) => {
      const chatId = msg.chat.id;
      try {
        const devices = await this.devicesService.findAll();
        
        // Filtrer le coordinateur
        const userDevices = devices.filter((device) => {
          const typeStr = String(device.type).toLowerCase();
          return typeStr !== 'coordinator';
        });

        if (userDevices.length === 0) {
          await this.bot!.sendMessage(chatId, '❌ Aucun appareil trouvé.');
          return;
        }

        let message = `📱 *Appareils disponibles (${userDevices.length}):*\n\n`;
        
        // Grouper par type
        const devicesByType: Record<string, Device[]> = {};
        userDevices.forEach((device) => {
          const type = device.type || 'other';
          if (!devicesByType[type]) {
            devicesByType[type] = [];
          }
          devicesByType[type].push(device);
        });

        for (const [type, typeDevices] of Object.entries(devicesByType)) {
          const typeEmoji = this.getTypeEmoji(type);
          message += `${typeEmoji} *${this.getTypeLabel(type)}* (${typeDevices.length}):\n`;
          
          typeDevices.forEach((device) => {
            const statusEmoji = device.status === 'online' ? '🟢' : '🔴';
            const room = device.room && device.room !== 'Non défini' ? ` (${device.room})` : '';
            message += `${statusEmoji} ${device.friendlyName || device.ieeeAddress}${room}\n`;
          });
          message += '\n';
        }

        // Ajouter des boutons inline pour les appareils contrôlables
        const inlineKeyboard = this.createDevicesInlineKeyboard(userDevices.slice(0, 10)); // Limiter à 10 pour éviter les erreurs

        await this.bot!.sendMessage(chatId, message, {
          parse_mode: 'Markdown',
          reply_markup: inlineKeyboard,
        });
      } catch (error) {
        this.logger.error(
          `Erreur lors de la récupération des appareils: ${error.message}`,
          error.stack,
          'TelegramService',
        );
        await this.bot!.sendMessage(chatId, '❌ Erreur lors de la récupération des appareils.');
      }
    });

    // Commande /stats - Statistiques
    this.bot.onText(/\/stats/, async (msg: TelegramBot.Message) => {
      const chatId = msg.chat.id;
      try {
        const stats = await this.devicesService.getDeviceStats();
        const message = `
📊 *Statistiques Lumy Home*

*Total:* ${stats.total} appareils
🟢 *En ligne:* ${stats.online}
🔴 *Hors ligne:* ${stats.offline}
✅ *Supportés:* ${stats.supported}
⚠️ *Non supportés:* ${stats.unsupported}

*Par type:*
${Object.entries(stats.byType)
  .map(([type, count]) => `${this.getTypeEmoji(type)} ${this.getTypeLabel(type)}: ${count}`)
  .join('\n')}
        `;

        await this.bot!.sendMessage(chatId, message, {
          parse_mode: 'Markdown',
        });
      } catch (error) {
        this.logger.error(
          `Erreur lors de la récupération des stats: ${error.message}`,
          error.stack,
          'TelegramService',
        );
        await this.bot!.sendMessage(chatId, '❌ Erreur lors de la récupération des statistiques.');
      }
    });

    // Commande /status <nom> - État d'un appareil
    this.bot.onText(/\/status (.+)/, async (msg: TelegramBot.Message, match: RegExpExecArray | null) => {
      const chatId = msg.chat.id;
      if (!match || !match[1]) {
        await this.bot!.sendMessage(chatId, '❌ Usage: /status <nom de l\'appareil>');
        return;
      }
      const deviceName = match[1].trim();
      
      try {
        const device = await this.findDeviceByName(deviceName);
        if (!device) {
          await this.bot!.sendMessage(chatId, `❌ Appareil "${deviceName}" non trouvé.`);
          return;
        }

        const statusEmoji = device.status === 'online' ? '🟢' : '🔴';
        let message = `
${statusEmoji} *${device.friendlyName}*

*Type:* ${this.getTypeLabel(device.type)}
*Statut:* ${device.status === 'online' ? 'En ligne' : 'Hors ligne'}
*Pièce:* ${device.room || 'Non définie'}
*Fabricant:* ${device.manufacturer || 'Inconnu'}
*Modèle:* ${device.model || 'Inconnu'}
        `;

        if (device.state) {
          message += '\n*État actuel:*\n';
          const stateEntries = Object.entries(device.state).slice(0, 10); // Limiter à 10 propriétés
          stateEntries.forEach(([key, value]) => {
            const formattedKey = this.formatStateKey(key);
            const formattedValue = this.formatStateValue(key, value);
            message += `• ${formattedKey}: ${formattedValue}\n`;
          });
        }

        // Boutons de contrôle si l'appareil est en ligne et contrôlable
        if (device.status === 'online' && this.isControllableDevice(device)) {
          const inlineKeyboard = this.createDeviceControlKeyboard(device);
          await this.bot!.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: inlineKeyboard,
          });
        } else {
          await this.bot!.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
          });
        }
      } catch (error) {
        this.logger.error(
          `Erreur lors de la récupération de l'état: ${error.message}`,
          error.stack,
          'TelegramService',
        );
        await this.bot!.sendMessage(chatId, '❌ Erreur lors de la récupération de l\'état.');
      }
    });

    // Commande /on <nom> - Allumer un appareil
    this.bot.onText(/\/on (.+)/, async (msg: TelegramBot.Message, match: RegExpExecArray | null) => {
      const chatId = msg.chat.id;
      if (!match || !match[1]) {
        await this.bot!.sendMessage(chatId, '❌ Usage: /on <nom de l\'appareil>');
        return;
      }
      const deviceName = match[1].trim();
      
      try {
        const device = await this.findDeviceByName(deviceName);
        if (!device) {
          await this.bot!.sendMessage(chatId, `❌ Appareil "${deviceName}" non trouvé.`);
          return;
        }

        if (device.status !== 'online') {
          await this.bot!.sendMessage(chatId, `❌ L'appareil "${device.friendlyName}" est hors ligne.`);
          return;
        }

        await this.devicesService.sendCommand(device.ieeeAddress, { state: 'ON' });
        await this.bot!.sendMessage(chatId, `✅ "${device.friendlyName}" allumé.`);
      } catch (error) {
        this.logger.error(
          `Erreur lors de l'allumage: ${error.message}`,
          error.stack,
          'TelegramService',
        );
        await this.bot!.sendMessage(chatId, `❌ Erreur lors de l'allumage de "${deviceName}".`);
      }
    });

    // Commande /off <nom> - Éteindre un appareil
    this.bot.onText(/\/off (.+)/, async (msg: TelegramBot.Message, match: RegExpExecArray | null) => {
      const chatId = msg.chat.id;
      if (!match || !match[1]) {
        await this.bot!.sendMessage(chatId, '❌ Usage: /off <nom de l\'appareil>');
        return;
      }
      const deviceName = match[1].trim();
      
      try {
        const device = await this.findDeviceByName(deviceName);
        if (!device) {
          await this.bot!.sendMessage(chatId, `❌ Appareil "${deviceName}" non trouvé.`);
          return;
        }

        if (device.status !== 'online') {
          await this.bot!.sendMessage(chatId, `❌ L'appareil "${device.friendlyName}" est hors ligne.`);
          return;
        }

        await this.devicesService.sendCommand(device.ieeeAddress, { state: 'OFF' });
        await this.bot!.sendMessage(chatId, `✅ "${device.friendlyName}" éteint.`);
      } catch (error) {
        this.logger.error(
          `Erreur lors de l'extinction: ${error.message}`,
          error.stack,
          'TelegramService',
        );
        await this.bot!.sendMessage(chatId, `❌ Erreur lors de l'extinction de "${deviceName}".`);
      }
    });

    // Commande /brightness <nom> <valeur> - Ajuster la luminosité
    this.bot.onText(/\/brightness (.+) (\d+)/, async (msg: TelegramBot.Message, match: RegExpExecArray | null) => {
      const chatId = msg.chat.id;
      if (!match || !match[1] || !match[2]) {
        await this.bot!.sendMessage(chatId, '❌ Usage: /brightness <nom de l\'appareil> <0-100>');
        return;
      }
      const deviceName = match[1].trim();
      const brightness = parseInt(match[2], 10);
      
      if (brightness < 0 || brightness > 100) {
        await this.bot!.sendMessage(chatId, '❌ La luminosité doit être entre 0 et 100.');
        return;
      }

      try {
        const device = await this.findDeviceByName(deviceName);
        if (!device) {
          await this.bot!.sendMessage(chatId, `❌ Appareil "${deviceName}" non trouvé.`);
          return;
        }

        if (device.status !== 'online') {
          await this.bot!.sendMessage(chatId, `❌ L'appareil "${device.friendlyName}" est hors ligne.`);
          return;
        }

        // Convertir 0-100 en 0-254 pour Zigbee
        const zigbeeBrightness = Math.round((brightness / 100) * 254);
        await this.devicesService.sendCommand(device.ieeeAddress, { 
          state: 'ON',
          brightness: zigbeeBrightness,
        });
        await this.bot!.sendMessage(chatId, `✅ Luminosité de "${device.friendlyName}" réglée à ${brightness}%.`);
      } catch (error) {
        this.logger.error(
          `Erreur lors du réglage de la luminosité: ${error.message}`,
          error.stack,
          'TelegramService',
        );
        await this.bot!.sendMessage(chatId, `❌ Erreur lors du réglage de la luminosité de "${deviceName}".`);
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

        if (action === 'device_on') {
          const device = await this.devicesService.findOne(ieeeAddress);
          await this.devicesService.sendCommand(ieeeAddress, { state: 'ON' });
          await this.bot!.answerCallbackQuery(query.id, { text: '✅ Appareil allumé' });
          await this.bot!.editMessageReplyMarkup(
            { inline_keyboard: this.createDeviceControlKeyboardButtons(ieeeAddress, device.type, true) },
            { chat_id: chatId, message_id: query.message?.message_id },
          );
        } else if (action === 'device_off') {
          const device = await this.devicesService.findOne(ieeeAddress);
          await this.devicesService.sendCommand(ieeeAddress, { state: 'OFF' });
          await this.bot!.answerCallbackQuery(query.id, { text: '✅ Appareil éteint' });
          await this.bot!.editMessageReplyMarkup(
            { inline_keyboard: this.createDeviceControlKeyboardButtons(ieeeAddress, device.type, false) },
            { chat_id: chatId, message_id: query.message?.message_id },
          );
        } else if (action === 'device_brightness') {
          const brightness = parseInt(value || '50', 10);
          const zigbeeBrightness = Math.round((brightness / 100) * 254);
          await this.devicesService.sendCommand(ieeeAddress, { 
            state: 'ON',
            brightness: zigbeeBrightness,
          });
          await this.bot!.answerCallbackQuery(query.id, { text: `✅ Luminosité réglée à ${brightness}%` });
        } else if (action === 'device_status') {
          const device = await this.devicesService.findOne(ieeeAddress);
          const statusEmoji = device.status === 'online' ? '🟢' : '🔴';
          let statusMessage = `${statusEmoji} *${device.friendlyName}*\n\n`;
          if (device.state) {
            const state = device.state;
            if (state.state) statusMessage += `État: ${state.state}\n`;
            if (state.brightness) {
              const brightnessPercent = Math.round((state.brightness / 254) * 100);
              statusMessage += `Luminosité: ${brightnessPercent}%\n`;
            }
            if (state.temperature) statusMessage += `Température: ${state.temperature}°C\n`;
          }
          await this.bot!.answerCallbackQuery(query.id, { text: statusMessage, show_alert: true });
        }
      } catch (error) {
        this.logger.error(
          `Erreur lors du traitement du callback: ${error.message}`,
          error.stack,
          'TelegramService',
        );
        await this.bot!.answerCallbackQuery(query.id, { text: '❌ Erreur lors de l\'exécution' });
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
  private createDeviceControlKeyboard(device: Device): TelegramBot.InlineKeyboardMarkup {
    return {
      inline_keyboard: this.createDeviceControlKeyboardButtons(
        device.ieeeAddress,
        device.type,
        device.state?.state === 'ON',
      ),
    };
  }

  /**
   * Crée les boutons de contrôle pour un appareil
   */
  private createDeviceControlKeyboardButtons(
    ieeeAddress: string,
    deviceType: string,
    isOn: boolean,
  ): TelegramBot.InlineKeyboardButton[][] {
    const buttons: TelegramBot.InlineKeyboardButton[][] = [
      [
        {
          text: isOn ? '🔴 Éteindre' : '🟢 Allumer',
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
   * Obtient le label pour un type d'appareil
   */
  private getTypeLabel(type: string): string {
    const labelMap: Record<string, string> = {
      light: 'Lumières',
      switch: 'Interrupteurs',
      sensor: 'Capteurs',
      plug: 'Prises',
      door: 'Portes',
      window: 'Fenêtres',
      temperature: 'Température',
      humidity: 'Humidité',
      cover: 'Volets',
      motion: 'Mouvement',
      button: 'Boutons',
      energy: 'Énergie',
      unknown: 'Inconnu',
      other: 'Autres',
    };
    return labelMap[type.toLowerCase()] || type;
  }

  /**
   * Formate une clé d'état pour l'affichage
   */
  private formatStateKey(key: string): string {
    const keyMap: Record<string, string> = {
      state: 'État',
      brightness: 'Luminosité',
      temperature: 'Température',
      humidity: 'Humidité',
      battery: 'Batterie',
      contact: 'Contact',
      occupancy: 'Occupation',
      voltage: 'Tension',
      power: 'Puissance',
      energy: 'Énergie',
      position: 'Position',
    };
    return keyMap[key.toLowerCase()] || key;
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
    const typeEmoji = this.getTypeEmoji(device.type);
    const room = device.room && device.room !== 'Non défini' ? ` (${device.room})` : '';
    
    const message = `
🔴 *Appareil hors ligne*

${typeEmoji} *${device.friendlyName || device.ieeeAddress}*${room}

L'appareil n'est plus accessible sur le réseau Zigbee.
    `;

    await this.sendNotification(message);
  }

  /**
   * Envoie une notification quand un appareil revient en ligne
   */
  private async sendDeviceOnlineNotification(device: Device): Promise<void> {
    const typeEmoji = this.getTypeEmoji(device.type);
    const room = device.room && device.room !== 'Non défini' ? ` (${device.room})` : '';
    
    const message = `
🟢 *Appareil en ligne*

${typeEmoji} *${device.friendlyName || device.ieeeAddress}*${room}

L'appareil est de nouveau accessible sur le réseau Zigbee.
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
    const emoji = data.success ? '✅' : '❌';
    const status = data.success ? 'réussie' : 'échouée';
    
    const message = `
🤖 *Automatisation ${status}*

${emoji} *${data.automationName}*

L'automatisation a été ${status} à ${new Date(data.timestamp).toLocaleTimeString('fr-FR')}.
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

    const modeLabel = data.mode === 'beta' ? 'Beta' : 'Stable';
    const servicesList = data.services.join(', ');
    
    let message = `
🔄 *Mise à jour disponible*

Des mises à jour sont disponibles pour les services suivants :

*${servicesList}*

Mode: ${modeLabel}
    `;

    // Ajouter des détails si disponibles
    if (data.updates && data.updates.length > 0) {
      const updateDetails = data.updates
        .filter((u) => u.hasUpdate)
        .map((u) => {
          const serviceName = u.service || 'Service inconnu';
          const currentImage = u.currentImage || 'N/A';
          const lastImage = u.lastImage || 'N/A';
          return `• *${serviceName}*\n  Actuel: \`${currentImage}\`\n  Nouveau: \`${lastImage}\``;
        })
        .join('\n\n');

      if (updateDetails) {
        message += `\n\n*Détails:*\n${updateDetails}`;
      }
    }

    message += `\n\nVous pouvez appliquer les mises à jour depuis l'interface Lumy Home.`;

    await this.sendNotification(message);
  }
}
