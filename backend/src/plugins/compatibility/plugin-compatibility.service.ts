import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { LoggerService } from '../../logger/logger.service';
import * as semver from 'semver';

export interface VersionCompatibility {
  compatible: boolean;
  currentVersion: string;
  requiredVersion: string;
  reason?: string;
  breakingChanges?: string[];
  migrationRequired?: boolean;
  migrationGuide?: string;
}

export interface BreakingChange {
  version: string;
  description: string;
  affectedPlugins?: string[];
  migrationGuide?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

@Injectable()
export class PluginCompatibilityService {
  private readonly logger: Logger;
  private readonly currentLumyVersion: string;
  private readonly breakingChanges: BreakingChange[] = [];

  constructor(private loggerService: LoggerService) {
    this.logger = new Logger(PluginCompatibilityService.name);
    // Récupérer la version actuelle de Lumy Home
    this.currentLumyVersion = process.env.LUMY_VERSION || '1.0.0';
    
    // Initialiser la liste des breaking changes connus
    this.initializeBreakingChanges();
  }

  /**
   * Initialise la liste des breaking changes connus
   */
  private initializeBreakingChanges(): void {
    // TODO: Charger depuis un fichier de configuration ou une base de données
    this.breakingChanges.push(
      {
        version: '2.0.0',
        description: 'Changement de l\'API des hooks - nouvelle signature requise',
        severity: 'high',
        migrationGuide: 'https://docs.lumy.home/migration/2.0.0',
      },
      {
        version: '1.5.0',
        description: 'Modification de la structure des permissions',
        severity: 'medium',
        migrationGuide: 'https://docs.lumy.home/migration/1.5.0',
      },
    );
  }

  /**
   * Vérifie la compatibilité d'un plugin avec la version actuelle de Lumy Home
   */
  checkCompatibility(requiredVersion: string): VersionCompatibility {
    if (!requiredVersion) {
      return {
        compatible: true,
        currentVersion: this.currentLumyVersion,
        requiredVersion: '*',
      };
    }

    try {
      // Vérifier si la version actuelle satisfait l'exigence
      const compatible = semver.satisfies(this.currentLumyVersion, requiredVersion);

      // Détecter les breaking changes qui affectent cette version
      const relevantBreakingChanges = this.getBreakingChangesForVersion(requiredVersion);
      const migrationRequired = relevantBreakingChanges.length > 0;

      return {
        compatible,
        currentVersion: this.currentLumyVersion,
        requiredVersion,
        reason: compatible
          ? undefined
          : `Version actuelle ${this.currentLumyVersion} ne satisfait pas l'exigence ${requiredVersion}`,
        breakingChanges: relevantBreakingChanges.map((bc) => bc.description),
        migrationRequired,
        migrationGuide: migrationRequired
          ? relevantBreakingChanges[0].migrationGuide
          : undefined,
      };
    } catch (error) {
      // Si semver ne peut pas parser la version, faire une comparaison simple
      this.logger.warn(
        `[PluginCompatibilityService] Impossible de parser la version ${requiredVersion}, utilisation de la comparaison simple`,
        'PluginCompatibilityService',
      );

      const compatible = this.simpleVersionCompare(this.currentLumyVersion, requiredVersion);
      return {
        compatible,
        currentVersion: this.currentLumyVersion,
        requiredVersion,
        reason: compatible
          ? undefined
          : `Version actuelle ${this.currentLumyVersion} ne satisfait pas l'exigence ${requiredVersion}`,
      };
    }
  }

  /**
   * Vérifie la compatibilité d'un plugin avec une version spécifique de Lumy Home
   */
  checkCompatibilityWithVersion(
    requiredVersion: string,
    targetLumyVersion: string,
  ): VersionCompatibility {
    if (!requiredVersion) {
      return {
        compatible: true,
        currentVersion: targetLumyVersion,
        requiredVersion: '*',
      };
    }

    try {
      const compatible = semver.satisfies(targetLumyVersion, requiredVersion);
      const relevantBreakingChanges = this.getBreakingChangesForVersion(requiredVersion);

      return {
        compatible,
        currentVersion: targetLumyVersion,
        requiredVersion,
        reason: compatible
          ? undefined
          : `Version ${targetLumyVersion} ne satisfait pas l'exigence ${requiredVersion}`,
        breakingChanges: relevantBreakingChanges.map((bc) => bc.description),
        migrationRequired: relevantBreakingChanges.length > 0,
        migrationGuide: relevantBreakingChanges[0]?.migrationGuide,
      };
    } catch (error) {
      const compatible = this.simpleVersionCompare(targetLumyVersion, requiredVersion);
      return {
        compatible,
        currentVersion: targetLumyVersion,
        requiredVersion,
        reason: compatible
          ? undefined
          : `Version ${targetLumyVersion} ne satisfait pas l'exigence ${requiredVersion}`,
      };
    }
  }

  /**
   * Récupère les breaking changes qui affectent une version donnée
   */
  private getBreakingChangesForVersion(requiredVersion: string): BreakingChange[] {
    const changes: BreakingChange[] = [];

    try {
      // Récupérer la version minimale requise
      const minVersion = this.extractMinVersion(requiredVersion);

      // Trouver tous les breaking changes entre la version minimale et la version actuelle
      for (const breakingChange of this.breakingChanges) {
        if (
          semver.gte(breakingChange.version, minVersion) &&
          semver.lte(breakingChange.version, this.currentLumyVersion)
        ) {
          changes.push(breakingChange);
        }
      }
    } catch (error) {
      // En cas d'erreur, retourner tous les breaking changes
      this.logger.warn(
        `[PluginCompatibilityService] Erreur lors de l'extraction de la version minimale: ${error.message}`,
        'PluginCompatibilityService',
      );
    }

    return changes;
  }

