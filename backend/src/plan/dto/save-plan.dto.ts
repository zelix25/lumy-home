import { IsArray, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class RoomDto {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

class DevicePositionDto {
  deviceId: string;
  roomId: string;
  x: number;
  y: number;
}

export class SavePlanDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoomDto)
  rooms: RoomDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DevicePositionDto)
  devicePositions: DevicePositionDto[];
}

