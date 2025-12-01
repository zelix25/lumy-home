import { History, SensorType } from '../entities/history.entity';

export class HistoryResponseDto {
  id: string;
  deviceId: string;
  sensorType: SensorType;
  value: number;
  timestamp: Date;

  static fromEntity(history: History): HistoryResponseDto {
    return {
      id: history.id,
      deviceId: history.deviceId,
      sensorType: history.sensorType,
      value: history.value,
      timestamp: history.timestamp,
    };
  }
}


