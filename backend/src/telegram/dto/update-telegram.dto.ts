import { IsOptional, IsBoolean, IsString, IsNumber } from 'class-validator';

export class UpdateTelegramDto {
  @IsOptional()
  @IsBoolean()
  setup?: boolean;

  @IsOptional()
  @IsString()
  uuid?: string;

  @IsOptional()
  @IsNumber()
  chatId?: number;
}
