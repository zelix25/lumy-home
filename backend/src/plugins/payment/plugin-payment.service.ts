import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PluginLicense, LicenseType, LicenseStatus, PaymentProvider } from './plugin-license.entity';
import { Plugin } from '../entities/plugin.entity';
import { LoggerService } from '../../logger/logger.service';
import * as crypto from 'crypto';

// Interface pour les providers de paiement
interface PaymentProviderInterface {
  createPaymentIntent(amount: number, currency: string, metadata: any): Promise<{ clientSecret: string; paymentId: string }>;
  createSubscription(amount: number, currency: string, interval: string, metadata: any): Promise<{ subscriptionId: string; clientSecret: string }>;
  cancelSubscription(subscriptionId: string): Promise<boolean>;
  verifyPayment(paymentId: string): Promise<boolean>;
}

// Implémentation Stripe (placeholder - nécessite le package stripe)
class StripePaymentProvider implements PaymentProviderInterface {
  private stripe: any; // Stripe instance

  constructor(private apiKey: string) {
    // TODO: Initialiser Stripe avec la clé API
    // this.stripe = new Stripe(apiKey);
  }

  async createPaymentIntent(amount: number, currency: string, metadata: any): Promise<{ clientSecret: string; paymentId: string }> {
    // TODO: Implémenter avec Stripe
    // const paymentIntent = await this.stripe.paymentIntents.create({
    //   amount: Math.round(amount * 100), // Convertir en centimes
    //   currency,
    //   metadata,
    // });
    // return { clientSecret: paymentIntent.client_secret, paymentId: paymentIntent.id };
    throw new Error('Stripe non implémenté - nécessite le package stripe');
  }

  async createSubscription(amount: number, currency: string, interval: string, metadata: any): Promise<{ subscriptionId: string; clientSecret: string }> {
    // TODO: Implémenter avec Stripe
    throw new Error('Stripe non implémenté - nécessite le package stripe');
  }

  async cancelSubscription(subscriptionId: string): Promise<boolean> {
    // TODO: Implémenter avec Stripe
    throw new Error('Stripe non implémenté - nécessite le package stripe');
  }

  async verifyPayment(paymentId: string): Promise<boolean> {
    // TODO: Implémenter avec Stripe
    throw new Error('Stripe non implémenté - nécessite le package stripe');
  }
}

@Injectable()
export class PluginPaymentService implements OnModuleInit {
  private readonly logger: Logger;
  private paymentProviders: Map<PaymentProvider, PaymentProviderInterface> = new Map();

  constructor(
    @InjectRepository(PluginLicense)
    private licenseRepository: Repository<PluginLicense>,
    @InjectRepository(Plugin)
    private pluginRepository: Repository<Plugin>,
    private loggerService: LoggerService,
  ) {
    this.logger = new Logger(PluginPaymentService.name);
  }

