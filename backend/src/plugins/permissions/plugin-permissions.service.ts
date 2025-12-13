import { Injectable, BadRequestException } from '@nestjs/common';
import { LoggerService } from '../../logger/logger.service';
import {
  PluginPermission,
  PermissionCategory,
  PermissionRiskLevel,
  PermissionRiskMap,
  PermissionDescriptions,
} from './plugin-permissions.enum';

@Injectable()
export class PluginPermissionsService {
  constructor(private logger: LoggerService) {}

  /**
   * Valide que toutes les permissions demandées sont valides
   */
  validatePermissions(permissions: string[]): void {
    if (!Array.isArray(permissions)) {
      throw new BadRequestException('Les permissions doivent être un tableau');
    }

    const validPermissions = Object.values(PluginPermission) as string[];
    const invalidPermissions: string[] = [];

    for (const permission of permissions) {
      if (!validPermissions.includes(permission)) {
        invalidPermissions.push(permission);
      }
    }

    if (invalidPermissions.length > 0) {
      throw new BadRequestException(
        `Permissions invalides: ${invalidPermissions.join(', ')}`,
      );
    }

    this.logger.log(
      `[PluginPermissionsService] ${permissions.length} permission(s) validée(s)`,
      'PluginPermissionsService',
    );
  }

  /**
   * Vérifie si un plugin a une permission spécifique
   */
  hasPermission(pluginPermissions: string[], permission: PluginPermission): boolean {
    return pluginPermissions.includes(permission);
  }

  /**
   * Vérifie si un plugin a toutes les permissions requises
   */
  hasAllPermissions(pluginPermissions: string[], requiredPermissions: PluginPermission[]): boolean {
    return requiredPermissions.every((permission) =>
      pluginPermissions.includes(permission),
    );
  }

  /**
   * Vérifie si un plugin a au moins une des permissions requises
   */
  hasAnyPermission(pluginPermissions: string[], requiredPermissions: PluginPermission[]): boolean {
    return requiredPermissions.some((permission) =>
      pluginPermissions.includes(permission),
    );
  }

  /**
   * Filtre les permissions par niveau de risque
   */
  filterByRiskLevel(
    permissions: string[],
    riskLevel: PermissionRiskLevel,
  ): string[] {
    return permissions.filter(
      (permission) => PermissionRiskMap[permission as PluginPermission] === riskLevel,
    );
  }

  /**
   * Filtre les permissions par catégorie
   */
  filterByCategory(permissions: string[], category: PermissionCategory): string[] {
    // Cette méthode nécessiterait un mapping inverse, pour l'instant on retourne toutes les permissions
    // TODO: Implémenter le filtrage par catégorie si nécessaire
    return permissions;
  }

  /**
   * Obtient le niveau de risque le plus élevé parmi les permissions d'un plugin
   */
  getHighestRiskLevel(permissions: string[]): PermissionRiskLevel {
    if (permissions.length === 0) {
      return PermissionRiskLevel.LOW;
    }

    const riskLevels = permissions.map(
      (permission) => PermissionRiskMap[permission as PluginPermission],
    );

    if (riskLevels.includes(PermissionRiskLevel.CRITICAL)) {
      return PermissionRiskLevel.CRITICAL;
    }
    if (riskLevels.includes(PermissionRiskLevel.HIGH)) {
      return PermissionRiskLevel.HIGH;
    }
    if (riskLevels.includes(PermissionRiskLevel.MEDIUM)) {
      return PermissionRiskLevel.MEDIUM;
    }
    return PermissionRiskLevel.LOW;
  }

  /**
   * Obtient les descriptions des permissions
   */
  getPermissionDescriptions(permissions: string[]): Record<string, string> {
    const descriptions: Record<string, string> = {};
    for (const permission of permissions) {
      descriptions[permission] = PermissionDescriptions[permission as PluginPermission] || permission;
    }
    return descriptions;
  }

  /**
   * Analyse les permissions et retourne un rapport
   */
  analyzePermissions(permissions: string[]): {
    total: number;
    byCategory: Record<PermissionCategory, number>;
    byRiskLevel: Record<PermissionRiskLevel, number>;
    highestRisk: PermissionRiskLevel;
    criticalPermissions: string[];
    highRiskPermissions: string[];
  } {
    const byCategory: Record<PermissionCategory, number> = {
      [PermissionCategory.READ]: 0,
      [PermissionCategory.WRITE]: 0,
      [PermissionCategory.SYSTEM]: 0,
      [PermissionCategory.NETWORK]: 0,
      [PermissionCategory.STORAGE]: 0,
      [PermissionCategory.NOTIFICATIONS]: 0,
      [PermissionCategory.UI]: 0,
      [PermissionCategory.ADVANCED]: 0,
    };

    const byRiskLevel: Record<PermissionRiskLevel, number> = {
      [PermissionRiskLevel.LOW]: 0,
      [PermissionRiskLevel.MEDIUM]: 0,
      [PermissionRiskLevel.HIGH]: 0,
      [PermissionRiskLevel.CRITICAL]: 0,
    };

    const criticalPermissions: string[] = [];
    const highRiskPermissions: string[] = [];

    for (const permission of permissions) {
      const risk = PermissionRiskMap[permission as PluginPermission];
      byRiskLevel[risk]++;

      if (risk === PermissionRiskLevel.CRITICAL) {
        criticalPermissions.push(permission);
      } else if (risk === PermissionRiskLevel.HIGH) {
        highRiskPermissions.push(permission);
      }
    }

    return {
      total: permissions.length,
      byCategory,
      byRiskLevel,
      highestRisk: this.getHighestRiskLevel(permissions),
      criticalPermissions,
      highRiskPermissions,
    };
  }

  /**
   * Vérifie si les permissions demandées nécessitent une confirmation utilisateur
   */
  requiresUserConfirmation(permissions: string[]): boolean {
    const highestRisk = this.getHighestRiskLevel(permissions);
    return (
      highestRisk === PermissionRiskLevel.HIGH ||
      highestRisk === PermissionRiskLevel.CRITICAL
    );
  }

  /**
   * Obtient la liste de toutes les permissions disponibles
   */
  getAllPermissions(): PluginPermission[] {
    return Object.values(PluginPermission);
  }
}

