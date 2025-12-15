import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  NotFoundException,
  Req,
  RawBodyRequest,
} from '@nestjs/common';
import { PluginPaymentService } from './plugin-payment.service';
import { PluginLicenseService } from './plugin-license.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';

@Controller('plugins/payments')
@UseGuards(JwtAuthGuard)
export class PluginPaymentController {
  constructor(
    private readonly paymentService: PluginPaymentService,
    private readonly licenseService: PluginLicenseService,
  ) {}

  /**
   * Crée une intention de paiement pour un plugin (paiement unique)
   */
  @Post('payment-intent')
  @HttpCode(HttpStatus.CREATED)
  async createPaymentIntent(
    @CurrentUser() user: { id: string; email: string },
    @Body() paymentDto: CreatePaymentIntentDto,
  ) {
    return this.paymentService.createPaymentIntent(user.id, paymentDto);
  }

  /**
   * Crée un abonnement pour un plugin
   */
  @Post('subscription')
  @HttpCode(HttpStatus.CREATED)
  async createSubscription(
    @CurrentUser() user: { id: string; email: string },
    @Body() subscriptionDto: CreateSubscriptionDto,
  ) {
    return this.paymentService.createSubscription(user.id, subscriptionDto);
  }

  /**
   * Annule un abonnement
   */
  @Delete('subscription/:licenseId')
  @HttpCode(HttpStatus.OK)
  async cancelSubscription(
    @CurrentUser() user: { id: string; email: string },
    @Param('licenseId') licenseId: string,
  ) {
    return this.paymentService.cancelSubscription(user.id, licenseId);
  }

  /**
   * Récupère toutes les licences de l'utilisateur
   */
  @Get('licenses')
  async getUserLicenses(@CurrentUser() user: { id: string; email: string }) {
    return this.licenseService.getUserLicenses(user.id);
  }

  /**
   * Vérifie si l'utilisateur a une licence valide pour un plugin
   */
  @Get('licenses/check/:pluginId')
  async checkLicense(
    @CurrentUser() user: { id: string; email: string },
    @Param('pluginId') pluginId: string,
  ) {
    return this.licenseService.hasValidLicense(pluginId, user.id);
  }

  /**
   * Valide une clé de licence
   */
  @Post('licenses/validate')
  @HttpCode(HttpStatus.OK)
  async validateLicenseKey(
    @Body() body: { licenseKey: string; pluginId: string },
  ) {
    return this.licenseService.validateLicenseKey(body.licenseKey, body.pluginId);
  }

  /**
   * Prolonge une licence
   */
  @Post('licenses/:licenseId/extend')
  @HttpCode(HttpStatus.OK)
  async extendLicense(
    @Param('licenseId') licenseId: string,
    @Body() body: { additionalDays: number },
  ) {
    return this.licenseService.extendLicense(licenseId, body.additionalDays);
  }

  /**
   * Webhook Stripe pour les événements de paiement
   * NOTE: Cet endpoint doit être public et vérifier la signature Stripe
   */
  @Post('webhook/stripe')
  @HttpCode(HttpStatus.OK)
  async handleStripeWebhook(@Req() req: RawBodyRequest<Request>) {
    const sig = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new NotFoundException('STRIPE_WEBHOOK_SECRET non configuré');
    }

    let event: Stripe.Event;

    try {
      // Vérifier la signature du webhook
      event = this.paymentService.verifyWebhookSignature(
        req.rawBody,
        sig,
        webhookSecret,
      );
    } catch (err: any) {
      throw new BadRequestException(`Webhook signature verification failed: ${err.message}`);
    }

    return this.paymentService.handleStripeWebhook(event);
  }
}

