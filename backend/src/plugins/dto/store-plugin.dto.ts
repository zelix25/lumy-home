import { IsString, IsOptional, IsEnum, IsNumber, IsArray, IsObject } from 'class-validator';
import { PluginCategory } from './plugin-manifest.dto';

export class StorePluginDto {
  @IsString()
  id: string; // ID unique dans le store

  @IsString()
  name: string; // Nom unique du plugin

  @IsString()
  displayName: string; // Nom d'affichage

  @IsString()
  version: string; // Version actuelle

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  author?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsString()
  @IsOptional()
  repository?: string;

  @IsEnum(PluginCategory)
  @IsOptional()
  category?: PluginCategory;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  downloadUrl?: string; // URL de téléchargement

  @IsNumber()
  @IsOptional()
  downloads?: number; // Nombre de téléchargements

  @IsNumber()
  @IsOptional()
  rating?: number; // Note moyenne (0-5)

  @IsNumber()
  @IsOptional()
  reviews?: number; // Nombre d'avis

  @IsString()
  @IsOptional()
  lumyVersion?: string; // Version minimale requise

  @IsObject()
  @IsOptional()
  screenshots?: string[]; // URLs des captures d'écran

  @IsString()
  @IsOptional()
  documentation?: string; // URL de la documentation

  @IsString()
  @IsOptional()
  changelog?: string; // Changelog

  @IsString()
  @IsOptional()
  license?: string; // Licence

  @IsString()
  @IsOptional()
  homepage?: string; // Page d'accueil

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class StoreSearchDto {
  @IsString()
  @IsOptional()
  query?: string; // Terme de recherche

  @IsEnum(PluginCategory)
  @IsOptional()
  category?: PluginCategory; // Filtrer par catégorie

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[]; // Filtrer par tags

  @IsNumber()
  @IsOptional()
  page?: number; // Numéro de page (pagination)

  @IsNumber()
  @IsOptional()
  limit?: number; // Nombre de résultats par page

  @IsString()
  @IsOptional()
  sortBy?: 'name' | 'downloads' | 'rating' | 'updated'; // Trier par

  @IsString()
  @IsOptional()
  sortOrder?: 'asc' | 'desc'; // Ordre de tri
}

