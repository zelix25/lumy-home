import { IsString, IsNotEmpty, IsObject, IsOptional } from 'class-validator';

export class SendMqttMessageDto {
  @IsString()
  @IsNotEmpty()
  topic: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, any>;

  @IsOptional()
  @IsString()
  payloadString?: string;
}

