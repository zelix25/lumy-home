import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as semver from 'semver';

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
export class PluginManifestValidatorService {
  private readonly logger: Logger;

  constructor() {
    this.logger = new Logger(PluginManifestValidatorService.name);
  }

  /**
   * Valide un manifest.json complet
   */
  validateManifest(manifest: any): Manifest {
    // Vérifier que c'est un objet
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
      throw new BadRequestException(
        'Le manifest.json doit être un objet JSON valide',
      );
    }

    // Vérifier les champs requis
    const required = ['name', 'version', 'displayName', 'description', 'lumyVersion'];
    for (const field of required) {
      if (!manifest[field]) {
        throw new BadRequestException(
          `Champ requis manquant dans manifest.json: ${field}`,
        );
      }

      if (typeof manifest[field] !== 'string') {
        throw new BadRequestException(
          `Le champ ${field} doit être une chaîne de caractères`,
        );
      }
    }

    // Valider le format du nom (slug)
    this.validateName(manifest.name);

    // Valider le format de la version (semver)
    this.validateVersion(manifest.version);

    // Valider le format de lumyVersion (semver range)
    this.validateLumyVersion(manifest.lumyVersion);

    // Valider les permissions si présentes
    if (manifest.permissions) {
      this.validatePermissions(manifest.permissions);
    }

    // Valider les dépendances si présentes
    if (manifest.dependencies) {
      this.validateDependencies(manifest.dependencies);
    }

    // Valider le configSchema si présent (JSON Schema)
    if (manifest.configSchema) {
      this.validateConfigSchema(manifest.configSchema);
    }

    return manifest as Manifest;
  }

  /**
   * Valide le nom du plugin (slug)
   */
  private validateName(name: string): void {
    // Le nom doit être un slug valide (minuscules, tirets, chiffres)
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(name)) {
      throw new BadRequestException(
        `Le nom du plugin "${name}" n'est pas valide. Il doit contenir uniquement des lettres minuscules, des chiffres et des tirets`,
      );
    }

    // Le nom ne doit pas commencer ou se terminer par un tiret
    if (name.startsWith('-') || name.endsWith('-')) {
      throw new BadRequestException(
        `Le nom du plugin "${name}" ne peut pas commencer ou se terminer par un tiret`,
      );
    }

    // Le nom doit avoir une longueur raisonnable
    if (name.length < 2 || name.length > 50) {
      throw new BadRequestException(
        `Le nom du plugin doit contenir entre 2 et 50 caractères`,
      );
    }
  }

  /**
   * Valide le format de la version (semver)
   */
  private validateVersion(version: string): void {
    if (!semver.valid(version)) {
      throw new BadRequestException(
        `La version "${version}" n'est pas une version semver valide (ex: 1.0.0)`,
      );
    }
  }

  /**
   * Valide le format de lumyVersion (semver range)
   */
  private validateLumyVersion(lumyVersion: string): void {
    // Vérifier que c'est une plage semver valide
    if (!semver.validRange(lumyVersion)) {
      throw new BadRequestException(
        `La version minimale de Lumy Home "${lumyVersion}" n'est pas une plage semver valide (ex: >=1.0.0, ^1.0.0)`,
      );
    }
  }

  /**
   * Valide les permissions
   */
  private validatePermissions(permissions: any): void {
    if (!Array.isArray(permissions)) {
      throw new BadRequestException(
        'Les permissions doivent être un tableau de chaînes de caractères',
      );
    }

    for (const permission of permissions) {
      if (typeof permission !== 'string') {
        throw new BadRequestException(
          'Chaque permission doit être une chaîne de caractères',
        );
      }

      // Format de permission : category:action (ex: devices:read, automations:write)
      const permissionRegex = /^[a-z0-9-]+:[a-z0-9-]+$/;
      if (!permissionRegex.test(permission)) {
        throw new BadRequestException(
          `La permission "${permission}" n'est pas au bon format. Format attendu: category:action (ex: devices:read)`,
        );
      }
    }
  }

  /**
   * Valide les dépendances
   */
  private validateDependencies(dependencies: any): void {
    if (typeof dependencies !== 'object' || Array.isArray(dependencies)) {
      throw new BadRequestException(
        'Les dépendances doivent être un objet avec des noms de plugins et leurs versions',
      );
    }

    for (const [pluginName, versionRange] of Object.entries(dependencies)) {
      if (typeof pluginName !== 'string') {
        throw new BadRequestException(
          'Les noms de plugins dans les dépendances doivent être des chaînes de caractères',
        );
      }

      if (typeof versionRange !== 'string') {
        throw new BadRequestException(
          `La version de la dépendance "${pluginName}" doit être une chaîne de caractères (semver range)`,
        );
      }

      // Valider le nom du plugin
      this.validateName(pluginName);

      // Valider la plage de version
      if (!semver.validRange(versionRange)) {
        throw new BadRequestException(
          `La version de la dépendance "${pluginName}" ("${versionRange}") n'est pas une plage semver valide`,
        );
      }
    }
  }

  /**
   * Valide le configSchema (JSON Schema)
   */
  private validateConfigSchema(configSchema: any): void {
    if (typeof configSchema !== 'object' || Array.isArray(configSchema)) {
      throw new BadRequestException(
        'Le configSchema doit être un objet JSON Schema valide',
      );
    }

    // Vérifier les propriétés de base d'un JSON Schema
    if (configSchema.type && !['object', 'array', 'string', 'number', 'boolean', 'null'].includes(configSchema.type)) {
      throw new BadRequestException(
        `Le type du configSchema ("${configSchema.type}") n'est pas valide. Types acceptés: object, array, string, number, boolean, null`,
      );
    }

    // Vérifier que properties existe si type est object
    if (configSchema.type === 'object' && !configSchema.properties) {
      this.logger.warn(
        'Le configSchema de type "object" devrait avoir une propriété "properties"',
        'PluginManifestValidatorService',
      );
    }
  }
}

