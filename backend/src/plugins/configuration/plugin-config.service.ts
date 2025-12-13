import { Injectable, BadRequestException } from '@nestjs/common';
import { LoggerService } from '../../logger/logger.service';
import Ajv, { ValidateFunction, ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';

@Injectable()
export class PluginConfigService {
  private ajv: Ajv;

  constructor(private logger: LoggerService) {
    // Initialiser AJV avec support des formats (email, uri, date, etc.)
    this.ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this.ajv);
  }

  /**
   * Valide une configuration contre un schéma JSON Schema
   */
  validateConfig(config: any, schema: any): { valid: boolean; errors: ErrorObject[] } {
    if (!schema) {
      // Si pas de schéma, la configuration est valide par défaut
      return { valid: true, errors: [] };
    }

    try {
      // Compiler le schéma
      const validate: ValidateFunction = this.ajv.compile(schema);

      // Valider la configuration
      const valid = validate(config);

      if (!valid) {
        const errors = validate.errors || [];
        this.logger.warn(
          `[PluginConfigService] Configuration invalide: ${errors.map((e) => e.message).join(', ')}`,
          'PluginConfigService',
        );
        return { valid: false, errors };
      }

      return { valid: true, errors: [] };
    } catch (error) {
      throw new BadRequestException(
        `Erreur lors de la validation du schéma: ${error.message}`,
      );
    }
  }

  /**
   * Valide le schéma de configuration lui-même
   */
  validateSchema(schema: any): { valid: boolean; errors: ErrorObject[] } {
    if (!schema) {
      return { valid: true, errors: [] };
    }

    try {
      // Compiler le schéma pour vérifier qu'il est valide
      this.ajv.compile(schema);
      return { valid: true, errors: [] };
    } catch (error) {
      return {
        valid: false,
        errors: [
          {
            instancePath: '',
            schemaPath: '',
            keyword: 'schema',
            params: {},
            message: error.message,
          } as ErrorObject,
        ],
      };
    }
  }

  /**
   * Applique les valeurs par défaut depuis le schéma
   */
  applyDefaults(config: any, schema: any): any {
    if (!schema || !schema.properties) {
      return config || {};
    }

    const result = { ...config };

    // Parcourir les propriétés du schéma et appliquer les valeurs par défaut
    for (const [key, property] of Object.entries(schema.properties)) {
      const prop = property as any;
      if (result[key] === undefined && prop.default !== undefined) {
        result[key] = prop.default;
      }
    }

    return result;
  }

  /**
   * Génère un schéma de configuration par défaut basé sur les propriétés
   */
  generateDefaultSchema(properties: Record<string, any>): any {
    return {
      type: 'object',
      properties,
      additionalProperties: false,
    };
  }

  /**
   * Formate les erreurs de validation pour l'affichage
   */
  formatValidationErrors(errors: ErrorObject[]): string[] {
    return errors.map((error) => {
      const path = error.instancePath || 'root';
      const message = error.message || 'Erreur de validation';
      return `${path}: ${message}`;
    });
  }

  /**
   * Valide et normalise une configuration
   */
  validateAndNormalize(config: any, schema: any): { config: any; errors: string[] } {
    // Appliquer les valeurs par défaut
    const normalizedConfig = this.applyDefaults(config || {}, schema);

    // Valider
    const validation = this.validateConfig(normalizedConfig, schema);

    if (!validation.valid) {
      return {
        config: normalizedConfig,
        errors: this.formatValidationErrors(validation.errors),
      };
    }

    return { config: normalizedConfig, errors: [] };
  }
}

