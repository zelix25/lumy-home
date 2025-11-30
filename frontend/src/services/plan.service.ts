import { apiService } from './api.service';

export interface Floor {
  id: string;
  name: string;
  order: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Room {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  floorId: string;
  points?: Point[]; // Pour les polylignes (polygones)
  isPolyline?: boolean; // Indique si c'est une polyligne ou un rectangle
}

export interface DevicePosition {
  deviceId: string;
  roomId: string;
  x: number;
  y: number;
}

export interface Plan {
  id: string;
  floors: Floor[];
  rooms: Room[];
  devicePositions: DevicePosition[];
  createdAt: string;
  updatedAt: string;
}

class PlanService {
  async getPlan(): Promise<Plan | null> {
    return apiService.get<Plan | null>('/plan');
  }

  async savePlan(floors: Floor[], rooms: Room[], devicePositions: DevicePosition[]): Promise<Plan> {
    return apiService.post<Plan>('/plan', {
      floors,
      rooms,
      devicePositions,
    });
  }

  async deleteAllPlans(): Promise<void> {
    return apiService.delete<void>('/plan');
  }
}

export const planService = new PlanService();

