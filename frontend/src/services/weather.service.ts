import { apiService } from './api.service';

export interface Weather {
  id: string;
  latitude: number;
  longitude: number;
  date: string;
  sunrise: string | null;
  sunset: string | null;
  temperature_2m: number | null;
  relative_humidity_2m: number | null;
  wind_speed_10m: number | null;
  precipitation: number | null;
  weather_code: number | null;
  raw_data: string | null;
  createdAt: string;
}

class WeatherService {
  async getTodayWeather(): Promise<Weather | null> {
    try {
      const result = await apiService.get<Weather | null>('/weather/today');
      // Si la réponse est null ou undefined, retourner null
      return result ?? null;
    } catch (error) {
      console.error('Erreur lors de la récupération de la météo:', error);
      return null;
    }
  }

  async updateWeather(): Promise<{ message: string }> {
    return apiService.post<{ message: string }>('/weather/update');
  }

  async getWeatherHistory(limit: number = 30): Promise<Weather[]> {
    try {
      return await apiService.get<Weather[]>(`/weather/history?limit=${limit}`);
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'historique météo:', error);
      return [];
    }
  }
}

export const weatherService = new WeatherService();

