import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plugin } from '../entities/plugin.entity';
import { LoggerService } from '../../logger/logger.service';
import { PluginConfigService } from '../configuration/plugin-config.service';
import { PluginsService } from '../plugins.service';
import { Inject, forwardRef } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface PluginConfigExport {
  version: string; // Version du format d'export
  exportDate: string;
  lumyVersion: string;
  plugins: Array<{
    pluginId: string;
    pluginName: string;
    pluginVersion: string;
    displayName: string;
    config: Record<string, any>;
    metadata?: Record<string, any>;
  }>;
  checksum?: string;
}

export interface PluginConfigImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: Array<{
    pluginName: string;
    error: string;
  }>;
  warnings: Array<{
    pluginName: string;
    warning: string;
  }>;
}

@Injectable()
export class PluginBackupService {
  private readonly logger: Logger;
  private readonly exportVersion = '1.0.0';
  private readonly backupsDirectory: string;

  constructor(
    @InjectRepository(Plugin)
    private pluginRepository: Repository<Plugin>,
    private loggerService: LoggerService,
    private configService: PluginConfigService,
    @Inject(forwardRef(() => PluginsService))
    private pluginsService: PluginsService,
  ) {
    this.logger = new Logger(PluginBackupService.name);
    
    // Créer le répertoire de sauvegarde
    this.backupsDirectory = path.join(process.cwd(), 'data', 'plugin-backups');
    if (!fs.existsSync(this.backupsDirectory)) {
      fs.mkdirSync(this.backupsDirectory, { recursive: true });
    }
  }

  /**
   * Exporte les configurations de tous les plugins ou d'un plugin spécifique
   */
  async exportConfigurations(pluginIds?: string[]): Promise<PluginConfigExport> {
    let plugins: Plugin[];

    if (pluginIds && pluginIds.length > 0) {
      // Exporter des plugins spécifiques
      plugins = await Promise.all(
        pluginIds.map((id) => this.pluginsService.findOne(id)),
      );
    } else {
      // Exporter tous les plugins
      plugins = await this.pluginsService.findAll();
    }

    const exportData: PluginConfigExport = {
      version: this.exportVersion,
      exportDate: new Date().toISOString(),
      lumyVersion: process.env.LUMY_VERSION || '1.0.0',
      plugins: plugins.map((plugin) => ({
        pluginId: plugin.id,
        pluginName: plugin.name,
        pluginVersion: plugin.version,
        displayName: plugin.displayName,
        config: plugin.config || {},
        metadata: {
          author: plugin.author,
          description: plugin.description,
          permissions: plugin.permissions,
          lumyVersion: plugin.lumyVersion,
        },
      })),
    };

    // Calculer le checksum
    const checksum = this.calculateChecksum(exportData);
    exportData.checksum = checksum;

    this.logger.log(
      `Configuration de ${plugins.length} plugin(s) exportée`,
      'PluginBackupService',
    );

    return exportData;
  }

  /**
   * Exporte les configurations vers un fichier
   */
  async exportToFile(pluginIds?: string[], filename?: string): Promise<string> {
    const exportData = await this.exportConfigurations(pluginIds);

    // Générer un nom de fichier si non fourni
    if (!filename) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const prefix = pluginIds && pluginIds.length > 0 ? 'selected' : 'all';
      filename = `plugin-config-${prefix}-${timestamp}.json`;
    }

