import { apiService } from './api.service';

export interface Device {
  ieeeAddress: string;
  friendlyName: string;
  type: string;
  status: string;
  manufacturer: string | null;
  model: string | null;
  description: string | null;
  room: string | null;
  state: Record<string, any> | null;
  meta: Record<string, any> | null;
  isSupported: boolean;
  unsupportedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceStats {
  total: number;
  byType: Record<string, number>;
  online: number;
  offline: number;
  supported: number;
  unsupported: number;
}

class DevicesService {
  async getAllDevices(): Promise<Device[]> {
    return apiService.get<Device[]>('/devices');
  }

  async getDevice(ieeeAddress: string): Promise<Device> {
    return apiService.get<Device>(`/devices/${ieeeAddress}`);
  }

  async getDevicesByType(type: string): Promise<Device[]> {
    return apiService.get<Device[]>(`/devices/type/${type}`);
  }

  async getStats(): Promise<DeviceStats> {
    return apiService.get<DeviceStats>('/devices/stats');
  }

  async updateFriendlyName(
    ieeeAddress: string,
    friendlyName: string,
  ): Promise<Device> {
    return apiService.put<Device>(`/devices/${ieeeAddress}/friendly-name`, {
      friendlyName,
    });
  }

  async updateRoom(ieeeAddress: string, room: string): Promise<Device> {
    return apiService.put<Device>(`/devices/${ieeeAddress}/room`, { room });
  }

  async sendCommand(
    ieeeAddress: string,
    command: Record<string, any>,
  ): Promise<void> {
    await apiService.post(`/devices/${ieeeAddress}/command`, { command });
  }

  async startDiscovery(duration: number = 254): Promise<{ success: boolean; message: string; duration: number }> {
    return apiService.post<{ success: boolean; message: string; duration: number }>(
      '/devices/discovery/start',
      { duration },
    );
  }

  async stopDiscovery(): Promise<{ success: boolean; message: string }> {
    return apiService.post<{ success: boolean; message: string }>('/devices/discovery/stop');
  }

  async sendMqttMessage(
    topic: string,
    payload: Record<string, any> | string,
  ): Promise<{ success: boolean; message: string }> {
    const body: any = { topic };
    if (typeof payload === 'string') {
      body.payloadString = payload;
    } else {
      body.payload = payload;
    }
    return apiService.post<{ success: boolean; message: string }>('/devices/mqtt/send', body);
  }

  async getMqttStatus(): Promise<{
    connected: boolean;
    brokerUrl: string;
    clientId: string;
    messagesReceived: number;
    messagesSent: number;
    lastMessageReceived?: string;
    lastMessageSent?: string;
    subscribedTopics: string[];
  }> {
    return apiService.get('/devices/mqtt/status');
  }

  async reconnectMqtt(): Promise<{ success: boolean; message: string }> {
    return apiService.post<{ success: boolean; message: string }>('/devices/mqtt/reconnect');
  }

  async deleteDevice(ieeeAddress: string): Promise<void> {
    return apiService.delete<void>(`/devices/${ieeeAddress}`);
  }
}

export const devicesService = new DevicesService();

