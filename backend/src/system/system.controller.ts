import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SystemService } from './system.service';

@Controller('system')
@UseGuards(JwtAuthGuard)
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

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
