import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
const AdmZip = require('adm-zip');
import axios from 'axios';
import { Plugin, PluginStatus } from './entities/plugin.entity';
import { StoreApiService } from '../store/store-api.service';
import { StoreAuthService } from '../store/store-auth.service';
import { LoggerService } from '../logger/logger.service';
import { PluginManifestValidatorService } from './plugin-manifest-validator.service';
import { PluginPermissionsService } from './plugin-permissions.service';

interface Manifest {
  name: string;
  version: string;
  displayName: string;
  description: string;
  author?: string;
  icon?: string;
  repository?: string;
  lumyVersion: string;
  permissions?: string[];
  dependencies?: Record<string, string>;
  configSchema?: Record<string, any>;
  metadata?: Record<string, any>;
}

@Injectable()
export class PluginInstallService {
  private readonly logger: Logger;
  private readonly pluginsDirectory: string;

  constructor(
    @InjectRepository(Plugin)
    private pluginRepository: Repository<Plugin>,
    private configService: ConfigService,
    private storeApiService: StoreApiService,
    private storeAuthService: StoreAuthService,
    private loggerService: LoggerService,
    private manifestValidator: PluginManifestValidatorService,
    private permissionsService: PluginPermissionsService,
  ) {
    this.logger = new Logger(PluginInstallService.name);
    // Répertoire pour stocker les plugins installés
    this.pluginsDirectory = path.join(
      process.cwd(),
      this.configService.get<string>('PLUGINS_DIRECTORY', 'plugins'),
    );

    // Créer le répertoire s'il n'existe pas
    if (!fs.existsSync(this.pluginsDirectory)) {
      fs.mkdirSync(this.pluginsDirectory, { recursive: true });
    }
  }

