import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class GenerateAutomationDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10, {
    message: 'La phrase doit contenir au moins 10 caractères',
  })
  query: string;
}

