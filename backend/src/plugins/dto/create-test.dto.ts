import { IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean, IsNumber, IsObject, Min } from 'class-validator';
import { TestType } from '../entities/plugin-test.entity';

export class CreateTestDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  displayName: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(TestType)
  type: TestType;

  @IsOptional()
  @IsString()
  testPath?: string;

  @IsOptional()
  @IsString()
  testCommand?: string;

  @IsOptional()
  @IsObject()
  testConfig?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  timeout?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