  /**
   * Extrait la version minimale d'une plage de versions semver
   */
  private extractMinVersion(versionRange: string): string {
    try {
      // Pour les plages comme "^1.0.0" ou ">=1.0.0 <2.0.0", extraire la version minimale
      const range = new semver.Range(versionRange);
      if (range.set && range.set.length > 0) {
        const firstSet = range.set[0];
        if (firstSet.length > 0) {
          const firstComparator = firstSet[0];
          return firstComparator.semver.version;
        }
      }
      return '0.0.0';
    } catch (error) {
      // Si ce n'est pas une plage valide, essayer de parser comme version simple
      try {
        return semver.valid(versionRange) || '0.0.0';
      } catch {
        return '0.0.0';
      }
    }
  }

  /**
   * Comparaison simple de versions (fallback si semver échoue)
   */
  private simpleVersionCompare(current: string, required: string): boolean {
    // Enlever les préfixes comme "v" ou "^"
    const cleanCurrent = current.replace(/^[v^~]/, '');
    const cleanRequired = required.replace(/^[v^~>=<]/, '');

    const currentParts = cleanCurrent.split('.').map(Number);
    const requiredParts = cleanRequired.split('.').map(Number);

    // Comparer les versions majeures
    if (currentParts[0] > requiredParts[0]) {
      return true;
    }
    if (currentParts[0] < requiredParts[0]) {
      return false;
    }

    // Comparer les versions mineures
    if (currentParts[1] > requiredParts[1]) {
      return true;
    }
    if (currentParts[1] < requiredParts[1]) {
      return false;
    }

    // Comparer les patches
    return currentParts[2] >= requiredParts[2];
  }

  /**
   * Vérifie si un plugin peut être mis à jour vers une nouvelle version de Lumy Home
   */
  canUpgradeLumy(
    pluginRequiredVersion: string,
    targetLumyVersion: string,
  ): { canUpgrade: boolean; reason?: string; breakingChanges?: BreakingChange[] } {
    const compatibility = this.checkCompatibilityWithVersion(pluginRequiredVersion, targetLumyVersion);

    if (!compatibility.compatible) {
      return {
        canUpgrade: false,
        reason: compatibility.reason,
        breakingChanges: this.getBreakingChangesForVersion(pluginRequiredVersion),
      };
    }

    // Vérifier s'il y a des breaking changes entre la version actuelle et la cible
    const breakingChanges = this.getBreakingChangesBetweenVersions(
      this.currentLumyVersion,
      targetLumyVersion,
    );

    return {
      canUpgrade: true,
      breakingChanges: breakingChanges.length > 0 ? breakingChanges : undefined,
    };
  }

  /**
   * Récupère les breaking changes entre deux versions
   */
  private getBreakingChangesBetweenVersions(fromVersion: string, toVersion: string): BreakingChange[] {
    const changes: BreakingChange[] = [];

    try {
      for (const breakingChange of this.breakingChanges) {
        if (
          semver.gt(breakingChange.version, fromVersion) &&
          semver.lte(breakingChange.version, toVersion)
        ) {
          changes.push(breakingChange);
        }
      }
    } catch (error) {
      this.logger.warn(
        `[PluginCompatibilityService] Erreur lors de la récupération des breaking changes: ${error.message}`,
        'PluginCompatibilityService',
      );
    }

    return changes;
  }

  /**
   * Récupère tous les breaking changes connus
   */
  getAllBreakingChanges(): BreakingChange[] {
    return [...this.breakingChanges];
  }

  /**
   * Récupère les breaking changes pour une version spécifique
   */
  getBreakingChangesForLumyVersion(version: string): BreakingChange[] {
    return this.breakingChanges.filter((bc) => {
      try {
        return semver.eq(bc.version, version);
      } catch {
        return bc.version === version;
      }
    });
  }

  /**
   * Ajoute un breaking change (pour les mises à jour futures)
   */
  addBreakingChange(breakingChange: BreakingChange): void {
    this.breakingChanges.push(breakingChange);
    // Trier par version (plus récent en premier)
    this.breakingChanges.sort((a, b) => {
      try {
        return semver.rcompare(a.version, b.version);
      } catch {
        return b.version.localeCompare(a.version);
      }
    });
  }

  /**
   * Récupère la version actuelle de Lumy Home
   */
  getCurrentLumyVersion(): string {
    return this.currentLumyVersion;
  }

  /**
   * Vérifie si une version de plugin est compatible avec toutes les versions de Lumy Home dans une plage
   */
  checkCompatibilityRange(
    pluginRequiredVersion: string,
    lumyVersionRange: string,
  ): { compatible: boolean; incompatibleVersions: string[] } {
    const incompatibleVersions: string[] = [];

    try {
      // Générer une liste de versions de test dans la plage
      const range = new semver.Range(lumyVersionRange);
      // Pour simplifier, on teste quelques versions clés
      const testVersions = ['1.0.0', '1.5.0', '2.0.0', '2.5.0'];

      for (const testVersion of testVersions) {
        if (semver.satisfies(testVersion, lumyVersionRange)) {
          const compatibility = this.checkCompatibilityWithVersion(pluginRequiredVersion, testVersion);
          if (!compatibility.compatible) {
            incompatibleVersions.push(testVersion);
          }
        }
      }

      return {
        compatible: incompatibleVersions.length === 0,
        incompatibleVersions,
      };
    } catch (error) {
      this.logger.warn(
        `[PluginCompatibilityService] Erreur lors de la vérification de la plage: ${error.message}`,
        'PluginCompatibilityService',
      );
      return {
        compatible: false,
        incompatibleVersions: [],
      };
    }
  }
}

