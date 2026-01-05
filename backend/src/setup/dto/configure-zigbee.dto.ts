import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export class ConfigureZigbeeDto {
  @IsString()
  @IsNotEmpty()
  port: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['ember', 'zstack', 'zigate', 'deconz', 'ezsp', 'zigatev3'])
  adapter: string;
}

