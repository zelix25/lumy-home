import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import {
  PluginLicense,
  LicenseType,
  LicenseStatus,
} from '../entities/plugin-license.entity';
import { Plugin } from '../entities/plugin.entity';
import { LoggerService } from '../../logger/logger.service';
import { PluginAnalyticsService } from '../plugin-analytics.service';
//import { AnalyticsEventType } from '../entities/plugin-analytics.entity';

export interface CreateLicenseDto {
  pluginId: string;
  userId: string;
  licenseType: LicenseType;
  expiresAt?: Date;
  trialEndsAt?: Date;
  metadata?: Record<string, any>;
}

@Injectable()
export class PluginLicenseService {
  private readonly logger: Logger;

  constructor(
    @InjectRepository(PluginLicense)
    private licenseRepository: Repository<PluginLicense>,
    @InjectRepository(Plugin)
    private pluginRepository: Repository<Plugin>,
    private loggerService: LoggerService,
    @Inject(forwardRef(() => PluginAnalyticsService))
    private analyticsService: PluginAnalyticsService,
  ) {
    this.logger = new Logger(PluginLicenseService.name);
  }

  /**
   * Crée une nouvelle licence (généralement pour les plugins gratuits ou les licences manuelles)
   */
  async createLicense(licenseDto: CreateLicenseDto): Promise<PluginLicense> {
    const plugin = await this.pluginRepository.findOne({
      where: { id: licenseDto.pluginId },
    });

    if (!plugin) {
      throw new NotFoundException(`Plugin avec l'ID ${licenseDto.pluginId} non trouvé`);
    }

    // Vérifier si l'utilisateur a déjà une licence active pour ce plugin
    if (licenseDto.licenseType !== LicenseType.TRIAL) {
      const existingLicense = await this.licenseRepository.findOne({
        where: {
          pluginId: licenseDto.pluginId,
          userId: licenseDto.userId,
          status: LicenseStatus.ACTIVE,
        },
      });

      if (existingLicense) {
        throw new BadRequestException(
          'Vous avez déjà une licence active pour ce plugin',
        );
      }
    }

    const license = this.licenseRepository.create({
      pluginId: licenseDto.pluginId,
      userId: licenseDto.userId,
      licenseType: licenseDto.licenseType,
      status:
        licenseDto.licenseType === LicenseType.FREE
          ? LicenseStatus.ACTIVE
          : LicenseStatus.PENDING,
      licenseKey: this.generateLicenseKey(),
      activatedAt:
        licenseDto.licenseType === LicenseType.FREE ? new Date() : null,
      expiresAt: licenseDto.expiresAt || null,
      trialEndsAt: licenseDto.trialEndsAt || null,
      metadata: licenseDto.metadata || null,
    });

    const saved = await this.licenseRepository.save(license);

    this.logger.log(
      `Licence créée: ${saved.licenseKey} (plugin: ${plugin.name}, type: ${licenseDto.licenseType})`,
      'PluginLicenseService',
    );

    return saved;
  }

  /**
   * Vérifie si un utilisateur a une licence valide pour un plugin
   */
  async hasValidLicense(
    pluginId: string,
    userId: string,
  ): Promise<{ valid: boolean; license?: PluginLicense; reason?: string }> {
    const license = await this.licenseRepository.findOne({
      where: {
        pluginId,
        userId,
        status: LicenseStatus.ACTIVE,
      },
      relations: ['plugin'],
    });

    if (!license) {
      return {
        valid: false,
        reason: 'Aucune licence active trouvée',
      };
    }

    // Vérifier l'expiration
    if (license.expiresAt && license.expiresAt < new Date()) {
      license.status = LicenseStatus.EXPIRED;
      await this.licenseRepository.save(license);

      return {
        valid: false,
        license,
        reason: 'La licence a expiré',
      };
    }

    // Vérifier la période d'essai
    if (license.trialEndsAt && license.trialEndsAt < new Date()) {
      if (license.licenseType === LicenseType.TRIAL) {
        license.status = LicenseStatus.EXPIRED;
        await this.licenseRepository.save(license);

        return {
          valid: false,
          license,
          reason: 'La période d\'essai a expiré',
        };
      }
    }

    return {
      valid: true,
      license,
    };
  }

  /**
   * Active une licence (après paiement réussi)
   */
  async activateLicense(licenseId: string): Promise<PluginLicense> {
    const license = await this.licenseRepository.findOne({
      where: { id: licenseId },
    });

    if (!license) {
      throw new NotFoundException(`Licence avec l'ID ${licenseId} non trouvée`);
    }

    if (license.status === LicenseStatus.ACTIVE) {
      return license; // Déjà active
    }

    license.status = LicenseStatus.ACTIVE;
    license.activatedAt = new Date();

    const updated = await this.licenseRepository.save(license);

    this.logger.log(
      `Licence activée: ${updated.licenseKey}`,
      'PluginLicenseService',
    );

    return updated;
  }

