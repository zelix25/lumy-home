import { BadRequestException, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SystemService } from './system.service';

@Controller('system')
@UseGuards(JwtAuthGuard)
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  /**
   * Récupère les logs d'un conteneur Docker.
   */
  @Get('logs/:containerName')
  async getContainerLogs(
    @Param('containerName') containerName: string,
    @Query('tail') tail?: string,
  ): Promise<{ containerName: string; tail: number; logs: string }> {
    let parsedTail: number | undefined;
    if (tail !== undefined) {
      const n = parseInt(tail, 10);
      if (Number.isNaN(n) || n <= 0 || n > 5000) {
        throw new BadRequestException('Le paramètre tail doit être un entier entre 1 et 5000');
      }
      parsedTail = n;
    }
    return this.systemService.getContainerLogs(containerName, parsedTail);
  }

  /**
   * Redémarre le système
   */
  @Post('restart')
  async restart(): Promise<{ success: boolean; message: string }> {
    return this.systemService.restart();
  }

  /**
   * Arrête le système
   */
  @Post('shutdown')
  async shutdown(): Promise<{ success: boolean; message: string }> {
    return this.systemService.shutdown();
  }
}
