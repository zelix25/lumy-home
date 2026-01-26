import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TelegramService } from './telegram.service';
import { UpdateTelegramDto } from './dto/update-telegram.dto';
import { Telegram } from './entities/telegram.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Telegram')
@Controller('telegram')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Get()
  @ApiOperation({ summary: 'Récupérer la configuration Telegram' })
  @ApiResponse({ status: 200, description: 'Configuration Telegram récupérée avec succès', type: Telegram })
  async getTelegramConfig(): Promise<Telegram> {
    return this.telegramService.getTelegramConfig();
  }

  @Put()
  @ApiOperation({ summary: 'Mettre à jour la configuration Telegram' })
  @ApiResponse({ status: 200, description: 'Configuration Telegram mise à jour avec succès', type: Telegram })
  async updateTelegramConfig(@Body() dto: UpdateTelegramDto): Promise<Telegram> {
    return this.telegramService.updateTelegramConfig(dto);
  }
}
