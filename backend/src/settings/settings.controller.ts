import { Controller, Get, Put, Body } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { Settings } from './entities/settings.entity';
import { Public } from '../auth/decorators/public.decorator';

@Controller('settings')
@Public()
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /**
   * Récupère les paramètres
   */
  @Get()
  async getSettings(): Promise<Settings> {
    return this.settingsService.getSettings();
  }

  /**
   * Met à jour les paramètres
   */
  @Put()
  async updateSettings(@Body() dto: UpdateSettingsDto): Promise<Settings> {
    return this.settingsService.updateSettings(dto);
  }
}