  /**
   * Désactive une licence
   */
  async deactivateLicense(licenseId: string, reason?: string): Promise<PluginLicense> {
    const license = await this.licenseRepository.findOne({
      where: { id: licenseId },
    });

    if (!license) {
      throw new NotFoundException(`Licence avec l'ID ${licenseId} non trouvée`);
    }

    license.status = LicenseStatus.SUSPENDED;
    if (reason) {
      license.notes = reason;
    }

    const updated = await this.licenseRepository.save(license);

    this.logger.log(
      `Licence désactivée: ${updated.licenseKey} (raison: ${reason || 'non spécifiée'})`,
      'PluginLicenseService',
    );

    return updated;
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
      relations: ['plugin'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Récupère une licence par sa clé
   */
  async getLicenseByKey(licenseKey: string): Promise<PluginLicense> {
    const license = await this.licenseRepository.findOne({
      where: { licenseKey },
      relations: ['plugin'],
    });

    if (!license) {
      throw new NotFoundException(`Licence avec la clé ${licenseKey} non trouvée`);
    }

    return license;
  }

  /**
   * Vérifie et valide une clé de licence
   */
  async validateLicenseKey(
    licenseKey: string,
    pluginId: string,
  ): Promise<{ valid: boolean; license?: PluginLicense; reason?: string }> {
    const license = await this.licenseRepository.findOne({
      where: { licenseKey },
      relations: ['plugin'],
    });

    if (!license) {
      return {
        valid: false,
        reason: 'Clé de licence invalide',
      };
    }

    if (license.pluginId !== pluginId) {
      return {
        valid: false,
        license,
        reason: 'Cette clé de licence ne correspond pas à ce plugin',
      };
    }

    if (license.status !== LicenseStatus.ACTIVE) {
      return {
        valid: false,
        license,
        reason: `La licence est ${license.status}`,
      };
    }

    // Vérifier l'expiration
    if (license.expiresAt && license.expiresAt < new Date()) {
      license.status = LicenseStatus.EXPIRED;
      await this.licenseRepository.save(license);

      return {
        valid: false,
        license,
        reason: 'La licence a expiré',
      };
    }

    return {
      valid: true,
      license,
    };
  }

  /**
   * Prolonge une licence (ajoute du temps à l'expiration)
   */
  async extendLicense(
    licenseId: string,
    additionalDays: number,
  ): Promise<PluginLicense> {
    const license = await this.licenseRepository.findOne({
      where: { id: licenseId },
    });

    if (!license) {
      throw new NotFoundException(`Licence avec l'ID ${licenseId} non trouvée`);
    }

    if (!license.expiresAt) {
      // Si la licence n'a pas d'expiration, en créer une
      const newExpiration = new Date();
      newExpiration.setDate(newExpiration.getDate() + additionalDays);
      license.expiresAt = newExpiration;
    } else {
      // Ajouter les jours supplémentaires
      const newExpiration = new Date(license.expiresAt);
      newExpiration.setDate(newExpiration.getDate() + additionalDays);
      license.expiresAt = newExpiration;
    }

    const updated = await this.licenseRepository.save(license);

    this.logger.log(
      `Licence prolongée: ${updated.licenseKey} (+${additionalDays} jours)`,
      'PluginLicenseService',
    );

    return updated;
  }

  /**
   * Supprime une licence
   */
  async deleteLicense(licenseId: string): Promise<void> {
    const license = await this.licenseRepository.findOne({
      where: { id: licenseId },
    });

    if (!license) {
      throw new NotFoundException(`Licence avec l'ID ${licenseId} non trouvée`);
    }

    await this.licenseRepository.remove(license);

    this.logger.log(
      `Licence supprimée: ${license.licenseKey}`,
      'PluginLicenseService',
    );
  }

  /**
   * Nettoie les licences expirées (tâche cron quotidienne)
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredLicenses(): Promise<void> {
    const now = new Date();

    const expiredLicenses = await this.licenseRepository.find({
      where: {
        status: LicenseStatus.ACTIVE,
        expiresAt: LessThan(now),
      },
    });

    for (const license of expiredLicenses) {
      license.status = LicenseStatus.EXPIRED;
      await this.licenseRepository.save(license);

      this.logger.log(
        `Licence expirée automatiquement: ${license.licenseKey}`,
        'PluginLicenseService',
      );
    }

    if (expiredLicenses.length > 0) {
      this.logger.log(
        `${expiredLicenses.length} licence(s) expirée(s) automatiquement`,
        'PluginLicenseService',
      );
    }
  }

  /**
   * Nettoie les licences d'essai expirées (tâche cron quotidienne)
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredTrials(): Promise<void> {
    const now = new Date();

    const expiredTrials = await this.licenseRepository.find({
      where: {
        licenseType: LicenseType.TRIAL,
        status: LicenseStatus.ACTIVE,
        trialEndsAt: LessThan(now),
      },
    });

    for (const license of expiredTrials) {
      license.status = LicenseStatus.EXPIRED;
      await this.licenseRepository.save(license);

      this.logger.log(
        `Période d'essai expirée automatiquement: ${license.licenseKey}`,
        'PluginLicenseService',
      );
    }

    if (expiredTrials.length > 0) {
      this.logger.log(
        `${expiredTrials.length} période(s) d'essai expirée(s) automatiquement`,
        'PluginLicenseService',
      );
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

