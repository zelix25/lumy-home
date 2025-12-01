import { apiService } from './api.service';

export enum SensorType {
  TEMPERATURE = 'temperature',
  HUMIDITY = 'humidity',
  PRESSURE = 'pressure',
  ILLUMINANCE = 'illuminance',
  BATTERY = 'battery',
  VOLTAGE = 'voltage',
  LINKQUALITY = 'linkquality',
}

export interface SensorHistoryItem {
  id: string;
  deviceId: string;
  sensorType: SensorType;
  value: number;
  timestamp: string;
}

export interface SensorHistoryFilters {
  deviceId?: string;
  sensorType?: SensorType;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface SensorHistoryResponse {
  items: SensorHistoryItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface SensorHistoryStats {
  total: number;
  bySensorType: Record<string, number>;
  byDevice: Record<string, number>;
  recentData: number;
}

class SensorHistoryService {
  async getHistory(filters?: SensorHistoryFilters): Promise<SensorHistoryResponse> {
    const params = new URLSearchParams();
    
    if (filters?.deviceId) {
      params.append('deviceId', filters.deviceId);
    }
    if (filters?.sensorType) {
      params.append('sensorType', filters.sensorType);
    }
    if (filters?.startDate) {
      params.append('startDate', filters.startDate);
    }
    if (filters?.endDate) {
      params.append('endDate', filters.endDate);
    }
    if (filters?.limit) {
      params.append('limit', filters.limit.toString());
    }
    if (filters?.offset) {
      params.append('offset', filters.offset.toString());
    }

    const queryString = params.toString();
    const endpoint = queryString ? `/history?${queryString}` : '/history';
    
    return apiService.get<SensorHistoryResponse>(endpoint);
  }

  async getStats(): Promise<SensorHistoryStats> {
    return apiService.get<SensorHistoryStats>('/history/stats');
  }
}

export const sensorHistoryService = new SensorHistoryService();


