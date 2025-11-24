import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateRoomDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  room?: string;
}

