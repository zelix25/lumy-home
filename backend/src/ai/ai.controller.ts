import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AiService } from './ai.service';
import { GenerateAutomationDto } from './dto/generate-automation.dto';
import { AutomationResponseDto } from './dto/automation-response.dto';
import { AutomationStatus } from './entities/automation.entity';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  /**
   * Génère une automatisation à partir d'une phrase en langage naturel
   */
  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  async generateAutomation(
    @Body() dto: GenerateAutomationDto,
  ): Promise<AutomationResponseDto> {
    return this.aiService.generateAutomation(dto.query);
  }

  /**
   * Liste toutes les automatisations
   */
  @Get('automations')
  async findAll(): Promise<AutomationResponseDto[]> {
    return this.aiService.findAll();
  }

  /**
   * Récupère une automatisation par ID
   */
  @Get('automations/:id')
  async findOne(@Param('id') id: string): Promise<AutomationResponseDto> {
    return this.aiService.findOne(id);
  }

  /**
   * Active ou désactive une automatisation
   */
  @Patch('automations/:id/status')
  async toggleStatus(
    @Param('id') id: string,
    @Body('status') status: AutomationStatus,
  ): Promise<AutomationResponseDto> {
    return this.aiService.toggleStatus(id, status);
  }

  /**
   * Supprime une automatisation
   */
  @Delete('automations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return this.aiService.remove(id);
  }

  /**
   * Vérifie si le serveur Llama est disponible
   */
  @Get('status')
  async checkStatus(): Promise<{ available: boolean; message?: string }> {
    return this.aiService.checkLlamaAvailability();
  }
}

