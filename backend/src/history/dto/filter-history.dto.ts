import { IsOptional, IsString, IsIn, IsDateString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { SensorType } from '../entities/history.entity';

export class FilterHistoryDto {
  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  @IsIn(Object.values(SensorType) as string[], {
    message: `sensorType must be one of: ${Object.values(SensorType).join(', ')}`,
  })
  sensorType?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

