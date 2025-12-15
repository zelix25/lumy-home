import { IsString, IsOptional, IsObject } from 'class-validator';

export class CreateSubscriptionDto {
  @IsString()
  pluginId: string;

  @IsString()
  planId: string; // ID du plan d'abonnement (Stripe Price ID)

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

