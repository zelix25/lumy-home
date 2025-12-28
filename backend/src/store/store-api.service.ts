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

    // Créer une instance axios pour les requêtes vers le store
    this.axiosInstance = axios.create({
      baseURL: this.storeBaseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Récupère le token API d'un utilisateur et le valide
   */
  private async getValidApiToken(userId: string): Promise<string> {
    const apiToken = await this.storeAuthService.getStoreApiToken(userId);

    if (!apiToken) {
      throw new UnauthorizedException(
        'Vous devez vous connecter au Lumy Store pour accéder à cette fonctionnalité',
      );
    }

    // Vérifier que le token a le bon format (doit commencer par "lumy_")
    if (!apiToken.startsWith('lumy_')) {
      this.logger.warn(
        `Token API invalide pour l'utilisateur ${userId}: le token ne commence pas par "lumy_" (format: ${apiToken.substring(0, 10)}...)`,
        'StoreApiService',
      );
      throw new UnauthorizedException(
        'Token API invalide: format incorrect. Le token doit commencer par "lumy_"',
      );
    }

    // Log pour déboguer (seulement les 10 premiers caractères pour la sécurité)
    this.logger.debug(
      `Token API récupéré pour l'utilisateur ${userId}: ${apiToken.substring(0, 10)}... (longueur: ${apiToken.length})`,
      'StoreApiService',
    );

    return apiToken;
  }

  /**
   * Fait une requête GET vers l'API du store (avec authentification)
   */
  async get<T = any>(
    userId: string,
    endpoint: string,
    params?: Record<string, any>,
    options?: { responseType?: 'json' | 'arraybuffer' | 'blob'; tokenStore?: string },
  ): Promise<T> {
    // Récupérer le storeApiToken de la base de données pour l'ajouter comme paramètre
    const apiToken = await this.getValidApiToken(userId);
    
    // Utiliser le tokenStore JWT si fourni, sinon utiliser le storeApiToken pour l'authentification
    const authToken = options?.tokenStore || apiToken;
    
    // Log pour confirmer l'utilisation du tokenStore JWT
    if (options?.tokenStore) {
      this.logger.debug(
        `Utilisation du tokenStore JWT pour l'authentification (${authToken.substring(0, 20)}...)`,
        'StoreApiService',
      );
    }

    try {
      this.logger.debug(
        `Requête GET vers le store: ${endpoint} avec Bearer token ${authToken.substring(0, 20)}...`,
        'StoreApiService',
      );
      
      // Ajouter le storeApiToken comme paramètre dans les requêtes
      const requestParams = {
        ...params,
        storeApiToken: apiToken,
      };
      
      // Construire la requête avec le Bearer token JWT dans le header Authorization
      const response = await this.axiosInstance.get(endpoint, {
        params: requestParams,
        headers: {
          Authorization: `Bearer ${authToken}`, // Bearer token JWT (tokenStore) ou storeApiToken
        },
        responseType: options?.responseType || 'json',
      });

      return response.data;
    } catch (error: any) {
      return await this.handleError(error, userId);
    }
  }

  /**
   * Fait une requête GET vers l'API du store sans authentification (endpoints publics)
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
          data?.message || `Erreur lors de la communication avec le store: ${error.message}`,
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

  /**
   * Fait une requête POST vers l'API du store
   */
  async post<T = any>(
    userId: string,
    endpoint: string,
    data?: any,
  ): Promise<T> {
    const apiToken = await this.getValidApiToken(userId);

    try {
      const response = await this.axiosInstance.post(endpoint, data, {
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
      });

      return response.data;
    } catch (error: any) {
      return await this.handleError(error, userId);
    }
  }

  /**
   * Fait une requête PUT vers l'API du store
   */
  async put<T = any>(
    userId: string,
    endpoint: string,
    data?: any,
  ): Promise<T> {
    const apiToken = await this.getValidApiToken(userId);

    try {
      const response = await this.axiosInstance.put(endpoint, data, {
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
      });

      return response.data;
    } catch (error: any) {
      return this.handleError(error, userId);
    }
  }

  /**
   * Fait une requête DELETE vers l'API du store
   */
  async delete<T = any>(userId: string, endpoint: string): Promise<T> {
    const apiToken = await this.getValidApiToken(userId);

    try {
      const response = await this.axiosInstance.delete(endpoint, {
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
      });

      return response.data;
    } catch (error: any) {
      return await this.handleError(error, userId);
    }
  }

  /**
   * Gère les erreurs des requêtes API
   */
  private async handleError(error: AxiosError, userId: string): Promise<never> {
    if (error.response) {
      // Erreur HTTP du store
      const status = error.response.status;
      const data = error.response.data as any;

      if (status === 401) {
        // Token invalide ou expiré
        // Récupérer le token pour le log de débogage
        const apiToken = await this.storeAuthService.getStoreApiToken(userId);
        if (apiToken) {
          this.logger.warn(
            `Token API invalide pour l'utilisateur ${userId}. Token utilisé: ${apiToken.substring(0, 10)}... (longueur: ${apiToken.length}, commence par "lumy_": ${apiToken.startsWith('lumy_')}). Réponse du store: ${JSON.stringify(data)}. URL: ${error.config?.url || 'unknown'}`,
            'StoreApiService',
          );
        } else {
          this.logger.warn(
            `Token API manquant pour l'utilisateur ${userId}. Réponse du store: ${JSON.stringify(data)}. URL: ${error.config?.url || 'unknown'}`,
            'StoreApiService',
          );
        }

        // Optionnel : déconnecter automatiquement l'utilisateur
        // await this.storeAuthService.disconnectStore(userId);

        throw new UnauthorizedException(
          data?.message || 'Votre connexion au store a expiré. Veuillez vous reconnecter.',
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
        data?.message || `Erreur lors de la communication avec le store: ${error.message}`,
      );
    }

    if (error.request) {
      // Pas de réponse du serveur
      throw new BadRequestException(
        'Impossible de contacter le Lumy Store. Vérifiez votre connexion internet.',
      );
    }

    throw new BadRequestException(
      `Erreur lors de la communication avec le store: ${error.message}`,
    );
  }

  /**
   * Valide le token API en faisant une requête de test
   */
  async validateToken(userId: string): Promise<boolean> {
    try {
      await this.get(userId, '/api/users/me');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Rafraîchit le token API en le régénérant depuis le store
   * Note: Nécessite que l'utilisateur se reconnecte avec ses credentials
   */
  async refreshToken(userId: string): Promise<{ message: string }> {
    // Pour rafraîchir le token, l'utilisateur doit se reconnecter
    // car le store ne fournit pas d'endpoint de rafraîchissement direct
    // avec l'apiToken. Il faut utiliser les credentials.
    throw new BadRequestException(
      'Pour rafraîchir votre token, veuillez vous reconnecter au store avec vos identifiants',
    );
  }
}

