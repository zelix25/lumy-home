import { IsOptional, IsString, MaxLength, Matches } from 'class-validator';

export class UpdateIconDto {
  /** Clé d'icône UI (ex. button, lightbulb). null/vide = icône automatique. */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[a-z0-9_]*$/, {
    message: 'icon must contain only lowercase letters, digits and underscores',
  })
  icon?: string | null;
}