  async onModuleInit() {
    // Initialiser les providers de paiement
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey) {
      try {
        this.paymentProviders.set(
          PaymentProvider.STRIPE,
          new StripePaymentProvider(stripeKey),
        );
        this.logger.log('Stripe payment provider initialisé', 'PluginPaymentService');
      } catch (error) {
        this.logger.warn('Impossible d\'initialiser Stripe', 'PluginPaymentService');
      }
    }
  }

  /**
   * Génère une clé de licence unique
   */
  private generateLicenseKey(pluginId: string, userId: string): string {
    const data = `${pluginId}-${userId}-${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32).toUpperCase();
  }

  /**
   * Crée une intention de paiement pour un plugin premium
   */
  async createPaymentIntent(
    pluginId: string,
    userId: string,
    licenseType: LicenseType,
    price: number,
    currency: string = 'EUR',
    paymentProvider: PaymentProvider = PaymentProvider.STRIPE,
  ): Promise<{ clientSecret: string; paymentId: string; licenseId: string }> {
    const plugin = await this.pluginRepository.findOne({ where: { id: pluginId } });
    if (!plugin) {
      throw new NotFoundException(`Plugin ${pluginId} non trouvé`);
    }

    // Vérifier si l'utilisateur a déjà une licence active
    const existingLicense = await this.licenseRepository.findOne({
      where: {
        pluginId,
        userId,
        status: LicenseStatus.ACTIVE,
      },
    });

    if (existingLicense) {
      throw new BadRequestException('Vous avez déjà une licence active pour ce plugin');
    }

    // Créer une licence en attente
    const license = this.licenseRepository.create({
      pluginId,
      userId,
      licenseType,
      status: LicenseStatus.PENDING,
      price,
      currency,
      paymentProvider,
      licenseKey: this.generateLicenseKey(pluginId, userId),
      metadata: {
        pluginName: plugin.name,
        pluginVersion: plugin.version,
      },
    });

    const savedLicense = await this.licenseRepository.save(license);

    // Créer l'intention de paiement avec le provider
    const provider = this.paymentProviders.get(paymentProvider);
    if (!provider) {
      throw new BadRequestException(`Provider de paiement ${paymentProvider} non disponible`);
    }

    let paymentResult;
    if (licenseType === LicenseType.SUBSCRIPTION) {
      // Créer un abonnement récurrent
      paymentResult = await provider.createSubscription(
        price,
        currency,
        'month', // Par défaut mensuel
        {
          licenseId: savedLicense.id,
          pluginId,
          userId,
        },
      );
      savedLicense.subscriptionId = paymentResult.subscriptionId;
    } else {
      // Paiement unique
      paymentResult = await provider.createPaymentIntent(
        price,
        currency,
        {
          licenseId: savedLicense.id,
          pluginId,
          userId,
        },
      );
      savedLicense.paymentId = paymentResult.paymentId;
    }

    await this.licenseRepository.save(savedLicense);

    return {
      clientSecret: paymentResult.clientSecret,
      paymentId: paymentResult.paymentId || paymentResult.subscriptionId,
      licenseId: savedLicense.id,
    };
  }

  /**
   * Confirme un paiement et active la licence
   */
  async confirmPayment(licenseId: string, paymentId: string): Promise<PluginLicense> {
    const license = await this.licenseRepository.findOne({
      where: { id: licenseId },
      relations: ['plugin'],
    });

    if (!license) {
      throw new NotFoundException(`Licence ${licenseId} non trouvée`);
    }

    // Vérifier le paiement avec le provider
    const provider = this.paymentProviders.get(license.paymentProvider);
    if (provider) {
      const isValid = await provider.verifyPayment(paymentId);
      if (!isValid) {
        throw new BadRequestException('Paiement non valide');
      }
    }

    // Activer la licence
    license.status = LicenseStatus.ACTIVE;
    license.paymentId = paymentId;

    // Définir la date d'expiration selon le type de licence
    if (license.licenseType === LicenseType.SUBSCRIPTION) {
      const expirationDate = new Date();
      expirationDate.setMonth(expirationDate.getMonth() + 1); // 1 mois
      license.expiresAt = expirationDate;
    } else if (license.licenseType === LicenseType.ONE_TIME) {
      // Les licences one-time n'expirent pas (ou après 1 an par défaut)
      const expirationDate = new Date();
      expirationDate.setFullYear(expirationDate.getFullYear() + 1);
      license.expiresAt = expirationDate;
    } else if (license.licenseType === LicenseType.LIFETIME) {
      license.expiresAt = null; // Ne jamais expirer
    }

    const updated = await this.licenseRepository.save(license);

    this.logger.log(
      `Licence ${licenseId} activée pour le plugin ${license.plugin.name}`,
      'PluginPaymentService',
    );

    return updated;
  }

  /**
   * Annule un abonnement
   */
  async cancelSubscription(licenseId: string): Promise<PluginLicense> {
    const license = await this.licenseRepository.findOne({
      where: { id: licenseId },
      relations: ['plugin'],
    });

    if (!license) {
      throw new NotFoundException(`Licence ${licenseId} non trouvée`);
    }

    if (license.licenseType !== LicenseType.SUBSCRIPTION) {
      throw new BadRequestException('Cette licence n\'est pas un abonnement');
    }

    if (!license.subscriptionId) {
      throw new BadRequestException('Aucun abonnement associé à cette licence');
    }

    // Annuler l'abonnement avec le provider
    const provider = this.paymentProviders.get(license.paymentProvider);
    if (provider) {
      await provider.cancelSubscription(license.subscriptionId);
    }

    license.status = LicenseStatus.CANCELLED;
    license.cancelledAt = new Date();

    const updated = await this.licenseRepository.save(license);

    this.logger.log(
      `Abonnement ${licenseId} annulé pour le plugin ${license.plugin.name}`,
      'PluginPaymentService',
    );

    return updated;
  }

  /**
   * Vérifie si un utilisateur a une licence active pour un plugin
   */
  async hasActiveLicense(pluginId: string, userId: string): Promise<boolean> {
    const license = await this.licenseRepository.findOne({
      where: {
        pluginId,
        userId,
        status: LicenseStatus.ACTIVE,
      },
    });

    if (!license) {
      return false;
    }

    // Vérifier si la licence n'a pas expiré
    if (license.expiresAt && license.expiresAt < new Date()) {
      license.status = LicenseStatus.EXPIRED;
      await this.licenseRepository.save(license);
      return false;
    }

    return true;
  }

  /**
   * Récupère la licence d'un utilisateur pour un plugin
   */
  async getUserLicense(pluginId: string, userId: string): Promise<PluginLicense | null> {
    return this.licenseRepository.findOne({
      where: {
        pluginId,
        userId,
      },
      relations: ['plugin'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Récupère toutes les licences d'un utilisateur
   */
  async getUserLicenses(userId: string): Promise<PluginLicense[]> {
    return this.licenseRepository.find({
      where: { userId },
      relations: ['plugin'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Récupère toutes les licences d'un plugin
   */
  async getPluginLicenses(pluginId: string): Promise<PluginLicense[]> {
    return this.licenseRepository.find({
      where: { pluginId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Vérifie et met à jour les licences expirées (à appeler périodiquement)
   */
  async checkExpiredLicenses(): Promise<number> {
    const expiredLicenses = await this.licenseRepository
      .createQueryBuilder('license')
      .where('license.status = :status', { status: LicenseStatus.ACTIVE })
      .andWhere('license.expiresAt IS NOT NULL')
      .andWhere('license.expiresAt < :now', { now: new Date() })
      .getMany();

    for (const license of expiredLicenses) {
      license.status = LicenseStatus.EXPIRED;
      await this.licenseRepository.save(license);
    }

    return expiredLicenses.length;
  }

  /**
   * Renouvelle un abonnement (appelé par webhook Stripe)
   */
  async renewSubscription(subscriptionId: string): Promise<PluginLicense> {
    const license = await this.licenseRepository.findOne({
      where: { subscriptionId },
      relations: ['plugin'],
    });

    if (!license) {
      throw new NotFoundException(`Licence avec subscriptionId ${subscriptionId} non trouvée`);
    }

    // Prolonger l'abonnement d'un mois
    const expirationDate = license.expiresAt || new Date();
    expirationDate.setMonth(expirationDate.getMonth() + 1);
    license.expiresAt = expirationDate;
    license.status = LicenseStatus.ACTIVE;

    const updated = await this.licenseRepository.save(license);

    this.logger.log(
      `Abonnement ${subscriptionId} renouvelé pour le plugin ${license.plugin.name}`,
      'PluginPaymentService',
    );

    return updated;
  }
}

