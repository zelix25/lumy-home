import { Controller, Get, Query, Delete, Param } from '@nestjs/common';
import { HistoryService } from './history.service';
import { FilterHistoryDto } from './dto/filter-history.dto';
import { HistoryResponseDto } from './dto/history-response.dto';

@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  /**
   * Récupère l'historique avec filtres
   */
  @Get()
  async findAll(
    @Query() filters: FilterHistoryDto,
  ): Promise<{
    items: HistoryResponseDto[];
    total: number;
    limit: number;
    offset: number;
  }> {
    return this.historyService.findAll(filters);
  }

  /**
   * Récupère les statistiques de l'historique
   */
  @Get('stats')
  async getStats(): Promise<{
    total: number;
    byEventType: Record<string, number>;
    byDevice: Record<string, number>;
    recentActivity: number;
  }> {
    return this.historyService.getStats();
  }

  /**
   * Supprime les événements plus anciens qu'une date donnée
   */
  @Delete('clean/:days')
  async cleanOldEvents(@Param('days') days: string): Promise<{ deleted: number }> {
    const daysNumber = parseInt(days, 10);
    if (isNaN(daysNumber) || daysNumber < 1) {
      throw new Error('Le nombre de jours doit être un entier positif');
    }

    const olderThan = new Date();
    olderThan.setDate(olderThan.getDate() - daysNumber);

    const deleted = await this.historyService.cleanOldEvents(olderThan);
    return { deleted };
  }
}

