import { History, HistoryEventType } from '../entities/history.entity';

export class HistoryResponseDto {
  id: string;
  eventType: HistoryEventType;
  deviceId?: string;
  deviceName?: string;
  automationId?: string;
  automationName?: string;
  description: string;
  data?: Record<string, any>;
  room?: string;
  timestamp: Date;

  static fromEntity(history: History): HistoryResponseDto {
    return {
      id: history.id,
      eventType: history.eventType,
      deviceId: history.deviceId,
      deviceName: history.deviceName,
      automationId: history.automationId,
      automationName: history.automationName,
      description: history.description,
      data: history.data,
      room: history.room,
      timestamp: history.timestamp,
    };
  }
}

