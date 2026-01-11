import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdaterService, UpdaterStatus, CheckResult, UpdateResult } from './updater.service';

@Controller('updater')
@UseGuards(JwtAuthGuard)
export class UpdaterController {
  constructor(private readonly updaterService: UpdaterService) {}

  /**
   * Récupère le statut du service updater
   */
  @Get('status')
  async getStatus(): Promise<UpdaterStatus> {
    return this.updaterService.getStatus();
  }

  /**
   * Vérifie les mises à jour disponibles
   */
  @Post('check')
  async checkForUpdates(): Promise<CheckResult> {
    return this.updaterService.checkForUpdates();
  }

  /**
   * Applique les mises à jour
   */
  @Post('update')
  async applyUpdate(@Body() body: { services?: string[] }): Promise<UpdateResult> {
    return this.updaterService.applyUpdate(body?.services);
  }

  /**
   * Récupère le dernier résultat de vérification
   */
  @Get('last-check')
  async getLastCheck(): Promise<CheckResult | { message: string }> {
    const result = this.updaterService.getLastCheckResult();
    return result || { message: 'Aucune vérification effectuée' };
  }
}
