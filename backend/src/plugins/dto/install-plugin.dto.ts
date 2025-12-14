import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
  IsArray,
} from 'class-validator';

export class InstallPluginDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  displayName: string;

  @IsString()
  @IsNotEmpty()
  version: string;

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

  @IsString()
  @IsNotEmpty()
  lumyVersion: string;

  @IsString()
  @IsOptional()
  installPath?: string;

  @IsObject()
  @IsOptional()
  config?: Record<string, any>;

  @IsArray()
  @IsOptional()
  permissions?: string[];

  @IsObject()
  @IsOptional()
  dependencies?: Record<string, string>;

  @IsObject()
  @IsOptional()
  configSchema?: Record<string, any>;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

