import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { User } from '../auth/entities/user.entity';
import { LoggerService } from '../logger/logger.service';
import { StoreAuthService } from './store-auth.service';

@Injectable()
export class StoreApiService {
  private readonly logger: Logger;
  private readonly storeBaseUrl: string;
  private readonly axiosInstance: AxiosInstance;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private configService: ConfigService,
    private loggerService: LoggerService,
    private storeAuthService: StoreAuthService,
  ) {
    this.logger = new Logger(StoreApiService.name);
    this.storeBaseUrl =
      this.configService.get<string>(
        'STORE_BASE_URL',
        'https://store.lumy-home.com',
      ) || 'https://store.lumy-home.com';

    this.axiosInstance = axios.create({
      baseURL: this.storeBaseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Récupère et valide le format de la clé API stockée côté serveur.
   */
  private async getValidApiToken(userId: string): Promise<string> {
    const apiToken = await this.storeAuthService.getStoreApiToken(userId);

    if (!apiToken) {
      throw new UnauthorizedException(
        'Vous devez connecter une clé API Lumy Store pour accéder à cette fonctionnalité',
      );
    }

    if (!apiToken.startsWith('lumy_')) {
      this.logger.warn(
        `Clé API au format invalide pour l'utilisateur ${userId}`,
        'StoreApiService',
      );
      throw new UnauthorizedException(
        'Clé API invalide: le format attendu commence par "lumy_"',
      );
    }

    return apiToken;
  }

  private authHeaders(apiToken: string): Record<string, string> {
    return {
      Authorization: `Bearer ${apiToken}`,
      'X-API-Token': apiToken,
    };
  }

  /**
   * Requête GET authentifiée vers le store (clé API uniquement, jamais en query string)
   */
  async get<T = any>(
    userId: string,
    endpoint: string,
    params?: Record<string, any>,
    options?: { responseType?: 'json' | 'arraybuffer' | 'blob' },
  ): Promise<T> {
    const apiToken = await this.getValidApiToken(userId);

    try {
      const response = await this.axiosInstance.get(endpoint, {
        params,
        headers: this.authHeaders(apiToken),
        responseType: options?.responseType || 'json',
      });

      return response.data;
    } catch (error: any) {
      return await this.handleError(error, userId);
    }
  }

  /**
   * Requête GET publique (sans authentification)
   */
  async getPublic<T = any>(
    endpoint: string,
    params?: Record<string, any>,
    options?: { responseType?: 'json' | 'arraybuffer' | 'blob' },
  ): Promise<T> {
    try {
      const response = await this.axiosInstance.get(endpoint, {
        params,
        responseType: options?.responseType || 'json',
      });

      return response.data;
    } catch (error: any) {
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data as any;

        if (status === 404) {
          throw new BadRequestException(
            data?.message || 'Ressource non trouvée sur le store',
          );
        }

        throw new BadRequestException(
          data?.message ||
            `Erreur lors de la communication avec le store: ${error.message}`,
        );
      }

      if (error.request) {
        throw new BadRequestException(
          'Impossible de contacter le Lumy Store. Vérifiez votre connexion internet.',
        );
      }

      throw new BadRequestException(
        `Erreur lors de la communication avec le store: ${error.message}`,
      );
    }
  }

  async post<T = any>(
    userId: string,
    endpoint: string,
    data?: any,
  ): Promise<T> {
    const apiToken = await this.getValidApiToken(userId);

    try {
      const response = await this.axiosInstance.post(endpoint, data, {
        headers: this.authHeaders(apiToken),
      });

      return response.data;
    } catch (error: any) {
      return await this.handleError(error, userId);
    }
  }

  async put<T = any>(
    userId: string,
    endpoint: string,
    data?: any,
  ): Promise<T> {
    const apiToken = await this.getValidApiToken(userId);

    try {
      const response = await this.axiosInstance.put(endpoint, data, {
        headers: this.authHeaders(apiToken),
      });

      return response.data;
    } catch (error: any) {
      return this.handleError(error, userId);
    }
  }

  async delete<T = any>(userId: string, endpoint: string): Promise<T> {
    const apiToken = await this.getValidApiToken(userId);

    try {
      const response = await this.axiosInstance.delete(endpoint, {
        headers: this.authHeaders(apiToken),
      });

      return response.data;
    } catch (error: any) {
      return await this.handleError(error, userId);
    }
  }

  /**
   * Télécharge une URL du store (relative ou absolue) avec la clé API en header uniquement.
   */
  async downloadBinary(userId: string, downloadUrl: string): Promise<Buffer> {
    const apiToken = await this.getValidApiToken(userId);

    const fullUrl = downloadUrl.startsWith('http')
      ? downloadUrl
      : `${this.storeBaseUrl}${downloadUrl}`;

    try {
      const response = await axios.get(fullUrl, {
        headers: this.authHeaders(apiToken),
        responseType: 'arraybuffer',
        timeout: 60000,
      });

      return Buffer.from(response.data);
    } catch (error: any) {
      return await this.handleError(error, userId);
    }
  }

  private async handleError(error: AxiosError, userId: string): Promise<never> {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data as any;

      if (status === 401) {
        this.logger.warn(
          `Clé API refusée par le store pour l'utilisateur ${userId} (${error.config?.url || 'unknown'})`,
          'StoreApiService',
        );

        throw new UnauthorizedException(
          data?.message ||
            'Votre clé API store est invalide ou a été révoquée. Veuillez en saisir une nouvelle.',
        );
      }

      if (status === 403) {
        throw new UnauthorizedException(
          data?.message || 'Accès refusé par le store',
        );
      }

      if (status === 404) {
        throw new BadRequestException(
          data?.message || 'Ressource non trouvée sur le store',
        );
      }

      throw new BadRequestException(
        data?.message ||
          `Erreur lors de la communication avec le store: ${error.message}`,
      );
    }

    if (error.request) {
      throw new BadRequestException(
        'Impossible de contacter le Lumy Store. Vérifiez votre connexion internet.',
      );
    }

    throw new BadRequestException(
      `Erreur lors de la communication avec le store: ${error.message}`,
    );
  }

  async validateToken(userId: string): Promise<boolean> {
    try {
      await this.get(userId, '/api/users/me');
      return true;
    } catch {
      return false;
    }
  }
}
