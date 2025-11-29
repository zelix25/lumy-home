import { PartialType } from '@nestjs/mapped-types';
import { CreateAutomationDto } from './create-automation.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { AutomationStatus } from '../../ai/entities/automation.entity';

export class UpdateAutomationDto extends PartialType(CreateAutomationDto) {
  @IsOptional()
  @IsEnum(AutomationStatus)
  status?: AutomationStatus;
}

