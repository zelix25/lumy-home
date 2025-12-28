import { IsString, IsEnum, IsNumber, IsOptional, IsObject, Min } from 'class-validator';
import { LicenseType } from '../../entities/plugin-license.entity';

export class CreatePaymentIntentDto {
  @IsString()
  pluginId: string;

  @IsEnum(LicenseType)
  licenseType: LicenseType;

  @IsNumber()
  @Min(0)
  amount: number; // Montant en centimes (pour Stripe) ou en unités (pour PayPal)

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

