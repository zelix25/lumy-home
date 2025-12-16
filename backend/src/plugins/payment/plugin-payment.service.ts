import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PluginLicense,
  LicenseType,
  LicenseStatus,
  PaymentProvider,
} from '../entities/plugin-license.entity';
import { Plugin } from '../entities/plugin.entity';
import { LoggerService } from '../../logger/logger.service';
import Stripe from 'stripe';

export interface CreatePaymentIntentDto {
  pluginId: string;
  licenseType: LicenseType;
  amount: number; // Montant en centimes (pour Stripe) ou en unités (pour PayPal)
  currency?: string;
  metadata?: Record<string, any>;
}

export interface CreateSubscriptionDto {
  pluginId: string;
  planId: string; // ID du plan d'abonnement
  currency?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class PluginPaymentService {
  private readonly logger: Logger;
  private stripe: Stripe | null = null;

  constructor(
    @InjectRepository(PluginLicense)
    private licenseRepository: Repository<PluginLicense>,
    @InjectRepository(Plugin)
    private pluginRepository: Repository<Plugin>,
    private configService: ConfigService,
    private loggerService: LoggerService,
  ) {
    this.logger = new Logger(PluginPaymentService.name);

    // Initialiser Stripe si la clé secrète est configurée
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (stripeSecretKey) {
      this.stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2025-11-17.clover',
      });
      this.logger.log('Stripe initialisé', 'PluginPaymentService');
    } else {
      this.logger.warn(
        'STRIPE_SECRET_KEY non configurée. Les paiements Stripe ne seront pas disponibles.',
        'PluginPaymentService',
      );
    }
  }

  /**
   * Crée une intention de paiement pour un plugin (paiement unique)
   */
  async createPaymentIntent(
    userId: string,
    paymentDto: CreatePaymentIntentDto,
  ): Promise<{
    clientSecret: string;
    paymentId: string;
    licenseId: string;
  }> {
    const plugin = await this.pluginRepository.findOne({
      where: { id: paymentDto.pluginId },
    });

    if (!plugin) {
      throw new NotFoundException(`Plugin avec l'ID ${paymentDto.pluginId} non trouvé`);
    }

    if (paymentDto.licenseType === LicenseType.FREE) {
      throw new BadRequestException('Les plugins gratuits ne nécessitent pas de paiement');
    }

    // Vérifier si l'utilisateur a déjà une licence active pour ce plugin
    const existingLicense = await this.licenseRepository.findOne({
      where: {
        pluginId: paymentDto.pluginId,
        userId,
        status: LicenseStatus.ACTIVE,
      },
    });

    if (existingLicense) {
      throw new BadRequestException(
        'Vous avez déjà une licence active pour ce plugin',
      );
    }

    // Créer une licence en attente
    const license = this.licenseRepository.create({
      pluginId: paymentDto.pluginId,
      userId,
      licenseType: paymentDto.licenseType,
      status: LicenseStatus.PENDING,
      licenseKey: this.generateLicenseKey(),
      paymentProvider: PaymentProvider.STRIPE,
      amount: paymentDto.amount,
      currency: paymentDto.currency || 'eur',
      metadata: paymentDto.metadata || null,
    });

    const savedLicense = await this.licenseRepository.save(license);

    // Créer l'intention de paiement Stripe
    if (!this.stripe) {
      throw new BadRequestException(
        'Le service de paiement Stripe n\'est pas configuré',
      );
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: paymentDto.amount,
        currency: paymentDto.currency || 'eur',
        metadata: {
          licenseId: savedLicense.id,
          pluginId: paymentDto.pluginId,
          userId,
          licenseType: paymentDto.licenseType,
          ...(paymentDto.metadata || {}),
        },
        description: `Licence ${paymentDto.licenseType} pour ${plugin.displayName}`,
      });

      // Mettre à jour la licence avec l'ID du paiement
      savedLicense.paymentId = paymentIntent.id;
      await this.licenseRepository.save(savedLicense);

      this.logger.log(
        `Intention de paiement créée pour la licence ${savedLicense.id} (plugin: ${plugin.name})`,
        'PluginPaymentService',
      );

      return {
        clientSecret: paymentIntent.client_secret || '',
        paymentId: paymentIntent.id,
        licenseId: savedLicense.id,
      };
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de la création de l'intention de paiement: ${error.message}`,
        'PluginPaymentService',
      );
      throw new BadRequestException(
        `Erreur lors de la création du paiement: ${error.message}`,
      );
    }
  }

  /**
   * Crée un abonnement pour un plugin
   */
  async createSubscription(
    userId: string,
    subscriptionDto: CreateSubscriptionDto,
  ): Promise<{
    clientSecret: string;
    subscriptionId: string;
    licenseId: string;
  }> {
    const plugin = await this.pluginRepository.findOne({
      where: { id: subscriptionDto.pluginId },
    });

    if (!plugin) {
      throw new NotFoundException(`Plugin avec l'ID ${subscriptionDto.pluginId} non trouvé`);
    }

    // Vérifier si l'utilisateur a déjà un abonnement actif pour ce plugin
    const existingLicense = await this.licenseRepository.findOne({
      where: {
        pluginId: subscriptionDto.pluginId,
        userId,
        licenseType: LicenseType.SUBSCRIPTION,
        status: LicenseStatus.ACTIVE,
      },
    });

    if (existingLicense) {
      throw new BadRequestException(
        'Vous avez déjà un abonnement actif pour ce plugin',
      );
    }

    if (!this.stripe) {
      throw new BadRequestException(
        'Le service de paiement Stripe n\'est pas configuré',
      );
    }

    try {
      // Récupérer le prix du plan depuis les métadonnées du plugin ou depuis Stripe
      // Pour l'instant, on suppose que le planId correspond à un Price ID Stripe
      const price = await this.stripe.prices.retrieve(subscriptionDto.planId);

      // Créer une licence en attente
      const license = this.licenseRepository.create({
        pluginId: subscriptionDto.pluginId,
        userId,
        licenseType: LicenseType.SUBSCRIPTION,
        status: LicenseStatus.PENDING,
        licenseKey: this.generateLicenseKey(),
        paymentProvider: PaymentProvider.STRIPE,
        amount: price.unit_amount || 0,
        currency: price.currency || 'eur',
        metadata: {
          planId: subscriptionDto.planId,
          ...(subscriptionDto.metadata || {}),
        },
      });

      const savedLicense = await this.licenseRepository.save(license);

      // Créer l'abonnement Stripe
      const subscription = await this.stripe.subscriptions.create({
        customer: subscriptionDto.metadata?.customerId || undefined,
        items: [{ price: subscriptionDto.planId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          licenseId: savedLicense.id,
          pluginId: subscriptionDto.pluginId,
          userId,
        },
      });

      // Accéder au payment_intent depuis l'invoice expandé
      const latestInvoice = subscription.latest_invoice as Stripe.Invoice;
      let paymentIntent: Stripe.PaymentIntent | null = null;
      
      if (latestInvoice && 'payment_intent' in latestInvoice) {
        const paymentIntentValue = (latestInvoice as any).payment_intent;
        if (typeof paymentIntentValue === 'object' && paymentIntentValue !== null) {
          paymentIntent = paymentIntentValue as Stripe.PaymentIntent;
        }
      }

      // Mettre à jour la licence avec l'ID de l'abonnement
      savedLicense.subscriptionId = subscription.id;
      savedLicense.customerId = subscription.customer as string;
      if (paymentIntent?.client_secret) {
        savedLicense.paymentId = paymentIntent.id;
      } else if (latestInvoice && 'payment_intent' in latestInvoice) {
        // Si payment_intent est un ID string, l'utiliser directement
        const paymentIntentValue = (latestInvoice as any).payment_intent;
        if (typeof paymentIntentValue === 'string') {
          savedLicense.paymentId = paymentIntentValue;
        }
      }
      await this.licenseRepository.save(savedLicense);

      this.logger.log(
        `Abonnement créé pour la licence ${savedLicense.id} (plugin: ${plugin.name})`,
        'PluginPaymentService',
      );

      return {
        clientSecret: paymentIntent?.client_secret || '',
        subscriptionId: subscription.id,
        licenseId: savedLicense.id,
      };
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de la création de l'abonnement: ${error.message}`,
        'PluginPaymentService',
      );
      throw new BadRequestException(
        `Erreur lors de la création de l'abonnement: ${error.message}`,
      );
    }
  }

  /**
   * Confirme un paiement réussi (webhook Stripe)
   */
  async confirmPayment(paymentIntentId: string): Promise<PluginLicense> {
    const license = await this.licenseRepository.findOne({
      where: { paymentId: paymentIntentId },
    });

    if (!license) {
      throw new NotFoundException(
        `Licence avec le paymentId ${paymentIntentId} non trouvée`,
      );
    }

    license.status = LicenseStatus.ACTIVE;
    license.activatedAt = new Date();

    // Pour les licences à paiement unique, définir l'expiration si nécessaire
    if (license.licenseType === LicenseType.ONE_TIME) {
      // Les licences one_time sont généralement permanentes, mais on peut définir une expiration
      // selon les métadonnées du plugin
      const expirationMonths = license.metadata?.expirationMonths;
      if (expirationMonths) {
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + expirationMonths);
        license.expiresAt = expiresAt;
      }
    }

    const updated = await this.licenseRepository.save(license);

    this.logger.log(
      `Paiement confirmé pour la licence ${license.id}`,
      'PluginPaymentService',
    );

    return updated;
  }

  /**
   * Confirme un abonnement actif (webhook Stripe)
   */
  async confirmSubscription(subscriptionId: string): Promise<PluginLicense> {
    const license = await this.licenseRepository.findOne({
      where: { subscriptionId },
    });

    if (!license) {
      throw new NotFoundException(
        `Licence avec le subscriptionId ${subscriptionId} non trouvée`,
      );
    }

    license.status = LicenseStatus.ACTIVE;
    license.activatedAt = new Date();

    // Récupérer les informations de l'abonnement depuis Stripe pour mettre à jour l'expiration
    if (this.stripe) {
      try {
        const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
        const currentPeriodEnd = (subscription as any).current_period_end;
        if (currentPeriodEnd && typeof currentPeriodEnd === 'number') {
          license.expiresAt = new Date(currentPeriodEnd * 1000);
        }
      } catch (error: any) {
        this.logger.warn(
          `Impossible de récupérer les détails de l'abonnement Stripe: ${error.message}`,
          'PluginPaymentService',
        );
      }
    }

    const updated = await this.licenseRepository.save(license);

    this.logger.log(
      `Abonnement confirmé pour la licence ${license.id}`,
      'PluginPaymentService',
    );

    return updated;
  }

  /**
   * Annule un abonnement
   */
  async cancelSubscription(
    userId: string,
    licenseId: string,
  ): Promise<PluginLicense> {
    const license = await this.licenseRepository.findOne({
      where: { id: licenseId, userId },
    });

    if (!license) {
      throw new NotFoundException(`Licence avec l'ID ${licenseId} non trouvée`);
    }

    if (license.licenseType !== LicenseType.SUBSCRIPTION) {
      throw new BadRequestException('Cette licence n\'est pas un abonnement');
    }

    if (license.status === LicenseStatus.CANCELLED) {
      throw new BadRequestException('Cet abonnement est déjà annulé');
    }

    // Annuler l'abonnement Stripe
    if (this.stripe && license.subscriptionId) {
      try {
        await this.stripe.subscriptions.cancel(license.subscriptionId);
      } catch (error: any) {
        this.logger.warn(
          `Erreur lors de l'annulation de l'abonnement Stripe: ${error.message}`,
          'PluginPaymentService',
        );
      }
    }

    license.status = LicenseStatus.CANCELLED;
    const updated = await this.licenseRepository.save(license);

    this.logger.log(
      `Abonnement annulé pour la licence ${license.id}`,
      'PluginPaymentService',
    );

    return updated;
  }

  /**
   * Vérifie la signature d'un webhook Stripe
   */
  verifyWebhookSignature(
    payload: string | Buffer,
    signature: string,
    secret: string,
  ): Stripe.Event {
    if (!this.stripe) {
      throw new BadRequestException('Stripe n\'est pas configuré');
    }

    return this.stripe.webhooks.constructEvent(payload, signature, secret);
  }

  /**
   * Gère les webhooks Stripe
   */
  async handleStripeWebhook(
    event: Stripe.Event,
  ): Promise<{ processed: boolean; license?: PluginLicense }> {
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const license = await this.confirmPayment(paymentIntent.id);
        return { processed: true, license };

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionLicense = await this.confirmSubscription(subscription.id);
        return { processed: true, license: subscriptionLicense };

      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object as Stripe.Subscription;
        const deletedLicense = await this.licenseRepository.findOne({
          where: { subscriptionId: deletedSubscription.id },
        });
        if (deletedLicense) {
          deletedLicense.status = LicenseStatus.CANCELLED;
          await this.licenseRepository.save(deletedLicense);
        }
        return { processed: true, license: deletedLicense || undefined };

      default:
        return { processed: false };
    }
  }

  /**
   * Génère une clé de licence unique
   */
  private generateLicenseKey(): string {
    const prefix = 'LUMY';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 10).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }
}

