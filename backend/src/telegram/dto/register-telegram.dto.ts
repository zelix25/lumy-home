import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class RegisterTelegramDto {
  @IsNotEmpty()
  @IsString()
  chatId: string;

  @IsOptional()
  @IsString()
  chatType?: string;

  @IsOptional()
  @IsString()
  chatTitle?: string;
}
