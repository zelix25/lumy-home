import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Plugin } from './entities/plugin.entity';
import { LoggerService } from '../logger/logger.service';
import { ConfigService } from '@nestjs/config';

/**
 * Liste des permissions autorisées dans Lumy Home
 */
export const ALLOWED_PERMISSIONS = [
  // Devices
  'devices:read',
  'devices:write',
  'devices:control',
  'devices:delete',
  
  // Automations
  'automations:read',
  'automations:create',
  'automations:update',
  'automations:delete',
  'automations:execute',
  
  // Rooms
  'rooms:read',
  'rooms:write',
  'rooms:delete',
  
  // Notifications
  'notifications:send',
  'notifications:read',
  
  // Storage
  'storage:read',
  'storage:write',
  'storage:delete',
  
  // History
  'history:read',
  'history:write',
  
  // Settings
  'settings:read',
  'settings:write',
  
  // Weather
  'weather:read',
  
  // AI
  'ai:use',
] as const;

export type AllowedPermission = typeof ALLOWED_PERMISSIONS[number];

@Injectable()
export class PluginPermissionsService {
  private readonly logger: Logger;
  private readonly pluginsDirectory: string;

  constructor(
    @InjectRepository(Plugin)
    private pluginRepository: Repository<Plugin>,
    private configService: ConfigService,
    private loggerService: LoggerService,
  ) {
    this.logger = new Logger(PluginPermissionsService.name);
    this.pluginsDirectory = path.join(
      process.cwd(),
      this.configService.get<string>('PLUGINS_DIRECTORY', 'plugins'),
    );
  }

  /**
   * Valide que toutes les permissions demandées sont autorisées
   */
  validatePermissions(permissions: string[]): void {
    if (!Array.isArray(permissions)) {
      throw new BadRequestException(
        'Les permissions doivent être un tableau de chaînes de caractères',
      );
    }

    const invalidPermissions: string[] = [];

    for (const permission of permissions) {
      if (typeof permission !== 'string') {
        throw new BadRequestException(
          'Chaque permission doit être une chaîne de caractères',
        );
      }

      // Vérifier le format
      const permissionRegex = /^[a-z0-9-]+:[a-z0-9-]+$/;
      if (!permissionRegex.test(permission)) {
        throw new BadRequestException(
          `La permission "${permission}" n'est pas au bon format. Format attendu: category:action (ex: devices:read)`,
        );
      }

      // Vérifier que la permission est autorisée
      if (!ALLOWED_PERMISSIONS.includes(permission as AllowedPermission)) {
        invalidPermissions.push(permission);
      }
    }

    if (invalidPermissions.length > 0) {
      throw new BadRequestException(
        `Permissions non autorisées: ${invalidPermissions.join(', ')}. Permissions autorisées: ${ALLOWED_PERMISSIONS.join(', ')}`,
      );
    }
  }

  /**
   * Analyse le code d'un plugin pour détecter les permissions nécessaires
   */
  async analyzePluginCode(plugin: Plugin): Promise<string[]> {
    if (!plugin.installPath) {
      this.logger.warn(
        `Aucun chemin d'installation pour le plugin ${plugin.name}, analyse impossible`,
        'PluginPermissionsService',
      );
      return [];
    }

    const detectedPermissions: Set<string> = new Set();

    try {
      // Analyser les fichiers JavaScript/TypeScript du plugin
      await this.analyzeDirectory(plugin.installPath, detectedPermissions);
    } catch (error: any) {
      this.logger.warn(
        `Erreur lors de l'analyse du code du plugin ${plugin.name}: ${error.message}`,
        'PluginPermissionsService',
      );
    }

    return Array.from(detectedPermissions);
  }

