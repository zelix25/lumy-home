import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { User } from '../auth/entities/user.entity';
import { ConnectStoreDto } from './dto/connect-store.dto';
import { LoggerService } from '../logger/logger.service';

function maskApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (trimmed.length < 12) {
    return 'lumy_****';
  }
  return `${trimmed.slice(0, 8)}…${trimmed.slice(-4)}`;
}

@Injectable()
export class StoreAuthService {
  private readonly logger: Logger;
  private readonly storeBaseUrl: string;
  private readonly axiosInstance: AxiosInstance;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private configService: ConfigService,
    private loggerService: LoggerService,
  ) {
    this.logger = new Logger(StoreAuthService.name);
    this.storeBaseUrl =
      this.configService.get<string>(
        'STORE_BASE_URL',
        'https://store.lumy-home.com',
      ) || 'https://store.lumy-home.com';

    this.axiosInstance = axios.create({
      baseURL: this.storeBaseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Connecte la box au Lumy Store via une clé API fournie par l'utilisateur.
   * La clé est validée auprès du store puis stockée côté serveur uniquement.
   */
  async connectStore(
    userId: string,
    connectDto: ConnectStoreDto,
  ): Promise<{
    message: string;
    storeEmail: string | null;
    apiKeyMasked: string;
  }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('Utilisateur non trouvé');
    }

    const apiKey = connectDto.apiKey.trim();

    try {
      const profile = await this.fetchStoreProfile(apiKey);
      const storeEmail =
        typeof profile?.email === 'string' ? profile.email : null;

      user.storeApiToken = apiKey;
      user.storeApiTokenGeneratedAt = new Date();
      user.storeEmail = storeEmail;
      await this.userRepository.save(user);

      this.logger.log(
        `Utilisateur ${user.email} connecté au store via clé API (${maskApiKey(apiKey)})`,
        'StoreAuthService',
      );

      return {
        message: 'Connexion au store réussie',
        storeEmail,
        apiKeyMasked: maskApiKey(apiKey),
      };
    } catch (error: any) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      if (error.response) {
        if (error.response.status === 401 || error.response.status === 403) {
          // 400 (pas 401) : la session Lumy Home est valide, c'est la clé store qui est refusée.
          // Un 401 ferait déconnecter l'utilisateur côté frontend.
          throw new BadRequestException(
            'Clé API invalide ou révoquée. Vérifiez la clé sur le Lumy Store.',
          );
        }
        throw new BadRequestException(
          `Erreur lors de la connexion au store: ${error.response.data?.message || error.message}`,
        );
      }
      throw new BadRequestException(
        `Erreur lors de la connexion au store: ${error.message}`,
      );
    }
  }

  /**
   * Valide une clé API auprès du store et retourne le profil utilisateur.
   */
  private async fetchStoreProfile(apiKey: string): Promise<Record<string, any>> {
    try {
      const response = await this.axiosInstance.get('/api/users/me', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'X-API-Token': apiKey,
        },
      });

      if (response.status !== 200 || !response.data) {
        throw new BadRequestException(
          'Impossible de valider la clé API auprès du store',
        );
      }

      return response.data;
    } catch (error: any) {
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      if (error.response?.status === 401 || error.response?.status === 403) {
        throw new BadRequestException(
          'Clé API invalide ou révoquée. Vérifiez la clé sur le Lumy Store.',
        );
      }
      if (error.request && !error.response) {
        throw new BadRequestException(
          'Impossible de contacter le Lumy Store. Vérifiez votre connexion internet.',
        );
      }
      throw error;
    }
  }

  /**
   * Déconnecte un utilisateur du store (supprime la clé API stockée)
   */
  async disconnectStore(userId: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('Utilisateur non trouvé');
    }

    if (!user.storeApiToken || user.storeApiToken.trim().length === 0) {
      throw new BadRequestException('Aucune connexion au store active');
    }

    user.storeApiToken = null;
    user.storeApiTokenGeneratedAt = null;
    user.storeEmail = null;
    await this.userRepository.save(user);

    this.logger.log(
      `Utilisateur ${user.email} déconnecté du store`,
      'StoreAuthService',
    );

    return { message: 'Déconnexion du store réussie' };
  }

  /**
   * Vérifie si un utilisateur est connecté au store
   */
  async isConnectedToStore(userId: string): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'storeApiToken'],
    });

    if (!user) {
      return false;
    }

    return !!(
      user.storeApiToken &&
      typeof user.storeApiToken === 'string' &&
      user.storeApiToken.trim().length > 0
    );
  }

  /**
   * Récupère le token API du store pour un utilisateur (usage serveur uniquement)
   */
  async getStoreApiToken(userId: string): Promise<string | null> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'storeApiToken'],
    });

    return user?.storeApiToken || null;
  }

  /**
   * Statut de connexion exposable à l'UI (sans révéler la clé)
   */
  async getConnectionStatus(userId: string): Promise<{
    connected: boolean;
    storeEmail?: string;
    apiKeyMasked?: string;
  }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'storeApiToken', 'storeEmail'],
    });

    if (!user?.storeApiToken?.trim()) {
      return { connected: false };
    }

    return {
      connected: true,
      storeEmail: user.storeEmail || undefined,
      apiKeyMasked: maskApiKey(user.storeApiToken),
    };
  }

  /**
   * Vérifie si le token API est toujours accepté par le store
   */
  async validateApiToken(userId: string): Promise<boolean> {
    const apiToken = await this.getStoreApiToken(userId);

    if (!apiToken) {
      return false;
    }

    try {
      await this.fetchStoreProfile(apiToken);
      return true;
    } catch (error: any) {
      if (error instanceof UnauthorizedException) {
        this.logger.warn(
          `Clé API invalide pour l'utilisateur ${userId}`,
          'StoreAuthService',
        );
        return false;
      }
      // Erreur réseau : on ne invalide pas la clé stockée
      return true;
    }
  }
}
