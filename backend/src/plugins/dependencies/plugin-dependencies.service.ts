import { Injectable, BadRequestException, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plugin } from '../entities/plugin.entity';
import { PluginsService } from '../plugins.service';
import { PluginsStoreService } from '../plugins-store.service';
import { LoggerService } from '../../logger/logger.service';
import * as semver from 'semver';

export interface DependencyNode {
  name: string;
  version: string;
  plugin?: Plugin;
  dependencies: DependencyNode[];
  depth: number;
}

export interface DependencyResolution {
  toInstall: Array<{ name: string; version: string }>;
  toUpdate: Array<{ name: string; currentVersion: string; requiredVersion: string }>;
  conflicts: Array<{ name: string; requiredVersions: string[] }>;
  circular: string[];
}

@Injectable()
export class PluginDependenciesService {
  private readonly logger: Logger;

  constructor(
    @InjectRepository(Plugin)
    private pluginRepository: Repository<Plugin>,
    @Inject(forwardRef(() => PluginsService))
    private pluginsService: PluginsService,
    private pluginsStoreService: PluginsStoreService,
    private loggerService: LoggerService,
  ) {
    this.logger = new Logger(PluginDependenciesService.name);
  }

  /**
   * Résout toutes les dépendances d'un plugin
   */
  async resolveDependencies(
    pluginName: string,
    dependencies: Record<string, string>,
  ): Promise<DependencyResolution> {
    const resolution: DependencyResolution = {
      toInstall: [],
      toUpdate: [],
      conflicts: [],
      circular: [],
    };

    // Construire l'arbre de dépendances
    const dependencyTree = await this.buildDependencyTree(pluginName, dependencies, 0, new Set());

    // Détecter les dépendances circulaires
    const circular = this.detectCircularDependencies(dependencyTree);
    if (circular.length > 0) {
      resolution.circular = circular;
      throw new BadRequestException(
        `Dépendances circulaires détectées: ${circular.join(' -> ')}`,
      );
    }

    // Analyser les dépendances
    for (const node of this.flattenDependencyTree(dependencyTree)) {
      if (node.name === pluginName) {
        continue; // Ignorer le plugin lui-même
      }

      const installedPlugin = await this.pluginsService.findByName(node.name);

      if (!installedPlugin) {
        // Plugin non installé
        resolution.toInstall.push({
          name: node.name,
          version: node.version,
        });
      } else {
        // Plugin installé, vérifier la version
        if (!this.isVersionSatisfied(installedPlugin.version, node.version)) {
          // Vérifier si une mise à jour est possible
          try {
            const storePlugin = await this.pluginsStoreService.findOne(node.name);
            if (semver.gte(storePlugin.version, node.version)) {
              resolution.toUpdate.push({
                name: node.name,
                currentVersion: installedPlugin.version,
                requiredVersion: node.version,
              });
            } else {
              resolution.conflicts.push({
                name: node.name,
                requiredVersions: [node.version, installedPlugin.version],
              });
            }
          } catch (error) {
            // Plugin non trouvé dans le store
            resolution.conflicts.push({
              name: node.name,
              requiredVersions: [node.version, installedPlugin.version],
            });
          }
        }
      }
    }

    // Détecter les conflits de versions
    const versionConflicts = this.detectVersionConflicts(dependencyTree);
    resolution.conflicts.push(...versionConflicts);

    return resolution;
  }

  /**
   * Construit l'arbre de dépendances récursif
   */
  private async buildDependencyTree(
    pluginName: string,
    dependencies: Record<string, string>,
    depth: number,
    visited: Set<string>,
  ): Promise<DependencyNode> {
    if (visited.has(pluginName)) {
      // Dépendance circulaire détectée
      return {
        name: pluginName,
        version: dependencies[pluginName] || '*',
        dependencies: [],
        depth,
      };
    }

    visited.add(pluginName);

    const node: DependencyNode = {
      name: pluginName,
      version: dependencies[pluginName] || '*',
      dependencies: [],
      depth,
    };

    // Récupérer le plugin installé pour obtenir ses dépendances
    let pluginDependencies: Record<string, string> = {};

    const installedPlugin = await this.pluginsService.findByName(pluginName);
    if (installedPlugin?.dependencies) {
      pluginDependencies = installedPlugin.dependencies;
    } else {
      // Si le plugin n'est pas installé, on ne peut pas récupérer ses dépendances
      // On utilise uniquement les dépendances passées en paramètre
      this.logger.debug(
        `[PluginDependenciesService] Plugin ${pluginName} non installé, dépendances non résolues récursivement`,
        'PluginDependenciesService',
      );
    }

    // Construire récursivement les dépendances
    for (const [depName, depVersion] of Object.entries(pluginDependencies)) {
      const depNode = await this.buildDependencyTree(
        depName,
        { [depName]: depVersion },
        depth + 1,
        new Set(visited), // Nouveau Set pour chaque branche
      );
      node.dependencies.push(depNode);
    }

    return node;
  }

