import { IsString, IsOptional, IsObject, IsBoolean } from 'class-validator';

export class InstallPluginDto {
  @IsString()
  source: string; // URL du plugin ou ID du store

  @IsString()
  @IsOptional()
  version?: string; // Version spécifique à installer (optionnel)

  @IsObject()
  @IsOptional()
  config?: Record<string, any>; // Configuration initiale (optionnel)

  @IsBoolean()
  @IsOptional()
  allowUpdate?: boolean; // Permettre la mise à jour si le plugin existe déjà
}

