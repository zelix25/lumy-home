import { IsString, IsEnum, IsOptional, IsObject, IsArray, ValidateNested, IsNotEmpty, IsIn, IsNumber, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
import { AutomationTriggerType, AutomationActionType } from '../../ai/entities/automation.entity';

export class AdditionalConditionDto {
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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdditionalConditionDto)
  additionalConditions?: AdditionalConditionDto[];

  @IsOptional()
  @IsIn(['AND', 'OR'])
  logicOperator?: 'AND' | 'OR';

  @IsOptional()
  @IsIn(['sunrise', 'sunset'])
  sunriseSunsetType?: 'sunrise' | 'sunset';

  @IsOptional()
  @IsNumber()
  offsetMinutes?: number;

  @IsOptional()
  @IsString()
  time?: string; // Format HH:MM (ex: "08:30")
}

export class ActionDto {
  @IsEnum(AutomationActionType)
  type: AutomationActionType;

  @ValidateIf((o) => o.type !== AutomationActionType.NOTIFY)
  @IsString()
  @IsNotEmpty()
  deviceId?: string;

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