  /**
   * Analyse récursive d'un répertoire pour détecter les permissions
   */
  private async analyzeDirectory(
    dirPath: string,
    detectedPermissions: Set<string>,
  ): Promise<void> {
    if (!(await fs.pathExists(dirPath))) {
      return;
    }

    const files = await fs.readdir(dirPath);

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = await fs.stat(filePath);

      if (stat.isDirectory()) {
        // Ignorer node_modules et autres répertoires non pertinents
        if (
          file === 'node_modules' ||
          file === '.git' ||
          file.startsWith('.')
        ) {
          continue;
        }
        await this.analyzeDirectory(filePath, detectedPermissions);
      } else if (stat.isFile()) {
        // Analyser les fichiers JavaScript/TypeScript
        if (
          file.endsWith('.js') ||
          file.endsWith('.ts') ||
          file.endsWith('.jsx') ||
          file.endsWith('.tsx')
        ) {
          await this.analyzeFile(filePath, detectedPermissions);
        }
      }
    }
  }

  /**
   * Analyse un fichier pour détecter les permissions utilisées
   */
  private async analyzeFile(
    filePath: string,
    detectedPermissions: Set<string>,
  ): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');

      // Patterns pour détecter les appels API ou utilisations de permissions
      // Exemples :
      // - api.devices.get() -> devices:read
      // - api.devices.update() -> devices:write
      // - api.automations.create() -> automations:create
      // - requirePermission('devices:read')
      // - checkPermission('automations:write')

      const permissionPatterns = [
        // Pattern pour les appels API
        /api\.(devices|automations|rooms|notifications|storage|history|settings|weather|ai)\.(get|read|list|fetch)/gi,
        /api\.(devices|automations|rooms|notifications|storage|history|settings|weather|ai)\.(set|update|write|create|add|post|put)/gi,
        /api\.(devices|automations|rooms|notifications|storage|history|settings|weather|ai)\.(delete|remove|destroy)/gi,
        /api\.(devices)\.(control|turnOn|turnOff|toggle)/gi,
        /api\.(automations)\.(execute|run|trigger)/gi,
        /api\.(notifications)\.(send|push)/gi,
        
        // Pattern pour les appels explicites de permissions
        /requirePermission\(['"]([^'"]+)['"]\)/gi,
        /checkPermission\(['"]([^'"]+)['"]\)/gi,
        /hasPermission\(['"]([^'"]+)['"]\)/gi,
        /permissions\.(?:includes|contains)\(['"]([^'"]+)['"]\)/gi,
      ];

      for (const pattern of permissionPatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          if (match[1]) {
            // Permission explicite trouvée
            const permission = match[1];
            if (this.isValidPermissionFormat(permission)) {
              detectedPermissions.add(permission);
            }
          } else {
            // Détection basée sur l'API appelée
            const category = match[1]?.toLowerCase();
            const action = match[2]?.toLowerCase();

            if (category && action) {
              const permission = this.inferPermission(category, action);
              if (permission) {
                detectedPermissions.add(permission);
              }
            }
          }
        }
      }
    } catch (error: any) {
      this.logger.warn(
        `Erreur lors de l'analyse du fichier ${filePath}: ${error.message}`,
        'PluginPermissionsService',
      );
    }
  }

  /**
   * Infère une permission à partir d'une catégorie et d'une action
   */
  private inferPermission(
    category: string,
    action: string,
  ): string | null {
    const permissionMap: Record<string, Record<string, string>> = {
      devices: {
        get: 'devices:read',
        read: 'devices:read',
        list: 'devices:read',
        fetch: 'devices:read',
        set: 'devices:write',
        update: 'devices:write',
        write: 'devices:write',
        create: 'devices:write',
        add: 'devices:write',
        post: 'devices:write',
        put: 'devices:write',
        delete: 'devices:delete',
        remove: 'devices:delete',
        destroy: 'devices:delete',
        control: 'devices:control',
        turnon: 'devices:control',
        turnoff: 'devices:control',
        toggle: 'devices:control',
      },
      automations: {
        get: 'automations:read',
        read: 'automations:read',
        list: 'automations:read',
        fetch: 'automations:read',
        set: 'automations:update',
        update: 'automations:update',
        write: 'automations:update',
        create: 'automations:create',
        add: 'automations:create',
        post: 'automations:create',
        put: 'automations:update',
        delete: 'automations:delete',
        remove: 'automations:delete',
        destroy: 'automations:delete',
        execute: 'automations:execute',
        run: 'automations:execute',
        trigger: 'automations:execute',
      },
      rooms: {
        get: 'rooms:read',
        read: 'rooms:read',
        list: 'rooms:read',
        fetch: 'rooms:read',
        set: 'rooms:write',
        update: 'rooms:write',
        write: 'rooms:write',
        create: 'rooms:write',
        add: 'rooms:write',
        post: 'rooms:write',
        put: 'rooms:write',
        delete: 'rooms:delete',
        remove: 'rooms:delete',
        destroy: 'rooms:delete',
      },
      notifications: {
        send: 'notifications:send',
        push: 'notifications:send',
        get: 'notifications:read',
        read: 'notifications:read',
        list: 'notifications:read',
        fetch: 'notifications:read',
      },
      storage: {
        get: 'storage:read',
        read: 'storage:read',
        list: 'storage:read',
        fetch: 'storage:read',
        set: 'storage:write',
        update: 'storage:write',
        write: 'storage:write',
        create: 'storage:write',
        add: 'storage:write',
        post: 'storage:write',
        put: 'storage:write',
        delete: 'storage:delete',
        remove: 'storage:delete',
        destroy: 'storage:delete',
      },
      history: {
        get: 'history:read',
        read: 'history:read',
        list: 'history:read',
        fetch: 'history:read',
        set: 'history:write',
        update: 'history:write',
        write: 'history:write',
        create: 'history:write',
        add: 'history:write',
        post: 'history:write',
        put: 'history:write',
      },
      settings: {
        get: 'settings:read',
        read: 'settings:read',
        list: 'settings:read',
        fetch: 'settings:read',
        set: 'settings:write',
        update: 'settings:write',
        write: 'settings:write',
        create: 'settings:write',
        add: 'settings:write',
        post: 'settings:write',
        put: 'settings:write',
      },
      weather: {
        get: 'weather:read',
        read: 'weather:read',
        list: 'weather:read',
        fetch: 'weather:read',
      },
      ai: {
        use: 'ai:use',
        call: 'ai:use',
        query: 'ai:use',
      },
    };

    return permissionMap[category]?.[action] || null;
  }

  /**
   * Vérifie si une permission a un format valide
   */
  private isValidPermissionFormat(permission: string): boolean {
    const permissionRegex = /^[a-z0-9-]+:[a-z0-9-]+$/;
    return permissionRegex.test(permission);
  }

  /**
   * Compare les permissions déclarées avec celles détectées dans le code
   */
  async compareDeclaredAndDetectedPermissions(
    plugin: Plugin,
  ): Promise<{
    declared: string[];
    detected: string[];
    missing: string[];
    unnecessary: string[];
  }> {
    const declared = plugin.permissions || [];
    const detected = await this.analyzePluginCode(plugin);

    const missing = detected.filter((p) => !declared.includes(p));
    const unnecessary = declared.filter((p) => !detected.includes(p));

    return {
      declared,
      detected,
      missing,
      unnecessary,
    };
  }

  /**
   * Vérifie si un plugin a une permission spécifique
   */
  hasPermission(plugin: Plugin, permission: string): boolean {
    const permissions = plugin.permissions || [];
    return permissions.includes(permission);
  }
}

