import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

export class UpdateFriendlyNameDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  friendlyName: string;
}

