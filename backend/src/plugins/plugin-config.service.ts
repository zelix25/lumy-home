import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { Plugin } from './entities/plugin.entity';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class PluginConfigService {
  private readonly logger: Logger;
  private readonly ajv: Ajv;
  private validators: Map<string, ValidateFunction> = new Map();

  constructor(
    @InjectRepository(Plugin)
    private pluginRepository: Repository<Plugin>,
    private loggerService: LoggerService,
  ) {
    this.logger = new Logger(PluginConfigService.name);
    
    // Initialiser Ajv avec support des formats (date, email, etc.)
    this.ajv = new Ajv({
      allErrors: true,
      strict: false,
      validateSchema: true,
      removeAdditional: false,
    });
    
    // Ajouter le support des formats courants
    addFormats(this.ajv);
  }

  /**
   * Valide une configuration contre le schéma JSON Schema du plugin
   */
  validateConfig(plugin: Plugin, config: Record<string, any>): void {
    // Si le plugin n'a pas de schéma, accepter toute configuration
    if (!plugin.configSchema) {
      this.logger.warn(
        `Le plugin ${plugin.name} n'a pas de configSchema, validation ignorée`,
        'PluginConfigService',
      );
      return;
    }

    // Récupérer ou créer le validateur pour ce plugin
    const validator = this.getValidator(plugin);

    // Valider la configuration
    const valid = validator(config);

    if (!valid) {
      const errors = validator.errors || [];
      const errorMessages = errors
        .map((error) => {
          const path = error.instancePath || error.schemaPath;
          return `${path}: ${error.message}`;
        })
        .join(', ');

      throw new BadRequestException(
        `Configuration invalide pour le plugin ${plugin.name}: ${errorMessages}`,
      );
    }
  }

  /**
   * Récupère ou crée un validateur pour un plugin
   */
  private getValidator(plugin: Plugin): ValidateFunction {
    // Utiliser le cache si disponible
    if (this.validators.has(plugin.id)) {
      const cachedValidator = this.validators.get(plugin.id);
      if (cachedValidator) {
        return cachedValidator;
      }
    }

    // Créer un nouveau validateur
    try {
      const validator = this.ajv.compile(plugin.configSchema);
      this.validators.set(plugin.id, validator);
      return validator;
    } catch (error: any) {
      throw new BadRequestException(
        `Schéma de configuration invalide pour le plugin ${plugin.name}: ${error.message}`,
      );
    }
  }

  /**
   * Met à jour la configuration d'un plugin avec validation
   */
  async updateConfig(
    pluginId: string,
    config: Record<string, any>,
  ): Promise<Plugin> {
    const plugin = await this.pluginRepository.findOne({
      where: { id: pluginId },
    });

    if (!plugin) {
      throw new BadRequestException(`Plugin ${pluginId} non trouvé`);
    }

    // Fusionner avec la configuration existante
    const mergedConfig = { ...plugin.config, ...config };

    // Valider la configuration
    this.validateConfig(plugin, mergedConfig);

    // Mettre à jour
    plugin.config = mergedConfig;
    const updatedPlugin = await this.pluginRepository.save(plugin);

    this.logger.log(
      `Configuration mise à jour pour: ${updatedPlugin.name}`,
      'PluginConfigService',
    );

    return updatedPlugin;
  }

  /**
   * Récupère la configuration d'un plugin avec valeurs par défaut
   */
  getConfigWithDefaults(plugin: Plugin): Record<string, any> {
    const config = plugin.config || {};
    const schema = plugin.configSchema;

    if (!schema || !schema.properties) {
      return config;
    }

    // Appliquer les valeurs par défaut du schéma
    const configWithDefaults = { ...config };
    for (const [key, property] of Object.entries(schema.properties)) {
      if (
        !(key in configWithDefaults) &&
        'default' in (property as Record<string, any>)
      ) {
        configWithDefaults[key] = (property as Record<string, any>).default;
      }
    }

    return configWithDefaults;
  }

  /**
   * Réinitialise le cache des validateurs pour un plugin
   */
  clearValidatorCache(pluginId: string): void {
    this.validators.delete(pluginId);
  }

  /**
   * Réinitialise tout le cache des validateurs
   */
  clearAllValidatorCache(): void {
    this.validators.clear();
  }
}

