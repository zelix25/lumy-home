import { Controller, Get, Post, Query } from '@nestjs/common';
import { WeatherService } from './weather.service';
import { Weather } from './entities/weather.entity';

@Controller('weather')
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  @Get('today')
  async getTodayWeather(): Promise<Weather | null> {
    return await this.weatherService.getTodayWeather();
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
}

