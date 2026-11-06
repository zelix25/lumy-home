import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ConnectStoreDto {
  /**
   * Clé API fournie par le Lumy Store (format lumy_...).
   * Générée depuis le compte utilisateur sur le store — ne jamais utiliser email/mot de passe.
   */
  @IsString()
  @IsNotEmpty()
  @MinLength(20)
  @MaxLength(255)
  @Matches(/^lumy_[A-Za-z0-9_-]+$/, {
    message: 'La clé API doit commencer par "lumy_" et ne contenir que des caractères valides',
  })
  apiKey: string;
}
