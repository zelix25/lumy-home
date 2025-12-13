import { Injectable, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plugin, PluginStatus } from '../entities/plugin.entity';
import { PluginsService } from '../plugins.service';
import { PluginsStoreService } from '../plugins-store.service';
import { PluginCompatibilityService } from '../compatibility/plugin-compatibility.service';
import { LoggerService } from '../../logger/logger.service';
import * as semver from 'semver';

@Injectable()
export class PluginUpdateService {
  constructor(
    @InjectRepository(Plugin)
    private pluginRepository: Repository<Plugin>,
    @Inject(forwardRef(() => PluginsService))
    private pluginsService: PluginsService,
    private pluginsStoreService: PluginsStoreService,
    private compatibilityService: PluginCompatibilityService,
    private logger: LoggerService,
  ) {}

  /**
   * Vérifie si une mise à jour est disponible pour un plugin
   */
  async checkForUpdate(pluginId: string): Promise<{
    hasUpdate: boolean;
    currentVersion: string;
    latestVersion: string | null;
    updateAvailable: boolean;
  }> {
    const plugin = await this.pluginsService.findOne(pluginId);

    // Si le plugin n'a pas de repository ou n'est pas dans le store, on ne peut pas vérifier
    if (!plugin.repository && !plugin.name) {
      return {
        hasUpdate: false,
        currentVersion: plugin.version,
        latestVersion: null,
        updateAvailable: false,
      };
    }

    try {
      // Essayer de récupérer depuis le store
      let storePlugin;
      try {
        storePlugin = await this.pluginsStoreService.findOne(plugin.name);
      } catch (error) {
        // Plugin non trouvé dans le store
        this.logger.warn(
          `[PluginUpdateService] Plugin ${plugin.name} non trouvé dans le store`,
          'PluginUpdateService',
        );
        return {
          hasUpdate: false,
          currentVersion: plugin.version,
          latestVersion: null,
          updateAvailable: false,
        };
      }

      const latestVersion = storePlugin.version;
      const currentVersion = plugin.version;

      // Comparer les versions avec semver
      const updateAvailable = semver.gt(latestVersion, currentVersion);

      return {
        hasUpdate: updateAvailable,
        currentVersion,
        latestVersion,
        updateAvailable,
      };
    } catch (error) {
      this.logger.error(
        `[PluginUpdateService] Erreur lors de la vérification de mise à jour pour ${plugin.name}: ${error.message}`,
        error.stack,
        'PluginUpdateService',
      );
      return {
        hasUpdate: false,
        currentVersion: plugin.version,
        latestVersion: null,
        updateAvailable: false,
      };
    }
  }

  /**
   * Vérifie les mises à jour pour tous les plugins installés
   */
  async checkAllForUpdates(): Promise<
    Array<{
      pluginId: string;
      pluginName: string;
      currentVersion: string;
      latestVersion: string | null;
      updateAvailable: boolean;
    }>
  > {
    const plugins = await this.pluginsService.findAll();
    const updates: Array<{
      pluginId: string;
      pluginName: string;
      currentVersion: string;
      latestVersion: string | null;
      updateAvailable: boolean;
    }> = [];

    for (const plugin of plugins) {
      try {
        const updateInfo = await this.checkForUpdate(plugin.id);
        if (updateInfo.updateAvailable) {
          updates.push({
            pluginId: plugin.id,
            pluginName: plugin.name,
            currentVersion: updateInfo.currentVersion,
            latestVersion: updateInfo.latestVersion,
            updateAvailable: true,
          });
        }
      } catch (error) {
        this.logger.warn(
          `[PluginUpdateService] Erreur lors de la vérification de ${plugin.name}: ${error.message}`,
          'PluginUpdateService',
        );
      }
    }

    return updates;
  }

