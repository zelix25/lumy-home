import { IsString, IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTelegramDto {
  @ApiPropertyOptional({ description: 'Chat ID Telegram' })
  @IsOptional()
  @IsString()
  chatId?: string;

  @ApiPropertyOptional({ description: 'Token du bot Telegram' })
  @IsOptional()
  @IsString()
  token_bot?: string;

  @ApiPropertyOptional({ description: 'Activer ou désactiver le bot Telegram' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
