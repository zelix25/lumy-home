import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Plugin, PluginStatus } from './entities/plugin.entity';
import { PluginRuntimeService } from './plugin-runtime.service';
import { PluginUIExtensionService } from './plugin-ui-extension.service';
import { PluginAutomationExtensionService } from './plugin-automation-extension.service';
import { PluginNotificationService } from './plugin-notification.service';
import { PluginStorageService } from './plugin-storage.service';
import { PluginErrorService } from './plugin-error.service';
import { PluginTestService } from './plugin-test.service';
import { PluginAnalyticsService } from './plugin-analytics.service';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class PluginUninstallService {
  private readonly logger: Logger;
  private readonly pluginsDirectory: string;

  constructor(
    @InjectRepository(Plugin)
    private pluginRepository: Repository<Plugin>,
    private configService: ConfigService,
    private pluginRuntimeService: PluginRuntimeService,
    private pluginUIExtensionService: PluginUIExtensionService,
    private pluginAutomationExtensionService: PluginAutomationExtensionService,
    private pluginNotificationService: PluginNotificationService,
    private pluginStorageService: PluginStorageService,
    private pluginErrorService: PluginErrorService,
    private pluginTestService: PluginTestService,
    private pluginAnalyticsService: PluginAnalyticsService,
    private loggerService: LoggerService,
  ) {
    this.logger = new Logger(PluginUninstallService.name);
    this.pluginsDirectory = path.join(
      process.cwd(),
      this.configService.get<string>('PLUGINS_DIRECTORY', 'plugins'),
    );
  }

  /**
   * Désinstalle un plugin proprement
   */
  async uninstall(plugin: Plugin): Promise<void> {
    // 1. Vérifier que le plugin n'est pas activé
    if (plugin.status === PluginStatus.ENABLED) {
      throw new BadRequestException(
        'Le plugin doit être désactivé avant d\'être désinstallé',
      );
    }

    try {
      // 2. Décharger le plugin de la mémoire si chargé
      if (this.pluginRuntimeService.isPluginLoaded(plugin.id)) {
        await this.pluginRuntimeService.unloadPlugin(plugin.id);
      }

      // 3. Supprimer les fichiers du plugin
      await this.removePluginFiles(plugin);

      // 4. Nettoyer les données associées
      await this.cleanupPluginData(plugin);

      // 5. Supprimer de la base de données
      await this.pluginRepository.remove(plugin);

      this.logger.log(
        `Plugin désinstallé avec succès: ${plugin.name}`,
        'PluginUninstallService',
      );
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de la désinstallation du plugin ${plugin.name}: ${error.message}`,
        'PluginUninstallService',
      );
      throw error;
    }
  }

  /**
   * Supprime les fichiers du plugin
   */
  private async removePluginFiles(plugin: Plugin): Promise<void> {
    if (!plugin.installPath) {
      this.logger.warn(
        `Aucun chemin d'installation pour le plugin ${plugin.name}, pas de fichiers à supprimer`,
        'PluginUninstallService',
      );
      return;
    }

    try {
      // Vérifier que le chemin existe
      if (await fs.pathExists(plugin.installPath)) {
        // Vérifier que le chemin est bien dans le répertoire des plugins (sécurité)
        const resolvedPath = path.resolve(plugin.installPath);
        const resolvedPluginsDir = path.resolve(this.pluginsDirectory);

        if (!resolvedPath.startsWith(resolvedPluginsDir)) {
          throw new BadRequestException(
            `Le chemin d'installation du plugin n'est pas dans le répertoire des plugins. Sécurité: suppression annulée.`,
          );
        }

        // Supprimer le répertoire du plugin
        await fs.remove(plugin.installPath);

        this.logger.log(
          `Fichiers du plugin supprimés: ${plugin.installPath}`,
          'PluginUninstallService',
        );
      }
    } catch (error: any) {
      // Ne pas bloquer la désinstallation si la suppression des fichiers échoue
      this.logger.warn(
        `Impossible de supprimer les fichiers du plugin ${plugin.name}: ${error.message}`,
        'PluginUninstallService',
      );
    }
  }

  /**
   * Nettoie les données associées au plugin
   */
  private async cleanupPluginData(plugin: Plugin): Promise<void> {
    try {
      // Supprimer les extensions UI
      await this.pluginUIExtensionService.removePluginExtensions(plugin.id);

      // Supprimer les extensions d'automatisation
      await this.pluginAutomationExtensionService.removePluginExtensions(plugin.id);

      // Supprimer les notifications
      await this.pluginNotificationService.removePluginNotifications(plugin.id);

      // Supprimer les données de stockage
      await this.pluginStorageService.removePluginData(plugin.id);

      // Supprimer les erreurs
      await this.pluginErrorService.removePluginErrors(plugin.id);

      // Supprimer les tests
      await this.pluginTestService.removePluginTests(plugin.id);

      // Supprimer les analytics
      await this.pluginAnalyticsService.removePluginAnalytics(plugin.id);

      // TODO: Nettoyer les données dans les autres services
      // - PluginStorageService : supprimer les données de stockage
      // - PluginErrorService : supprimer les erreurs enregistrées
      // - PluginAnalyticsService : archiver les analytics
      // - PluginNotificationService : supprimer les notifications en attente
      // - PluginLicenseService : invalider les licences
      // - etc.

      this.logger.log(
        `Données du plugin nettoyées: ${plugin.name}`,
        'PluginUninstallService',
      );
    } catch (error: any) {
      // Ne pas bloquer la désinstallation si le nettoyage des données échoue
      this.logger.warn(
        `Erreur lors du nettoyage des données du plugin ${plugin.name}: ${error.message}`,
        'PluginUninstallService',
      );
    }
  }
}