  /**
   * Met à jour un plugin vers la dernière version
   */
  async updatePlugin(pluginId: string, targetVersion?: string): Promise<Plugin> {
    const plugin = await this.pluginsService.findOne(pluginId);

    // Vérifier si le plugin est activé
    if (plugin.status === PluginStatus.ENABLED) {
      // Désactiver temporairement le plugin
      await this.pluginsService.disable(pluginId);
      this.logger.log(
        `[PluginUpdateService] Plugin ${plugin.name} désactivé temporairement pour la mise à jour`,
        'PluginUpdateService',
      );
    }

    try {
      // Vérifier la version cible
      let versionToInstall = targetVersion;
      if (!versionToInstall) {
        const updateInfo = await this.checkForUpdate(pluginId);
        if (!updateInfo.updateAvailable || !updateInfo.latestVersion) {
          throw new BadRequestException(
            `Aucune mise à jour disponible pour ${plugin.name}`,
          );
        }
        versionToInstall = updateInfo.latestVersion;
      }

      // Sauvegarder l'ancienne configuration
      const oldConfig = plugin.config;
      const oldMetadata = plugin.metadata;

      // Désinstaller l'ancienne version (sans supprimer les fichiers pour l'instant)
      this.logger.log(
        `[PluginUpdateService] Désinstallation de l'ancienne version ${plugin.version} de ${plugin.name}`,
        'PluginUpdateService',
      );

      // Installer la nouvelle version
      this.logger.log(
        `[PluginUpdateService] Installation de la nouvelle version ${versionToInstall} de ${plugin.name}`,
        'PluginUpdateService',
      );

      try {
        // Vérifier la compatibilité avant la mise à jour
        const storePlugin = await this.pluginsStoreService.findOne(plugin.name);
        if (storePlugin.lumyVersion) {
          const compatibility = this.compatibilityService.checkCompatibility(storePlugin.lumyVersion);
          if (!compatibility.compatible) {
            throw new BadRequestException(
              `La nouvelle version du plugin nécessite Lumy Home ${storePlugin.lumyVersion}, mais la version actuelle est ${compatibility.currentVersion}. Veuillez mettre à jour Lumy Home d'abord.`,
            );
          }
        }

        // Installer la nouvelle version
        const updatedPlugin = await this.pluginsService.install({
          source: plugin.name,
          version: versionToInstall,
          config: oldConfig, // Restaurer la configuration
          allowUpdate: true, // Permettre la mise à jour
        });

        // Restaurer les métadonnées personnalisées si nécessaire
        if (oldMetadata) {
          updatedPlugin.metadata = {
            ...updatedPlugin.metadata,
            ...oldMetadata,
          };
          await this.pluginRepository.save(updatedPlugin);
        }

        // Réactiver le plugin si il était activé avant
        if (plugin.status === PluginStatus.ENABLED) {
          await this.pluginsService.enable(updatedPlugin.id);
          this.logger.log(
            `[PluginUpdateService] Plugin ${updatedPlugin.name} réactivé après la mise à jour`,
            'PluginUpdateService',
          );
        }

        // Supprimer l'ancienne installation
        // TODO: Implémenter la suppression de l'ancienne version

        this.logger.log(
          `[PluginUpdateService] Plugin ${updatedPlugin.name} mis à jour de ${plugin.version} vers ${versionToInstall}`,
          'PluginUpdateService',
        );

        return updatedPlugin;
      } catch (error) {
        // En cas d'erreur, essayer de restaurer l'ancienne version
        this.logger.error(
          `[PluginUpdateService] Erreur lors de l'installation de la nouvelle version, restauration de l'ancienne version`,
          error.stack,
          'PluginUpdateService',
        );

        // Réactiver l'ancienne version si elle était activée
        if (plugin.status === PluginStatus.ENABLED) {
          plugin.status = PluginStatus.ENABLED;
          await this.pluginRepository.save(plugin);
        }

        throw new BadRequestException(
          `Erreur lors de la mise à jour: ${error.message}. L'ancienne version a été restaurée.`,
        );
      }
    } catch (error) {
      // Réactiver le plugin en cas d'erreur
      if (plugin.status === PluginStatus.ENABLED) {
        plugin.status = PluginStatus.ENABLED;
        await this.pluginRepository.save(plugin);
      }
      throw error;
    }
  }

  /**
   * Met à jour tous les plugins qui ont des mises à jour disponibles
   */
  async updateAll(): Promise<Array<{ pluginId: string; success: boolean; error?: string }>> {
    const updates = await this.checkAllForUpdates();
    const results: Array<{ pluginId: string; success: boolean; error?: string }> = [];

    for (const update of updates) {
      try {
        await this.updatePlugin(update.pluginId);
        results.push({ pluginId: update.pluginId, success: true });
      } catch (error) {
        results.push({
          pluginId: update.pluginId,
          success: false,
          error: error.message,
        });
      }
    }

    return results;
  }
}

