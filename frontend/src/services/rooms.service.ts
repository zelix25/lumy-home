import { apiService } from './api.service';

export interface Room {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

class RoomsService {
  async getAllRooms(): Promise<Room[]> {
    return apiService.get<Room[]>('/rooms');
  }

  async createRoom(name: string): Promise<Room> {
    return apiService.post<Room>('/rooms', { name });
  }
}

export const roomsService = new RoomsService();

