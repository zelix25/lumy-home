import { Controller, Get, Post, Param, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SystemHealthService } from './system-health.service';
import { SystemNotificationResponseDto } from './dto/system-notification-response.dto';

@Controller('system-health')
@UseGuards(JwtAuthGuard)
export class SystemHealthController {
  constructor(private readonly systemHealthService: SystemHealthService) {}

  /**
   * Récupère toutes les notifications système non résolues
   */
  @Get('notifications')
  async getNotifications(
    @Query('limit') limit?: string,
  ): Promise<SystemNotificationResponseDto[]> {
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    if (limitNum) {
      return this.systemHealthService.getAllNotifications(limitNum);
    }
    return this.systemHealthService.getUnresolvedNotifications();
  }

  /**
   * Marque une notification comme résolue
   */
  @Post('notifications/:id/resolve')
  async markAsResolved(@Param('id') id: string): Promise<{ success: boolean }> {
    await this.systemHealthService.markAsResolved(id);
    return { success: true };
  }

  /**
   * Déclenche une vérification manuelle de santé
   */
  @Post('check')
  async checkHealth(): Promise<{ success: boolean; message: string }> {
    await this.systemHealthService.checkDockerContainers();
    return {
      success: true,
      message: 'Vérification de santé effectuée',
    };
  }
}

