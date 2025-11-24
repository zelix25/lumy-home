import { IsObject, IsNotEmpty } from 'class-validator';

export class SendCommandDto {
  @IsObject()
  @IsNotEmpty()
  command: Record<string, any>;
}

