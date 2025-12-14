import { IsString, IsNotEmpty } from 'class-validator';

export class InstallFromStoreDto {
  @IsString()
  @IsNotEmpty()
  pluginId: string; // ID du plugin dans le Lumy Store
}

