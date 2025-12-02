import { IsString, IsEnum, IsOptional, IsObject, IsArray, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { AutomationTriggerType, AutomationActionType } from '../../ai/entities/automation.entity';

export class TriggerDto {
  @IsEnum(AutomationTriggerType)
  type: AutomationTriggerType;

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  deviceName?: string;

  @IsOptional()
  @IsObject()
  condition?: Record<string, any>;
}

export class ActionDto {
  @IsEnum(AutomationActionType)
  type: AutomationActionType;

  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @IsOptional()
  @IsString()
  deviceName?: string;

  @IsOptional()
  @IsObject()
  params?: Record<string, any>;
}

export class CreateAutomationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  userQuery?: string;

  @ValidateNested()
  @Type(() => TriggerDto)
  trigger: TriggerDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActionDto)
  actions: ActionDto[];
}

