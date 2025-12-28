import { IsObject, IsNotEmpty } from 'class-validator';

export class UpdateConfigDto {
  @IsObject()
  @IsNotEmpty()
  config: Record<string, any>;
}