    const filePath = path.join(this.backupsDirectory, filename);
    fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2), 'utf-8');

    this.logger.log(
      `Configuration exportée vers: ${filePath}`,
      'PluginBackupService',
    );

    return filePath;
  }

  /**
   * Importe des configurations depuis un objet
   */
  async importConfigurations(
    exportData: PluginConfigExport,
    options?: {
      overwrite?: boolean;
      skipMissing?: boolean;
      validate?: boolean;
    },
  ): Promise<PluginConfigImportResult> {
    const result: PluginConfigImportResult = {
      success: true,
      imported: 0,
      failed: 0,
      errors: [],
      warnings: [],
    };

    // Vérifier la version du format
    if (exportData.version !== this.exportVersion) {
      this.logger.warn(
        `Version du format d'export différente: ${exportData.version} (attendu: ${this.exportVersion})`,
        'PluginBackupService',
      );
      result.warnings.push({
        pluginName: 'SYSTEM',
        warning: `Version du format différente: ${exportData.version}`,
      });
    }

    // Vérifier le checksum si présent
    if (exportData.checksum) {
      const calculatedChecksum = this.calculateChecksum(exportData);
      if (calculatedChecksum !== exportData.checksum) {
        throw new BadRequestException(
          'Le fichier d\'export est corrompu (checksum invalide)',
        );
      }
    }

    // Vérifier la compatibilité de version Lumy Home
    const currentLumyVersion = process.env.LUMY_VERSION || '1.0.0';
    if (exportData.lumyVersion !== currentLumyVersion) {
      result.warnings.push({
        pluginName: 'SYSTEM',
        warning: `Version Lumy Home différente: export=${exportData.lumyVersion}, actuel=${currentLumyVersion}`,
      });
    }

    // Importer chaque plugin
    for (const pluginExport of exportData.plugins) {
      try {
        await this.importPluginConfig(pluginExport, options || {});
        result.imported++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          pluginName: pluginExport.pluginName,
          error: error.message || 'Erreur inconnue',
        });
        result.success = false;

        if (!options?.skipMissing) {
          // Arrêter à la première erreur si skipMissing n'est pas activé
          break;
        }
      }
    }

    this.logger.log(
      `Import terminé: ${result.imported} importé(s), ${result.failed} échec(s)`,
      'PluginBackupService',
    );

    return result;
  }

  /**
   * Importe la configuration d'un plugin spécifique
   */
  private async importPluginConfig(
    pluginExport: PluginConfigExport['plugins'][0],
    options: {
      overwrite?: boolean;
      skipMissing?: boolean;
      validate?: boolean;
    },
  ): Promise<void> {
    // Chercher le plugin par nom
    let plugin: Plugin | null = null;
    try {
      plugin = await this.pluginRepository.findOne({
        where: { name: pluginExport.pluginName },
      });
    } catch (error) {
      // Erreur lors de la recherche
    }

    // Si non trouvé par nom, essayer par ID
    if (!plugin) {
      try {
        plugin = await this.pluginsService.findOne(pluginExport.pluginId);
      } catch {
        // Plugin non trouvé
      }
    }

    // Si toujours non trouvé
    if (!plugin) {
      if (options.skipMissing) {
        this.logger.warn(
          `Plugin ${pluginExport.pluginName} non trouvé, ignoré`,
          'PluginBackupService',
        );
        return;
      }
      throw new NotFoundException(
        `Plugin ${pluginExport.pluginName} non trouvé`,
      );
    }

    // Vérifier la version si nécessaire
    if (plugin.version !== pluginExport.pluginVersion) {
      this.logger.warn(
        `Version différente pour ${pluginExport.pluginName}: installé=${plugin.version}, export=${pluginExport.pluginVersion}`,
        'PluginBackupService',
      );
    }

    // Vérifier si le plugin a déjà une configuration
    if (plugin.config && Object.keys(plugin.config).length > 0 && !options.overwrite) {
      throw new BadRequestException(
        `Le plugin ${pluginExport.pluginName} a déjà une configuration. Utilisez overwrite=true pour écraser.`,
      );
    }

    // Valider la configuration si demandé
    if (options.validate !== false) {
      try {
        // Récupérer le schéma de configuration du plugin
        const schema = await this.pluginsService.getConfigSchema(plugin.id);
        
        if (schema) {
          const validationResult = this.configService.validateConfig(
            pluginExport.config,
            schema,
          );
          
          if (!validationResult.valid) {
            const errors = this.configService.formatValidationErrors(validationResult.errors);
            throw new BadRequestException(
              `Configuration invalide pour ${pluginExport.pluginName}: ${errors.join(', ')}`,
            );
          }
        }
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new BadRequestException(
          `Erreur de validation pour ${pluginExport.pluginName}: ${error.message}`,
        );
      }
    }

    // Appliquer la configuration
    plugin.config = pluginExport.config;

    // Mettre à jour les métadonnées si présentes
    if (pluginExport.metadata) {
      if (pluginExport.metadata.permissions) {
        plugin.permissions = pluginExport.metadata.permissions;
      }
    }

    await this.pluginRepository.save(plugin);

    this.logger.log(
      `Configuration importée pour ${pluginExport.pluginName}`,
      'PluginBackupService',
    );
  }

  /**
   * Importe depuis un fichier
   */
  async importFromFile(
    filePath: string,
    options?: {
      overwrite?: boolean;
      skipMissing?: boolean;
      validate?: boolean;
    },
  ): Promise<PluginConfigImportResult> {
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`Fichier non trouvé: ${filePath}`);
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    let exportData: PluginConfigExport;

    try {
      exportData = JSON.parse(fileContent);
    } catch (error) {
      throw new BadRequestException('Fichier JSON invalide');
    }

    return this.importConfigurations(exportData, options);
  }

  /**
   * Liste les fichiers de sauvegarde disponibles
   */
  async listBackups(): Promise<Array<{
    filename: string;
    filePath: string;
    size: number;
    created: Date;
    exportDate?: string;
    pluginCount?: number;
  }>> {
    const files = fs.readdirSync(this.backupsDirectory);
    const backups: Array<{
      filename: string;
      filePath: string;
      size: number;
      created: Date;
      exportDate?: string;
      pluginCount?: number;
    }> = [];

    for (const file of files) {
      if (!file.endsWith('.json')) {
        continue;
      }

      const filePath = path.join(this.backupsDirectory, file);
      const stats = fs.statSync(filePath);

      // Lire les métadonnées du fichier
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const data: PluginConfigExport = JSON.parse(content);
        backups.push({
          filename: file,
          filePath,
          size: stats.size,
          created: stats.birthtime,
          exportDate: data.exportDate,
          pluginCount: data.plugins?.length,
        });
      } catch (error) {
        // Fichier invalide, l'ajouter quand même
        backups.push({
          filename: file,
          filePath,
          size: stats.size,
          created: stats.birthtime,
        });
      }
    }

    // Trier par date de création (plus récent en premier)
    backups.sort((a, b) => b.created.getTime() - a.created.getTime());

    return backups;
  }

  /**
   * Supprime un fichier de sauvegarde
   */
  async deleteBackup(filename: string): Promise<void> {
    const filePath = path.join(this.backupsDirectory, filename);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`Fichier de sauvegarde non trouvé: ${filename}`);
    }

    fs.unlinkSync(filePath);

    this.logger.log(`Fichier de sauvegarde supprimé: ${filename}`, 'PluginBackupService');
  }

  /**
   * Restaure une configuration depuis un fichier de sauvegarde
   */
  async restoreFromBackup(
    filename: string,
    options?: {
      overwrite?: boolean;
      skipMissing?: boolean;
      validate?: boolean;
    },
  ): Promise<PluginConfigImportResult> {
    const filePath = path.join(this.backupsDirectory, filename);
    return this.importFromFile(filePath, options);
  }

  /**
   * Crée une sauvegarde automatique (appelée avant une mise à jour)
   */
  async createAutoBackup(pluginId: string): Promise<string> {
    const plugin = await this.pluginsService.findOne(pluginId);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `auto-backup-${plugin.name}-${timestamp}.json`;

    return this.exportToFile([pluginId], filename);
  }

  /**
   * Calcule le checksum SHA-256 d'un export
   */
  private calculateChecksum(exportData: Omit<PluginConfigExport, 'checksum'>): string {
    const data = JSON.stringify(exportData);
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Compare deux configurations et retourne les différences
   */
  async compareConfigurations(
    pluginId: string,
    backupFilename: string,
  ): Promise<{
    current: Record<string, any>;
    backup: Record<string, any>;
    differences: Array<{
      key: string;
      current: any;
      backup: any;
    }>;
  }> {
    const plugin = await this.pluginsService.findOne(pluginId);
    const filePath = path.join(this.backupsDirectory, backupFilename);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`Fichier de sauvegarde non trouvé: ${backupFilename}`);
    }

    const exportData: PluginConfigExport = JSON.parse(
      fs.readFileSync(filePath, 'utf-8'),
    );
    const pluginExport = exportData.plugins.find(
      (p) => p.pluginId === pluginId || p.pluginName === plugin.name,
    );

    if (!pluginExport) {
      throw new NotFoundException(
        `Plugin ${plugin.name} non trouvé dans la sauvegarde`,
      );
    }

    const current = plugin.config || {};
    const backup = pluginExport.config || {};
    const differences: Array<{ key: string; current: any; backup: any }> = [];

    // Comparer les clés
    const allKeys = new Set([
      ...Object.keys(current),
      ...Object.keys(backup),
    ]);

    for (const key of allKeys) {
      if (JSON.stringify(current[key]) !== JSON.stringify(backup[key])) {
        differences.push({
          key,
          current: current[key],
          backup: backup[key],
        });
      }
    }

    return {
      current,
      backup,
      differences,
    };
  }
}

