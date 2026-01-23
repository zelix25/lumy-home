import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { RegisterTelegramDto } from './dto/register-telegram.dto';
import { UpdateTelegramDto } from './dto/update-telegram.dto';

@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Get()
  async getTelegramConfig() {
    return this.telegramService.getTelegramConfig();
  }

  @Post('generate-uuid')
  @HttpCode(HttpStatus.OK)
  async generateUuid() {
    return this.telegramService.generateUuid();
  }

  @Post('register-chat')
  @HttpCode(HttpStatus.OK)
  async registerChat(@Body() dto: RegisterTelegramDto) {
    return this.telegramService.registerChat(dto);
  }

  @Put()
  async updateTelegramConfig(@Body() dto: UpdateTelegramDto) {
    return this.telegramService.updateTelegramConfig(dto);
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  async resetTelegramConfig() {
    return this.telegramService.resetTelegramConfig();
  }
}
