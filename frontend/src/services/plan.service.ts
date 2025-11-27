import { apiService } from './api.service';

export interface Room {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface DevicePosition {
  deviceId: string;
  roomId: string;
  x: number;
  y: number;
}

export interface Plan {
  id: string;
  rooms: Room[];
  devicePositions: DevicePosition[];
  createdAt: string;
  updatedAt: string;
}

class PlanService {
  async getPlan(): Promise<Plan | null> {
    return apiService.get<Plan | null>('/plan');
  }

  async savePlan(rooms: Room[], devicePositions: DevicePosition[]): Promise<Plan> {
    return apiService.post<Plan>('/plan', {
      rooms,
      devicePositions,
    });
  }
}

export const planService = new PlanService();