  /**
   * Aplatit l'arbre de dépendances en liste
   */
  private flattenDependencyTree(node: DependencyNode): DependencyNode[] {
    const result: DependencyNode[] = [node];
    for (const dep of node.dependencies) {
      result.push(...this.flattenDependencyTree(dep));
    }
    return result;
  }

  /**
   * Détecte les dépendances circulaires
   */
  private detectCircularDependencies(node: DependencyNode): string[] {
    const path: string[] = [];
    const visited = new Set<string>();

    const detect = (current: DependencyNode, currentPath: string[]): string[] | null => {
      if (visited.has(current.name)) {
        // Trouvé un cycle
        const cycleStart = currentPath.indexOf(current.name);
        if (cycleStart !== -1) {
          return currentPath.slice(cycleStart).concat(current.name);
        }
        return null;
      }

      visited.add(current.name);
      currentPath.push(current.name);

      for (const dep of current.dependencies) {
        const cycle = detect(dep, [...currentPath]);
        if (cycle) {
          return cycle;
        }
      }

      visited.delete(current.name);
      return null;
    };

    const cycle = detect(node, []);
    return cycle || [];
  }

  /**
   * Détecte les conflits de versions
   */
  private detectVersionConflicts(tree: DependencyNode): Array<{ name: string; requiredVersions: string[] }> {
    const versionMap = new Map<string, Set<string>>();

    const collectVersions = (node: DependencyNode) => {
      if (node.name) {
        if (!versionMap.has(node.name)) {
          versionMap.set(node.name, new Set());
        }
        versionMap.get(node.name)!.add(node.version);
      }

      for (const dep of node.dependencies) {
        collectVersions(dep);
      }
    };

    collectVersions(tree);

    const conflicts: Array<{ name: string; requiredVersions: string[] }> = [];

    for (const [name, versions] of versionMap.entries()) {
      if (versions.size > 1) {
        // Vérifier si les versions sont compatibles
        const versionArray = Array.from(versions);
        const compatible = this.areVersionsCompatible(versionArray);
        if (!compatible) {
          conflicts.push({
            name,
            requiredVersions: versionArray,
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Vérifie si des versions sont compatibles entre elles
   */
  private areVersionsCompatible(versions: string[]): boolean {
    if (versions.length <= 1) {
      return true;
    }

    // Trier les versions
    const sortedVersions = versions
      .filter((v) => v !== '*' && semver.valid(v))
      .sort(semver.compare);

    if (sortedVersions.length === 0) {
      return true; // Toutes sont des wildcards
    }

    // Vérifier si toutes les versions satisfont la même plage
    const minVersion = sortedVersions[0];
    const maxVersion = sortedVersions[sortedVersions.length - 1];

    // Si la différence est seulement un patch, c'est compatible
    if (semver.diff(minVersion, maxVersion) === 'patch') {
      return true;
    }

    // Sinon, vérifier si toutes les versions satisfont la version minimale
    return sortedVersions.every((v) => semver.gte(v, minVersion));
  }

  /**
   * Vérifie si une version installée satisfait une exigence de version
   */
  private isVersionSatisfied(installedVersion: string, requiredVersion: string): boolean {
    if (requiredVersion === '*' || !requiredVersion) {
      return true;
    }

    try {
      return semver.satisfies(installedVersion, requiredVersion);
    } catch (error) {
      // Si semver ne peut pas parser, faire une comparaison simple
      return installedVersion === requiredVersion;
    }
  }

  /**
   * Installe toutes les dépendances d'un plugin
   */
  async installDependencies(
    pluginName: string,
    dependencies: Record<string, string>,
  ): Promise<Plugin[]> {
    const resolution = await this.resolveDependencies(pluginName, dependencies);

    if (resolution.conflicts.length > 0) {
      throw new BadRequestException(
        `Conflits de dépendances détectés: ${JSON.stringify(resolution.conflicts)}`,
      );
    }

    if (resolution.circular.length > 0) {
      throw new BadRequestException(
        `Dépendances circulaires détectées: ${resolution.circular.join(' -> ')}`,
      );
    }

    const installedPlugins: Plugin[] = [];

    // Installer les dépendances manquantes
    for (const dep of resolution.toInstall) {
      this.logger.log(
        `[PluginDependenciesService] Installation de la dépendance: ${dep.name}@${dep.version}`,
        'PluginDependenciesService',
      );

      try {
        const plugin = await this.pluginsService.install({
          source: dep.name,
          version: dep.version,
        });
        installedPlugins.push(plugin);
      } catch (error) {
        this.logger.error(
          `[PluginDependenciesService] Erreur lors de l'installation de ${dep.name}: ${error.message}`,
          error.stack,
          'PluginDependenciesService',
        );
        throw new BadRequestException(
          `Impossible d'installer la dépendance ${dep.name}: ${error.message}`,
        );
      }
    }

    // Mettre à jour les dépendances obsolètes
    for (const dep of resolution.toUpdate) {
      this.logger.log(
        `[PluginDependenciesService] Mise à jour de la dépendance: ${dep.name} de ${dep.currentVersion} vers ${dep.requiredVersion}`,
        'PluginDependenciesService',
      );

      try {
        const plugin = await this.pluginsService.findByName(dep.name);
        if (plugin) {
          // TODO: Utiliser le service de mise à jour
          // const updatedPlugin = await this.updateService.updatePlugin(plugin.id, dep.requiredVersion);
          // installedPlugins.push(updatedPlugin);
          this.logger.warn(
            `[PluginDependenciesService] Mise à jour de dépendance non implémentée pour ${dep.name}`,
            'PluginDependenciesService',
          );
        }
      } catch (error) {
        this.logger.warn(
          `[PluginDependenciesService] Impossible de mettre à jour ${dep.name}: ${error.message}`,
          'PluginDependenciesService',
        );
      }
    }

    return installedPlugins;
  }

  /**
   * Vérifie les dépendances d'un plugin installé
   */
  async checkPluginDependencies(pluginId: string): Promise<{
    satisfied: boolean;
    missing: Array<{ name: string; version: string }>;
    outdated: Array<{ name: string; currentVersion: string; requiredVersion: string }>;
  }> {
    const plugin = await this.pluginsService.findOne(pluginId);

    if (!plugin.dependencies || Object.keys(plugin.dependencies).length === 0) {
      return {
        satisfied: true,
        missing: [],
        outdated: [],
      };
    }

    const missing: Array<{ name: string; version: string }> = [];
    const outdated: Array<{ name: string; currentVersion: string; requiredVersion: string }> = [];

    for (const [depName, depVersion] of Object.entries(plugin.dependencies)) {
      const installedPlugin = await this.pluginsService.findByName(depName);

      if (!installedPlugin) {
        missing.push({ name: depName, version: depVersion });
      } else if (!this.isVersionSatisfied(installedPlugin.version, depVersion)) {
        outdated.push({
          name: depName,
          currentVersion: installedPlugin.version,
          requiredVersion: depVersion,
        });
      }
    }

    return {
      satisfied: missing.length === 0 && outdated.length === 0,
      missing,
      outdated,
    };
  }

  /**
   * Récupère tous les plugins qui dépendent d'un plugin donné
   */
  async getDependents(pluginName: string): Promise<Plugin[]> {
    const allPlugins = await this.pluginsService.findAll();
    const dependents: Plugin[] = [];

    for (const plugin of allPlugins) {
      if (plugin.dependencies && plugin.dependencies[pluginName]) {
        dependents.push(plugin);
      }
    }

    return dependents;
  }

  /**
   * Vérifie si un plugin peut être désinstallé (pas de dépendants)
   */
  async canUninstall(pluginId: string): Promise<{ canUninstall: boolean; dependents: Plugin[] }> {
    const plugin = await this.pluginsService.findOne(pluginId);
    const dependents = await this.getDependents(plugin.name);

    return {
      canUninstall: dependents.length === 0,
      dependents,
    };
  }
}

