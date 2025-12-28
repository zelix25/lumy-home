import { Controller, Get, Put, Body } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { Settings } from './entities/settings.entity';
import { Public } from '../auth/decorators/public.decorator';

@Controller('settings')
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
   * Vérifie le statut du setup (route publique)
   */
  @Public()
  @Get('setup-status')
  async getSetupStatus(): Promise<{ setup: boolean }> {
    const settings = await this.settingsService.getSettings();
    return { setup: settings.setup };
  }

  /**
   * Récupère les informations système (RAM, CPU) - route publique
   */
  @Public()
  @Get('system-info')
  async getSystemInfo(): Promise<{ ram: number; cpuArch: string; cpuType: string }> {
    return this.settingsService.getSystemInfo();
  }

  /**
   * Met à jour les paramètres
   */
  @Put()
  async updateSettings(@Body() dto: UpdateSettingsDto): Promise<Settings> {
    return this.settingsService.updateSettings(dto);
  }
}

