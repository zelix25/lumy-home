import { Controller, Get, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { HistoryService } from './history.service';
import { FilterHistoryDto } from './dto/filter-history.dto';
import { HistoryResponseDto } from './dto/history-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';

@ApiTags('history')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: HttpStatus.OK, description: 'List of sensor history data.', type: [HistoryResponseDto] })
  @ApiQuery({ name: 'deviceId', required: false, description: 'Filter by device ID' })
  @ApiQuery({ name: 'sensorType', required: false, enum: ['temperature', 'humidity', 'pressure', 'illuminance', 'battery', 'voltage', 'linkquality'] })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (ISO 8601)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Maximum number of results' })
  @ApiQuery({ name: 'offset', required: false, description: 'Offset for pagination' })
  async findAll(@Query() filters: FilterHistoryDto): Promise<{
    items: HistoryResponseDto[];
    total: number;
    limit: number;
    offset: number;
  }> {
    return this.historyService.findAll(filters);
  }

  @Get('stats')
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: HttpStatus.OK, description: 'History statistics.' })
  async getStats(): Promise<{
    total: number;
    bySensorType: Record<string, number>;
    byDevice: Record<string, number>;
    recentData: number;
  }> {
    return this.historyService.getStats();
  }
}


