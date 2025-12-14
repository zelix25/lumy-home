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

    // Créer une instance axios pour les requêtes vers le store
    this.axiosInstance = axios.create({
      baseURL: this.storeBaseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Connecte un utilisateur au Lumy Store et récupère son apiToken
   */
  async connectStore(
    userId: string,
    connectDto: ConnectStoreDto,
  ): Promise<{ message: string; storeEmail: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('Utilisateur non trouvé');
    }

    try {
      // 1. Se connecter au store avec les credentials
      const loginResponse = await this.axiosInstance.post('/api/users/login', {
        email: connectDto.email,
        password: connectDto.password,
      });

      const accessToken = loginResponse.data.accessToken;

      if (!accessToken) {
        throw new UnauthorizedException(
          'Impossible de récupérer le token d\'accès du store',
        );
      }

      // 2. Récupérer l'apiToken avec le token d'accès
      let apiTokenResponse;
      try {
        apiTokenResponse = await this.axiosInstance.get(
          '/api/users/me/api-token',
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );
      } catch (error: any) {
        this.logger.error(
          `Erreur lors de la récupération de l'apiToken: ${error.message}`,
          'StoreAuthService',
        );
        throw new BadRequestException(
          `Erreur lors de la récupération du token API du store: ${error.response?.data?.message || error.message}`,
        );
      }

      // Log pour debug
      this.logger.debug(
        `Réponse apiToken: ${JSON.stringify(apiTokenResponse.data)}`,
        'StoreAuthService',
      );

      let apiToken = apiTokenResponse.data?.apiToken;

      // Si l'utilisateur n'a pas d'apiToken, on le régénère automatiquement
      if (!apiToken) {
        this.logger.log(
          'L\'utilisateur n\'a pas d\'apiToken, régénération en cours...',
          'StoreAuthService',
        );
        try {
          const regenerateResponse = await this.axiosInstance.post(
            '/api/users/me/api-token/regenerate',
            {},
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            },
          );
          apiToken = regenerateResponse.data?.apiToken;
        } catch (error: any) {
          this.logger.error(
            `Erreur lors de la régénération de l'apiToken: ${error.message}`,
            'StoreAuthService',
          );
          throw new BadRequestException(
            `Erreur lors de la génération du token API du store: ${error.response?.data?.message || error.message}`,
          );
        }
      }

      if (!apiToken) {
        this.logger.error(
          `Impossible de récupérer l'apiToken après régénération. Réponse: ${JSON.stringify(apiTokenResponse.data)}`,
          'StoreAuthService',
        );
        throw new BadRequestException(
          'Impossible de récupérer le token API du store. Vérifiez que votre compte store est bien configuré.',
        );
      }

      // 3. Stocker l'apiToken dans l'entité User
      user.storeApiToken = apiToken;
      user.storeApiTokenGeneratedAt = new Date();
      await this.userRepository.save(user);

      this.logger.log(
        `Utilisateur ${user.email} connecté au store avec succès`,
        'StoreAuthService',
      );

      return {
        message: 'Connexion au store réussie',
        storeEmail: connectDto.email,
      };
    } catch (error: any) {
      if (error.response) {
        // Erreur HTTP du store
        if (error.response.status === 401) {
          throw new UnauthorizedException(
            'Email ou mot de passe incorrect pour le store',
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
   * Déconnecte un utilisateur du store (supprime le token)
   */
  async disconnectStore(userId: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('Utilisateur non trouvé');
    }

    if (!user.storeApiToken) {
      throw new BadRequestException('Aucune connexion au store active');
    }

    user.storeApiToken = '';
    user.storeApiTokenGeneratedAt = new Date();
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

    return !!user?.storeApiToken;
  }

  /**
   * Récupère le token API du store pour un utilisateur
   */
  async getStoreApiToken(userId: string): Promise<string | null> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'storeApiToken'],
    });

    return user?.storeApiToken || null;
  }

  /**
   * Vérifie si le token API est valide et non expiré
   * Note: Le store ne fournit pas d'expiration explicite pour l'apiToken,
   * mais on peut vérifier s'il est toujours valide en faisant une requête test
   */
  async validateApiToken(userId: string): Promise<boolean> {
    const apiToken = await this.getStoreApiToken(userId);

    if (!apiToken) {
      return false;
    }

    // Faire une requête test vers le store pour valider le token
    try {
      const response = await this.axiosInstance.get('/api/users/me', {
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
      });

      return response.status === 200;
    } catch (error: any) {
      if (error.response?.status === 401) {
        // Token invalide ou expiré
        this.logger.warn(
          `Token API invalide pour l'utilisateur ${userId}`,
          'StoreAuthService',
        );
        return false;
      }
      // Autre erreur (réseau, etc.) - on considère le token comme valide
      return true;
    }
  }

  /**
   * Régénère le token API en se reconnectant au store
   * Nécessite que l'utilisateur fournisse à nouveau ses credentials
   */
  async regenerateApiToken(
    userId: string,
    connectDto: ConnectStoreDto,
  ): Promise<{ message: string }> {
    // Se reconnecter au store pour obtenir un nouveau token
    return this.connectStore(userId, connectDto);
  }
}

