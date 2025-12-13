import { IsString, IsOptional, IsArray, IsObject, IsNumber, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export enum PluginCategory {
  AUTOMATION = 'automation',
  INTEGRATION = 'integration',
  UI = 'ui',
  SECURITY = 'security',
  WEATHER = 'weather',
  ENTERTAINMENT = 'entertainment',
  UTILITY = 'utility',
  OTHER = 'other',
}

export class PluginManifestDto {
  @IsString()
  name: string; // Nom unique du plugin (ex: "weather-forecast")

  @IsString()
  displayName: string; // Nom d'affichage

  @IsString()
  version: string; // Version (ex: "1.0.0")

  @IsString()
  @IsOptional()
  description?: string; // Description

  @IsString()
  @IsOptional()
  author?: string; // Auteur

  @IsString()
  @IsOptional()
  icon?: string; // URL ou chemin vers l'icône

  @IsString()
  @IsOptional()
  repository?: string; // URL du repository

  @IsString()
  @IsOptional()
  lumyVersion?: string; // Version minimale de Lumy Home requise

  @IsObject()
  @IsOptional()
  dependencies?: Record<string, string>; // Dépendances (nom: version)

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissions?: string[]; // Permissions demandées

  @IsEnum(PluginCategory)
  @IsOptional()
  category?: PluginCategory; // Catégorie du plugin

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[]; // Tags pour la recherche

  @IsObject()
  @IsOptional()
  configSchema?: Record<string, any>; // Schéma de configuration (JSON Schema)

  @IsString()
  @IsOptional()
  main?: string; // Point d'entrée principal (ex: "index.js")

  @IsObject()
  @IsOptional()
  hooks?: Record<string, string>; // Hooks disponibles (ex: { "onDeviceUpdate": "hooks/device-update.js" })

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>; // Métadonnées supplémentaires
}

