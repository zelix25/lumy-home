import { IsNumber, IsString, IsBoolean, IsOptional, Min, IsLatitude, IsLongitude } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class UpdateSettingsDto {
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : Number(value)))
  @IsNumber()
  @Min(0)
  logout_delay?: number;

  @IsOptional()
  @IsString()
  hostname?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === 1) return true;
    if (value === 'false' || value === false || value === 0) return false;
    return value;
  })
  @IsBoolean()
  setup?: boolean;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  zipCode?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : Number(value)))
  @IsNumber()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : Number(value)))
  @IsNumber()
  @IsLongitude()
  longitude?: number;
}

