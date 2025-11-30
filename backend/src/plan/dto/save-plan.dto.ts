import { IsArray, IsString, IsNumber, ValidateNested, IsOptional, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';

class FloorDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @Type(() => Number)
  @IsNumber()
  order: number;
}

class PointDto {
  @Type(() => Number)
  @IsNumber()
  x: number;

  @Type(() => Number)
  @IsNumber()
  y: number;
}

class RoomDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @Type(() => Number)
  @IsNumber()
  x: number;

  @Type(() => Number)
  @IsNumber()
  y: number;

  @Type(() => Number)
  @IsNumber()
  width: number;

  @Type(() => Number)
  @IsNumber()
  height: number;

  @IsString()
  color: string;

  @IsString()
  floorId: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PointDto)
  points?: PointDto[];

  @IsOptional()
  @IsBoolean()
  isPolyline?: boolean;
}

class DevicePositionDto {
  @IsString()
  deviceId: string;

  @IsString()
  roomId: string;

  @Type(() => Number)
  @IsNumber()
  x: number;

  @Type(() => Number)
  @IsNumber()
  y: number;
}

export class SavePlanDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FloorDto)
  floors: FloorDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoomDto)
  rooms: RoomDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DevicePositionDto)
  devicePositions: DevicePositionDto[];
}