  /**
   * Installe un plugin depuis le Lumy Store
   */
  async installFromStore(
    userId: string,
    pluginId: string,
    tokenStore?: string,
  ): Promise<Plugin> {
    try {
      // Valider que le tokenStore est fourni
      if (!tokenStore || tokenStore.trim().length === 0) {
        throw new BadRequestException(
          'Le token JWT du store (tokenStore) est requis pour installer un plugin',
        );
      }

      this.logger.log(
        `Installation du plugin ${pluginId} avec tokenStore JWT (${tokenStore.substring(0, 20)}...)`,
        'PluginInstallService',
      );

      // 1. Récupérer les informations du plugin depuis le store
      this.logger.log(
        `Récupération des informations du plugin ${pluginId} depuis le store avec le tokenStore JWT...`,
        'PluginInstallService',
      );

      // Utiliser l'endpoint authentifié pour récupérer les informations du plugin
      // Cela permet d'avoir accès au downloadUrl et aux informations utilisateur
      let storePlugin: {
        id: string;
        name: string;
        displayName: string;
        version: string;
        description: string;
        author: string;
        icon?: string;
        repository?: string;
        lumyVersion: string;
        downloadUrl: string;
        permissions?: string[];
        dependencies?: Record<string, string>;
        configSchema?: Record<string, any>;
        metadata?: Record<string, any>;
      };

      try {
        // Utiliser le tokenStore JWT pour authentifier la requête vers le store
        storePlugin = await this.storeApiService.get<typeof storePlugin>(
          userId,
          `/api/plugins/${pluginId}`,
          undefined,
          { tokenStore }, // Le tokenStore sera utilisé comme Bearer token dans le header Authorization
        );
        
        this.logger.debug(
          `Plugin ${pluginId} récupéré avec succès depuis le store avec le tokenStore JWT`,
          'PluginInstallService',
        );
      } catch (error: any) {
        // Si l'authentification échoue, essayer l'endpoint public
        this.logger.warn(
          `Impossible d'utiliser l'endpoint authentifié pour ${pluginId} avec le tokenStore, utilisation de l'endpoint public`,
          'PluginInstallService',
        );
        storePlugin = await this.storeApiService.getPublic<typeof storePlugin>(
          `/api/plugins/public/${pluginId}`,
        );
      }

      if (!storePlugin) {
        throw new NotFoundException(
          `Plugin ${pluginId} non trouvé dans le store`,
        );
      }

      if (!storePlugin.downloadUrl) {
        throw new BadRequestException(
          'Le plugin n\'a pas de package disponible pour téléchargement',
        );
      }

      // Vérifier si le plugin est déjà installé
      const existingPlugin = await this.pluginRepository.findOne({
        where: { name: storePlugin.name },
      });

      if (existingPlugin) {
        throw new BadRequestException(
          `Un plugin avec le nom "${storePlugin.name}" est déjà installé`,
        );
      }

      // 2. Télécharger le package ZIP
      this.logger.log(
        `Téléchargement du package pour ${storePlugin.name}...`,
        'PluginInstallService',
      );

      const zipBuffer = await this.downloadPluginPackage(
        userId,
        storePlugin.downloadUrl,
        tokenStore,
      );

      // 3. Extraire et valider le package
      this.logger.log(
        `Extraction et validation du package pour ${storePlugin.name}...`,
        'PluginInstallService',
      );

      const manifest = await this.extractAndValidatePackage(
        zipBuffer,
        storePlugin.name,
      );

      // 4. Installer le plugin dans le répertoire plugins/
      const installPath = await this.installPluginFiles(
        zipBuffer,
        manifest.name,
        manifest.version,
      );

      // 5. Valider les permissions avant l'installation
      const permissions = manifest.permissions || storePlugin.permissions || [];
      if (permissions.length > 0) {
        this.permissionsService.validatePermissions(permissions);
      }

      // 6. Créer l'entrée dans la base de données
      const plugin = this.pluginRepository.create({
        name: manifest.name,
        displayName: manifest.displayName,
        version: manifest.version,
        description: manifest.description,
        author: manifest.author || storePlugin.author,
        icon: manifest.icon || storePlugin.icon,
        repository: manifest.repository || storePlugin.repository,
        lumyVersion: manifest.lumyVersion,
        installPath,
        status: PluginStatus.INSTALLED,
        config: {},
        permissions,
        dependencies: manifest.dependencies || storePlugin.dependencies || {},
        configSchema: manifest.configSchema || storePlugin.configSchema,
        metadata: {
          ...manifest.metadata,
          ...storePlugin.metadata,
          storePluginId: pluginId,
          installedFromStore: true,
          installedAt: new Date().toISOString(),
        },
      });

      const savedPlugin = await this.pluginRepository.save(plugin);

      this.logger.log(
        `Plugin installé avec succès: ${savedPlugin.name} (v${savedPlugin.version})`,
        'PluginInstallService',
      );

      return savedPlugin;
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de l'installation du plugin ${pluginId}: ${error.message}`,
        'PluginInstallService',
      );
      throw error;
    }
  }

  /**
   * Télécharge le package ZIP depuis le store
   */
  private async downloadPluginPackage(
    userId: string,
    downloadUrl: string,
    tokenStore?: string,
  ): Promise<Buffer> {
    try {
      // Valider que le tokenStore est fourni
      if (!tokenStore || tokenStore.trim().length === 0) {
        throw new BadRequestException(
          'Le token JWT du store (tokenStore) est requis pour télécharger le package',
        );
      }

      // Récupérer le storeApiToken de la base de données pour l'ajouter comme paramètre
      const apiToken = await this.storeAuthService.getStoreApiToken(userId);

      if (!apiToken) {
        throw new BadRequestException(
          'Vous devez être connecté au Lumy Store pour installer des plugins',
        );
      }

      // Utiliser le tokenStore JWT pour l'authentification Bearer
      const authToken = tokenStore;

      this.logger.debug(
        `Téléchargement du package avec tokenStore JWT (${authToken.substring(0, 20)}...) et storeApiToken comme paramètre`,
        'PluginInstallService',
      );

      const storeBaseUrl =
        this.configService.get<string>(
          'STORE_BASE_URL',
          'https://store.lumy-home.com',
        ) || 'https://store.lumy-home.com';

      // Construire l'URL complète si c'est une URL relative
      const fullUrl = downloadUrl.startsWith('http')
        ? downloadUrl
        : `${storeBaseUrl}${downloadUrl}`;

      // Ajouter le storeApiToken comme paramètre dans l'URL
      const finalUrl = (() => {
        try {
          const url = new URL(fullUrl);
          url.searchParams.append('storeApiToken', apiToken);
          return url.toString();
        } catch (error) {
          // Si l'URL n'est pas valide, essayer d'ajouter le paramètre manuellement
          const separator = fullUrl.includes('?') ? '&' : '?';
          return `${fullUrl}${separator}storeApiToken=${encodeURIComponent(apiToken)}`;
        }
      })();

      // Construire la requête avec le Bearer token JWT dans le header Authorization
      this.logger.debug(
        `Requête GET vers ${finalUrl} avec Bearer token JWT (${authToken.substring(0, 20)}...)`,
        'PluginInstallService',
      );

      const response = await axios.get(finalUrl, {
        headers: {
          Authorization: `Bearer ${authToken}`, // Bearer token JWT (tokenStore)
        },
        responseType: 'arraybuffer',
      });

      this.logger.debug(
        `Package téléchargé avec succès (${response.data.byteLength} octets)`,
        'PluginInstallService',
      );

      return Buffer.from(response.data);
    } catch (error: any) {
      this.logger.error(
        `Erreur lors du téléchargement du package: ${error.message}`,
        'PluginInstallService',
      );
      throw new BadRequestException(
        `Erreur lors du téléchargement du package: ${error.message}`,
      );
    }
  }

  /**
   * Extrait et valide le package ZIP
   */
  private async extractAndValidatePackage(
    zipBuffer: Buffer,
    pluginName: string,
  ): Promise<Manifest> {
    const tempDir = path.join(
      process.cwd(),
      'temp',
      `plugin-${crypto.randomUUID()}`,
    );
    const extractPath = path.join(tempDir, 'extracted');

    try {
      // Créer le répertoire temporaire
      await fs.ensureDir(extractPath);

      // Extraire le ZIP
      const zip = new AdmZip(zipBuffer);
      zip.extractAllTo(extractPath, true);

      // Vérifier que manifest.json existe
      const manifestPath = path.join(extractPath, 'manifest.json');
      if (!(await fs.pathExists(manifestPath))) {
        throw new BadRequestException(
          'manifest.json non trouvé dans le package',
        );
      }

      // Lire et valider le manifest
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      let manifest: Manifest;
      
      try {
        manifest = JSON.parse(manifestContent);
      } catch (error: any) {
        throw new BadRequestException(
          `Le manifest.json n'est pas un JSON valide: ${error.message}`,
        );
      }

      // Valider le manifest avec le service de validation
      manifest = this.manifestValidator.validateManifest(manifest);

      // Vérifier que le nom correspond
      if (manifest.name !== pluginName) {
        throw new BadRequestException(
          `Le nom du plugin dans le manifest (${manifest.name}) ne correspond pas au nom attendu (${pluginName})`,
        );
      }

      return manifest;
    } finally {
      // Nettoyer le répertoire temporaire
      if (await fs.pathExists(tempDir)) {
        await fs.remove(tempDir);
      }
    }
  }

  /**
   * Installe les fichiers du plugin dans le répertoire plugins/
   */
  private async installPluginFiles(
    zipBuffer: Buffer,
    pluginName: string,
    version: string,
  ): Promise<string> {
    const pluginDir = path.join(this.pluginsDirectory, pluginName);

    try {
      // Créer le répertoire du plugin
      await fs.ensureDir(pluginDir);

      // Extraire le ZIP dans le répertoire du plugin
      const zip = new AdmZip(zipBuffer);
      zip.extractAllTo(pluginDir, true);

      this.logger.log(
        `Fichiers du plugin installés dans: ${pluginDir}`,
        'PluginInstallService',
      );

      return pluginDir;
    } catch (error: any) {
      // Nettoyer en cas d'erreur
      if (await fs.pathExists(pluginDir)) {
        await fs.remove(pluginDir);
      }
      throw new BadRequestException(
        `Erreur lors de l'installation des fichiers: ${error.message}`,
      );
    }
  }
}

