import { Controller, Get, Post, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { WeatherService } from './weather.service';
import { Weather } from './entities/weather.entity';

@Controller('weather')
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  @Get('today')
  @HttpCode(HttpStatus.OK)
  async getTodayWeather(): Promise<Weather | null> {
    const result = await this.weatherService.getTodayWeather();
    // S'assurer que null est retourné explicitement (NestJS le sérialisera en JSON)
    return result ?? null;
  }

  @Post('update')
  async updateWeather(): Promise<{ message: string }> {
    await this.weatherService.updateWeather();
    return { message: 'Météo mise à jour avec succès' };
  }

  @Get('history')
  async getWeatherHistory(@Query('limit') limit?: string): Promise<Weather[]> {
    const limitNum = limit ? parseInt(limit, 10) : 30;
    return await this.weatherService.getWeatherHistory(limitNum);
  }

  @Get('debug')
  async getDebugInfo(): Promise<{
    hasCoordinates: boolean;
    coordinates: { latitude: number | null; longitude: number | null } | null;
    todayWeatherExists: boolean;
    totalWeatherRecords: number;
    lastWeatherDate: string | null;
    allDates: string[];
    todayStr: string;
  }> {
    return await this.weatherService.getDebugInfo();
  }
}

