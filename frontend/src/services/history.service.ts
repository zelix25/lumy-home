import { apiService } from './api.service';

export enum HistoryEventType {
  MOTION_DETECTED = 'motion_detected',
  STATE_CHANGED = 'state_changed',
  AUTOMATION_EXECUTED = 'automation_executed',
  DEVICE_ONLINE = 'device_online',
  DEVICE_OFFLINE = 'device_offline',
  DEVICE_DISCOVERED = 'device_discovered',
  BUTTON_PRESSED = 'button_pressed',
  CONTACT_CHANGED = 'contact_changed',
  TEMPERATURE_CHANGED = 'temperature_changed',
}

export interface HistoryItem {
  id: string;
  eventType: HistoryEventType;
  deviceId?: string;
  deviceName?: string;
  automationId?: string;
  automationName?: string;
  description: string;
  data?: Record<string, any>;
  room?: string;
  timestamp: string;
}

export interface HistoryFilters {
  eventType?: HistoryEventType;
  deviceId?: string;
  automationId?: string;
  room?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface HistoryResponse {
  items: HistoryItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface HistoryStats {
  total: number;
  byEventType: Record<string, number>;
  byDevice: Record<string, number>;
  recentActivity: number;
}

class HistoryService {
  async getHistory(filters?: HistoryFilters): Promise<HistoryResponse> {
    const params = new URLSearchParams();
    
    if (filters?.eventType) {
      params.append('eventType', filters.eventType);
    }
    if (filters?.deviceId) {
      params.append('deviceId', filters.deviceId);
    }
    if (filters?.automationId) {
      params.append('automationId', filters.automationId);
    }
    if (filters?.room) {
      params.append('room', filters.room);
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
    
    return apiService.get<HistoryResponse>(endpoint);
  }

  async getStats(): Promise<HistoryStats> {
    return apiService.get<HistoryStats>('/history/stats');
  }

  async cleanOldEvents(days: number): Promise<{ deleted: number }> {
    return apiService.delete<{ deleted: number }>(`/history/clean/${days}`);
  }
}

export const historyService = new HistoryService();

