import { IsString, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';

export class SetStorageDto {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsNotEmpty()
  value: any;

  @IsOptional()
  @IsNumber()
  @Min(1)
  ttl?: number; // Time to live en secondes
}

