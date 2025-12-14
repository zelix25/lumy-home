import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PluginsService } from './plugins.service';
import { PluginsStoreService } from './plugins-store.service';
import { PluginPermissionsService } from './permissions/plugin-permissions.service';
import { PluginUpdateService } from './update/plugin-update.service';
import { PluginHooksService } from './hooks/plugin-hooks.service';
import { PluginDependenciesService } from './dependencies/plugin-dependencies.service';
import { PluginLoggerService } from './monitoring/plugin-logger.service';
import { PluginMonitoringService } from './monitoring/plugin-monitoring.service';
import { PluginCompatibilityService } from './compatibility/plugin-compatibility.service';
import { PluginCertificationService } from './certification/plugin-certification.service';
import { PluginBackupService } from './backup/plugin-backup.service';
import { PluginAutomationExtensionService } from './automation/plugin-automation-extension.service';
import { PluginUIExtensionService } from './ui/plugin-ui-extension.service';
import { PluginNotificationService } from './notifications/plugin-notification.service';
import { PluginStorageService } from './storage/plugin-storage.service';
import { PluginErrorService } from './errors/plugin-error.service';
import { PluginTestService } from './tests/plugin-test.service';
import { PluginAnalyticsService, AnalyticsStats, TimeSeriesData } from './analytics/plugin-analytics.service';
import { PluginPaymentService } from './payment/plugin-payment.service';
import { LicenseType, PaymentProvider } from './payment/plugin-license.entity';
import { ExtensionType } from './automation/plugin-automation-extension.entity';
import { UIExtensionType, UIComponentType } from './ui/plugin-ui-extension.entity';
import { NotificationLevel, NotificationStatus } from './notifications/plugin-notification.entity';
import { ErrorType, ErrorSeverity } from './errors/plugin-error.entity';
import { TestRunStatus } from './tests/plugin-test-run.entity';
import { AnalyticsEventType } from './analytics/plugin-analytics.entity';
import { CertificationStatus, ReviewPriority } from './certification/plugin-certification.entity';
import { InstallPluginDto } from './dto/install-plugin.dto';
import { UpdatePluginConfigDto } from './dto/update-plugin-config.dto';
import { StoreSearchDto } from './dto/store-plugin.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('plugins')
@UseGuards(JwtAuthGuard)
export class PluginsController {
  constructor(
    private readonly pluginsService: PluginsService,
    private readonly pluginsStoreService: PluginsStoreService,
    private readonly permissionsService: PluginPermissionsService,
    private readonly updateService: PluginUpdateService,
    private readonly hooksService: PluginHooksService,
    private readonly dependenciesService: PluginDependenciesService,
    private readonly pluginLogger: PluginLoggerService,
    private readonly monitoringService: PluginMonitoringService,
    private readonly compatibilityService: PluginCompatibilityService,
    private readonly certificationService: PluginCertificationService,
    private readonly backupService: PluginBackupService,
    private readonly automationExtensionService: PluginAutomationExtensionService,
    private readonly uiExtensionService: PluginUIExtensionService,
    private readonly notificationService: PluginNotificationService,
    private readonly storageService: PluginStorageService,
    private readonly errorService: PluginErrorService,
    private readonly testService: PluginTestService,
    private readonly analyticsService: PluginAnalyticsService,
    private readonly paymentService: PluginPaymentService,
  ) {}

  @Get()
  async findAll() {
    return this.pluginsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.pluginsService.findOne(id);
  }

  @Post('install')
  @HttpCode(HttpStatus.CREATED)
  async install(@Body() installDto: InstallPluginDto) {
    return this.pluginsService.install(installDto);
  }

  @Post(':id/enable')
  @HttpCode(HttpStatus.OK)
  async enable(@Param('id') id: string) {
    return this.pluginsService.enable(id);
  }

  @Post(':id/disable')
  @HttpCode(HttpStatus.OK)
  async disable(@Param('id') id: string) {
    return this.pluginsService.disable(id);
  }

  @Put(':id/config')
  async updateConfig(
    @Param('id') id: string,
    @Body() updateConfigDto: UpdatePluginConfigDto,
  ) {
    return this.pluginsService.updateConfig(id, updateConfigDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async uninstall(@Param('id') id: string) {
    await this.pluginsService.uninstall(id);
  }

  // Store endpoints
  @Get('store/search')
  async searchStore(@Query() searchDto: StoreSearchDto) {
    return this.pluginsStoreService.search(searchDto);
  }

  @Get('store/categories')
  async getCategories() {
    return this.pluginsStoreService.getCategories();
  }

  @Get('store/featured')
  async getFeatured() {
    return this.pluginsStoreService.getFeatured();
  }

  @Get('store/:id')
  async getStorePlugin(@Param('id') id: string) {
    return this.pluginsStoreService.findOne(id);
  }

  // Permissions endpoints
  @Get(':id/permissions')
  async getPluginPermissions(@Param('id') id: string) {
    const plugin = await this.pluginsService.findOne(id);
    return {
      permissions: plugin.permissions || [],
      analysis: plugin.permissions
        ? await this.pluginsService.getPluginPermissionsAnalysis(id)
        : null,
    };
  }

  @Get('permissions/available')
  async getAvailablePermissions() {
    return {
      permissions: this.permissionsService.getAllPermissions(),
    };
  }

  // Configuration endpoints
  @Get(':id/config/schema')
  async getConfigSchema(@Param('id') id: string) {
    return {
      schema: await this.pluginsService.getConfigSchema(id),
    };
  }

  @Post(':id/config/validate')
  async validateConfig(
    @Param('id') id: string,
    @Body() body: { config: any },
  ) {
    const validation = await this.pluginsService.validatePluginConfig(id, body.config);
    return validation;
  }

  // Update endpoints
  @Get(':id/update/check')
  async checkForUpdate(@Param('id') id: string) {
    return this.updateService.checkForUpdate(id);
  }

  @Get('update/check-all')
  async checkAllForUpdates() {
    return this.updateService.checkAllForUpdates();
  }

  @Post(':id/update')
  @HttpCode(HttpStatus.OK)
  async updatePlugin(
    @Param('id') id: string,
    @Body() body?: { version?: string },
  ) {
    return this.updateService.updatePlugin(id, body?.version);
  }

  @Post('update/all')
  @HttpCode(HttpStatus.OK)
  async updateAll() {
    return this.updateService.updateAll();
  }

  // Hooks endpoints
  @Get(':id/hooks')
  async getPluginHooks(@Param('id') id: string) {
    return {
      hooks: this.hooksService.getHooksForPlugin(id),
    };
  }

  @Get('hooks/all')
  async getAllHooks() {
    const hooksMap = this.hooksService.getAllHooks();
    const hooks: Array<{ eventType: string; hooks: any[] }> = [];
    for (const [eventType, hooksList] of hooksMap.entries()) {
      hooks.push({ eventType, hooks: hooksList });
    }
    return { hooks };
  }

  @Post('hooks/trigger')
  @HttpCode(HttpStatus.OK)
  async triggerHook(
    @Body() body: { eventType: string; data: Record<string, any>; source?: string },
  ) {
    await this.hooksService.triggerHook(body.eventType, body.data, body.source);
    return { success: true };
  }

  // Dependencies endpoints
  @Get(':id/dependencies/check')
  async checkDependencies(@Param('id') id: string) {
    return this.dependenciesService.checkPluginDependencies(id);
  }

  @Get(':id/dependencies/resolve')
  async resolveDependencies(@Param('id') id: string) {
    const plugin = await this.pluginsService.findOne(id);
    if (!plugin.dependencies) {
      return {
        toInstall: [],
        toUpdate: [],
        conflicts: [],
        circular: [],
      };
    }
    return this.dependenciesService.resolveDependencies(plugin.name, plugin.dependencies);
  }

  @Get(':id/dependents')
  async getDependents(@Param('id') id: string) {
    const plugin = await this.pluginsService.findOne(id);
    return this.dependenciesService.getDependents(plugin.name);
  }

  @Get(':id/dependencies/can-uninstall')
  async canUninstall(@Param('id') id: string) {
    return this.dependenciesService.canUninstall(id);
  }

  // Monitoring endpoints
  @Get(':id/logs')
  async getPluginLogs(
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('level') level?: 'debug' | 'info' | 'warn' | 'error',
    @Query('limit') limit?: string,
  ) {
    return this.pluginLogger.getLogs(id, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      level,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id/metrics')
  async getPluginMetrics(@Param('id') id: string) {
    return this.monitoringService.getMetrics(id);
  }

  @Get(':id/performance')
  async getPluginPerformance(
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('operation') operation?: string,
    @Query('limit') limit?: string,
  ) {
    return this.monitoringService.getPerformanceHistory(id, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      operation,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('monitoring/stats')
  async getMonitoringStats() {
    return this.monitoringService.getAggregatedStats();
  }

  @Get('monitoring/metrics')
  async getAllMetrics() {
    return this.monitoringService.getAllMetrics();
  }

  @Post(':id/metrics/reset')
  @HttpCode(HttpStatus.OK)
  async resetMetrics(@Param('id') id: string) {
    this.monitoringService.resetMetrics(id);
    return { success: true };
  }

  // Compatibility endpoints
  @Get(':id/compatibility')
  async checkPluginCompatibility(@Param('id') id: string) {
    const plugin = await this.pluginsService.findOne(id);
    if (!plugin.lumyVersion) {
      return {
        compatible: true,
        currentVersion: this.compatibilityService.getCurrentLumyVersion(),
        requiredVersion: '*',
      };
    }
    return this.compatibilityService.checkCompatibility(plugin.lumyVersion);
  }

  @Post('compatibility/check')
  async checkCompatibility(@Body() body: { requiredVersion: string }) {
    return this.compatibilityService.checkCompatibility(body.requiredVersion);
  }

  @Post('compatibility/check-version')
  async checkCompatibilityWithVersion(
    @Body() body: { requiredVersion: string; targetVersion: string },
  ) {
    return this.compatibilityService.checkCompatibilityWithVersion(
      body.requiredVersion,
      body.targetVersion,
    );
  }

  @Post('compatibility/can-upgrade')
  async canUpgradeLumy(
    @Body() body: { pluginRequiredVersion: string; targetLumyVersion: string },
  ) {
    return this.compatibilityService.canUpgradeLumy(
      body.pluginRequiredVersion,
      body.targetLumyVersion,
    );
  }

  @Get('compatibility/breaking-changes')
  async getAllBreakingChanges() {
    return this.compatibilityService.getAllBreakingChanges();
  }

  @Get('compatibility/breaking-changes/:version')
  async getBreakingChangesForVersion(@Param('version') version: string) {
    return this.compatibilityService.getBreakingChangesForLumyVersion(version);
  }

  @Get('compatibility/current-version')
  async getCurrentLumyVersion() {
    return {
      version: this.compatibilityService.getCurrentLumyVersion(),
    };
  }

  // Certification endpoints
  @Post(':id/certification/submit')
  async submitForCertification(@Param('id') id: string) {
    const plugin = await this.pluginsService.findOne(id);
    const pluginPath = plugin.installPath;
    
    if (!pluginPath) {
      throw new BadRequestException('Plugin non installé localement');
    }

    return this.certificationService.submitForCertification(
      plugin.name,
      plugin.version,
      pluginPath,
    );
  }

  @Get('certification')
  async getCertifications(
    @Query('status') status?: CertificationStatus,
    @Query('pluginName') pluginName?: string,
  ) {
    return this.certificationService.findAll({ status, pluginName });
  }

  @Get('certification/:id')
  async getCertification(@Param('id') id: string) {
    return this.certificationService.findOne(id);
  }

  @Get(':id/certification')
  async getPluginCertification(
    @Param('id') id: string,
  ) {
    const plugin = await this.pluginsService.findOne(id);
    return this.certificationService.findByPlugin(plugin.name, plugin.version);
  }

  @Post('certification/:id/approve')
  @HttpCode(HttpStatus.OK)
  async approveCertification(
    @Param('id') id: string,
    @Body() body: { reviewerId: string; notes?: string },
  ) {
    return this.certificationService.approveCertification(
      id,
      body.reviewerId,
      body.notes,
    );
  }

  @Post('certification/:id/reject')
  @HttpCode(HttpStatus.OK)
  async rejectCertification(
    @Param('id') id: string,
    @Body() body: { reviewerId: string; reason: string; notes?: string },
  ) {
    return this.certificationService.rejectCertification(
      id,
      body.reviewerId,
      body.reason,
      body.notes,
    );
  }

  @Post('certification/:id/revoke')
  @HttpCode(HttpStatus.OK)
  async revokeCertification(
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.certificationService.revokeCertification(id, body.reason);
  }

  @Post('certification/:id/priority')
  @HttpCode(HttpStatus.OK)
  async updatePriority(
    @Param('id') id: string,
    @Body() body: { priority: ReviewPriority },
  ) {
    return this.certificationService.updatePriority(id, body.priority);
  }

  @Post('certification/:id/verify')
  @HttpCode(HttpStatus.OK)
  async verifySignature(
    @Param('id') id: string,
    @Body() body: { checksum: string },
  ) {
    const certification = await this.certificationService.findOne(id);
    
    if (!certification.isSigned || !certification.signature) {
      return { valid: false, reason: 'Plugin non signé' };
    }

    const valid = await this.certificationService.verifySignature(
      certification.pluginName,
      certification.pluginVersion,
      body.checksum || certification.checksum,
      certification.signature,
    );

    return { valid, reason: valid ? 'Signature valide' : 'Signature invalide' };
  }

  // Backup/Restore endpoints
  @Post('backup/export')
  async exportConfigurations(
    @Body() body?: { pluginIds?: string[]; filename?: string },
  ) {
    if (body?.filename) {
      const filePath = await this.backupService.exportToFile(
        body.pluginIds,
        body.filename,
      );
      return {
        success: true,
        filePath,
        message: 'Configuration exportée avec succès',
      };
    }
    return this.backupService.exportConfigurations(body?.pluginIds);
  }

  @Post('backup/import')
  async importConfigurations(
    @Body()
    body: {
      exportData: any;
      options?: {
        overwrite?: boolean;
        skipMissing?: boolean;
        validate?: boolean;
      };
    },
  ) {
    return this.backupService.importConfigurations(body.exportData, body.options);
  }

  @Post('backup/import-file')
  async importFromFile(
    @Body()
    body: {
      filePath: string;
      options?: {
        overwrite?: boolean;
        skipMissing?: boolean;
        validate?: boolean;
      };
    },
  ) {
    return this.backupService.importFromFile(body.filePath, body.options);
  }

  @Get('backup/list')
  async listBackups() {
    return this.backupService.listBackups();
  }

  @Delete('backup/:filename')
  @HttpCode(HttpStatus.OK)
  async deleteBackup(@Param('filename') filename: string) {
    await this.backupService.deleteBackup(filename);
    return { success: true, message: 'Sauvegarde supprimée avec succès' };
  }

  @Post('backup/restore/:filename')
  async restoreFromBackup(
    @Param('filename') filename: string,
    @Body()
    body?: {
      options?: {
        overwrite?: boolean;
        skipMissing?: boolean;
        validate?: boolean;
      };
    },
  ) {
    return this.backupService.restoreFromBackup(filename, body?.options);
  }

  @Post(':id/backup/create')
  async createAutoBackup(@Param('id') id: string) {
    const filePath = await this.backupService.createAutoBackup(id);
    return {
      success: true,
      filePath,
      message: 'Sauvegarde automatique créée avec succès',
    };
  }

  @Post(':id/backup/compare')
  async compareConfigurations(
    @Param('id') id: string,
    @Body() body: { backupFilename: string },
  ) {
    return this.backupService.compareConfigurations(id, body.backupFilename);
  }

  // Automation Extension endpoints
  @Post('automation/extensions/register')
  async registerExtension(
    @Body()
    body: {
      pluginId: string;
      type: ExtensionType;
      name: string;
      displayName: string;
      configSchema: any;
      handlerPath?: string;
      description?: string;
      metadata?: Record<string, any>;
    },
  ) {
    return this.automationExtensionService.registerExtension(
      body.pluginId,
      body.type,
      body.name,
      body.displayName,
      body.configSchema,
      body.handlerPath,
      body.description,
      body.metadata,
    );
  }

  @Delete('automation/extensions/:id')
  @HttpCode(HttpStatus.OK)
  async unregisterExtension(@Param('id') id: string) {
    await this.automationExtensionService.unregisterExtension(id);
    return { success: true, message: 'Extension désenregistrée avec succès' };
  }

  @Post('automation/extensions/:id/enable')
  @HttpCode(HttpStatus.OK)
  async enableExtension(@Param('id') id: string) {
    return this.automationExtensionService.setExtensionEnabled(id, true);
  }

  @Post('automation/extensions/:id/disable')
  @HttpCode(HttpStatus.OK)
  async disableExtension(@Param('id') id: string) {
    return this.automationExtensionService.setExtensionEnabled(id, false);
  }

  @Get('automation/extensions')
  async getExtensions(
    @Query('pluginId') pluginId?: string,
    @Query('type') type?: ExtensionType,
    @Query('enabled') enabled?: string,
  ) {
    return this.automationExtensionService.findAll({
      pluginId,
      type,
      enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined,
    });
  }

  @Get('automation/extensions/triggers')
  async getAvailableTriggers() {
    return this.automationExtensionService.getAvailableTriggers();
  }

  @Get('automation/extensions/actions')
  async getAvailableActions() {
    return this.automationExtensionService.getAvailableActions();
  }

  @Get('automation/extensions/:id')
  async getExtension(@Param('id') id: string) {
    return this.automationExtensionService.findOne(id);
  }

  // UI Extension endpoints
  @Post('ui/extensions/register')
  async registerUIExtension(
    @Body()
    body: {
      pluginId: string;
      type: UIExtensionType;
      name: string;
      displayName: string;
      description?: string;
      route?: string;
      icon?: string;
      componentType?: UIComponentType;
      componentPath?: string;
      iframeUrl?: string;
      props?: Record<string, any>;
      permissions?: string[];
      metadata?: Record<string, any>;
      order?: number;
    },
  ) {
    return this.uiExtensionService.registerExtension(
      body.pluginId,
      body.type,
      body.name,
      body.displayName,
      {
        description: body.description,
        route: body.route,
        icon: body.icon,
        componentType: body.componentType,
        componentPath: body.componentPath,
        iframeUrl: body.iframeUrl,
        props: body.props,
        permissions: body.permissions,
        metadata: body.metadata,
        order: body.order,
      },
    );
  }

  @Delete('ui/extensions/:id')
  @HttpCode(HttpStatus.OK)
  async unregisterUIExtension(@Param('id') id: string) {
    await this.uiExtensionService.unregisterExtension(id);
    return { success: true, message: 'Extension UI désenregistrée avec succès' };
  }

  @Post('ui/extensions/:id/enable')
  @HttpCode(HttpStatus.OK)
  async enableUIExtension(@Param('id') id: string) {
    return this.uiExtensionService.setExtensionEnabled(id, true);
  }

  @Post('ui/extensions/:id/disable')
  @HttpCode(HttpStatus.OK)
  async disableUIExtension(@Param('id') id: string) {
    return this.uiExtensionService.setExtensionEnabled(id, false);
  }

  @Get('ui/extensions')
  async getUIExtensions(
    @Query('pluginId') pluginId?: string,
    @Query('type') type?: UIExtensionType,
    @Query('enabled') enabled?: string,
  ) {
    return this.uiExtensionService.findAll({
      pluginId,
      type,
      enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined,
    });
  }

  @Get('ui/extensions/pages')
  async getAvailablePages() {
    return this.uiExtensionService.getAvailablePages();
  }

  @Get('ui/extensions/components')
  async getAvailableComponents() {
    return this.uiExtensionService.getAvailableComponents();
  }

  @Get('ui/extensions/widgets')
  async getAvailableWidgets() {
    return this.uiExtensionService.getAvailableWidgets();
  }

  @Get('ui/extensions/menu-items')
  async getAvailableMenuItems() {
    return this.uiExtensionService.getAvailableMenuItems();
  }

  @Get('ui/extensions/route/:route')
  async getExtensionByRoute(@Param('route') route: string) {
    const extension = await this.uiExtensionService.findByRoute(route);
    if (!extension) {
      throw new NotFoundException(`Extension UI non trouvée pour la route: ${route}`);
    }
    return extension;
  }

  @Get('ui/extensions/:id')
  async getUIExtension(@Param('id') id: string) {
    return this.uiExtensionService.findOne(id);
  }

  @Put('ui/extensions/:id/order')
  @HttpCode(HttpStatus.OK)
  async updateUIExtensionOrder(
    @Param('id') id: string,
    @Body() body: { order: number },
  ) {
    return this.uiExtensionService.updateOrder(id, body.order);
  }

  @Get('ui/extensions/:id/validate')
  async validateUIExtension(@Param('id') id: string) {
    const isValid = await this.uiExtensionService.validateComponent(id);
    return { valid: isValid };
  }

  // Storage endpoints
  @Post(':id/storage/set')
  async setStorage(
    @Param('id') id: string,
    @Body()
    body: {
      key: string;
      value: any;
      type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
      metadata?: Record<string, any>;
      expiresAt?: string;
    },
  ) {
    return this.storageService.set(id, body.key, body.value, {
      type: body.type,
      metadata: body.metadata,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    });
  }

  @Get(':id/storage/get/:key')
  async getStorage(
    @Param('id') id: string,
    @Param('key') key: string,
    @Query('default') defaultValue?: string,
  ) {
    let defaultVal: any = undefined;
    if (defaultValue !== undefined) {
      try {
        defaultVal = JSON.parse(defaultValue);
      } catch {
        defaultVal = defaultValue;
      }
    }
    const value = await this.storageService.get(id, key, defaultVal);
    return { key, value };
  }

  @Get(':id/storage/all')
  async getAllStorage(@Param('id') id: string) {
    return this.storageService.getAll(id);
  }

  @Get(':id/storage/keys')
  async getStorageKeys(@Param('id') id: string) {
    const keys = await this.storageService.getKeys(id);
    return { keys };
  }

  @Get(':id/storage/has/:key')
  async hasStorage(@Param('id') id: string, @Param('key') key: string) {
    const has = await this.storageService.has(id, key);
    return { key, has };
  }

  @Delete(':id/storage/delete/:key')
  @HttpCode(HttpStatus.OK)
  async deleteStorage(@Param('id') id: string, @Param('key') key: string) {
    await this.storageService.delete(id, key);
    return { success: true, message: 'Clé supprimée avec succès' };
  }

  @Delete(':id/storage/clear')
  @HttpCode(HttpStatus.OK)
  async clearStorage(@Param('id') id: string) {
    const count = await this.storageService.clear(id);
    return { success: true, count, message: `${count} entrée(s) supprimée(s)` };
  }

  @Get(':id/storage/count')
  async getStorageCount(@Param('id') id: string) {
    const count = await this.storageService.getCount(id);
    return { count };
  }

  @Get(':id/storage/size')
  async getStorageSize(@Param('id') id: string) {
    const size = await this.storageService.getSize(id);
    return { size, sizeFormatted: this.formatBytes(size) };
  }

  @Delete('storage/expired')
  @HttpCode(HttpStatus.OK)
  async deleteExpiredStorage() {
    const count = await this.storageService.deleteExpired();
    return { success: true, count, message: `${count} entrée(s) expirée(s) supprimée(s)` };
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  // Error management endpoints
  @Get(':id/errors')
  async getPluginErrors(
    @Param('id') id: string,
    @Query('type') type?: ErrorType,
    @Query('severity') severity?: ErrorSeverity,
    @Query('resolved') resolved?: string,
    @Query('limit') limit?: string,
  ) {
    return this.errorService.getPluginErrors(id, {
      type,
      severity,
      resolved: resolved === 'true' ? true : resolved === 'false' ? false : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id/errors/stats')
  async getErrorStats(@Param('id') id: string) {
    return this.errorService.getErrorStats(id);
  }

  @Get('errors/:errorId')
  async getError(@Param('errorId') errorId: string) {
    return this.errorService.getError(errorId);
  }

  @Post('errors/:errorId/resolve')
  @HttpCode(HttpStatus.OK)
  async resolveError(@Param('errorId') errorId: string) {
    return this.errorService.resolveError(errorId);
  }

  @Delete(':id/errors')
  @HttpCode(HttpStatus.OK)
  async clearPluginErrors(@Param('id') id: string) {
    const count = await this.errorService.clearPluginErrors(id);
    return { success: true, count, message: `${count} erreur(s) supprimée(s)` };
  }

  @Post(':id/errors/circuit-breaker/reset')
  @HttpCode(HttpStatus.OK)
  async resetCircuitBreaker(@Param('id') id: string) {
    await this.errorService.resetCircuitBreaker(id);
    return { success: true, message: 'Circuit breaker réinitialisé' };
  }

  @Get(':id/errors/circuit-breaker/status')
  async getCircuitBreakerStatus(@Param('id') id: string) {
    const isOpen = this.errorService.isCircuitBreakerOpen(id);
    return { isOpen, message: isOpen ? 'Circuit breaker ouvert' : 'Circuit breaker fermé' };
  }

  // Test endpoints
  @Post(':id/tests/run')
  async runTests(
    @Param('id') id: string,
    @Body() body?: { categories?: string[] },
  ) {
    return this.testService.runTests(id, body?.categories);
  }

  @Get(':id/tests/runs')
  async getTestRuns(
    @Param('id') id: string,
    @Query('status') status?: TestRunStatus,
    @Query('limit') limit?: string,
  ) {
    return this.testService.getTestRuns(id, {
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('tests/runs/:runId')
  async getTestRun(@Param('runId') runId: string) {
    return this.testService.getTestRun(runId);
  }

  @Get('tests/runs/:runId/tests')
  async getTests(@Param('runId') runId: string) {
    return this.testService.getTests(runId);
  }

  @Get(':id/tests/can-publish')
  async canPublish(@Param('id') id: string) {
    return this.testService.canPublish(id);
  }

  @Get(':id/tests/stats')
  async getTestStats(@Param('id') id: string) {
    return this.testService.getTestStats(id);
  }

  // Analytics endpoints
  @Post(':id/analytics/record')
  async recordAnalyticsEvent(
    @Param('id') id: string,
    @Body()
    body: {
      eventType: AnalyticsEventType;
      metadata?: Record<string, any>;
      userId?: string;
      duration?: number;
      success?: boolean;
    },
  ) {
    return this.analyticsService.recordEvent(
      id,
      body.eventType,
      body.metadata,
      body.userId,
      body.duration,
      body.success,
    );
  }

  @Get(':id/analytics/stats')
  async getAnalyticsStats(
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.analyticsService.getStats(id, start, end);
  }

  @Get(':id/analytics/time-series')
  async getTimeSeries(
    @Param('id') id: string,
    @Query('days') days?: string,
  ) {
    const daysNum = days ? parseInt(days, 10) : 30;
    return this.analyticsService.getTimeSeries(id, daysNum);
  }

  @Get(':id/analytics/recent-events')
  async getRecentEvents(
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.analyticsService.getRecentEvents(id, limitNum);
  }

  @Get(':id/analytics/by-event-type')
  async getStatsByEventType(@Param('id') id: string) {
    return this.analyticsService.getStatsByEventType(id);
  }

  @Get('analytics/popular')
  async getPopularPlugins(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.analyticsService.getPopularPlugins(limitNum);
  }

  @Get('analytics/global-stats')
  async getGlobalStats() {
    return this.analyticsService.getGlobalStats();
  }

  // Payment endpoints
  @Post(':id/payment/create-intent')
  async createPaymentIntent(
    @Param('id') id: string,
    @Body()
    body: {
      userId: string;
      licenseType: LicenseType;
      price: number;
      currency?: string;
      paymentProvider?: PaymentProvider;
    },
  ) {
    return this.paymentService.createPaymentIntent(
      id,
      body.userId,
      body.licenseType,
      body.price,
      body.currency || 'EUR',
      body.paymentProvider || PaymentProvider.STRIPE,
    );
  }

  @Post('payment/confirm/:licenseId')
  async confirmPayment(
    @Param('licenseId') licenseId: string,
    @Body() body: { paymentId: string },
  ) {
    return this.paymentService.confirmPayment(licenseId, body.paymentId);
  }

  @Post('payment/cancel-subscription/:licenseId')
  async cancelSubscription(@Param('licenseId') licenseId: string) {
    return this.paymentService.cancelSubscription(licenseId);
  }

  @Get(':id/license/check')
  async checkLicense(
    @Param('id') id: string,
    @Query('userId') userId: string,
  ) {
    const hasLicense = await this.paymentService.hasActiveLicense(id, userId);
    const license = await this.paymentService.getUserLicense(id, userId);
    return {
      hasActiveLicense: hasLicense,
      license: license || null,
    };
  }

  @Get('licenses/user/:userId')
  async getUserLicenses(@Param('userId') userId: string) {
    return this.paymentService.getUserLicenses(userId);
  }

  @Get(':id/licenses')
  async getPluginLicenses(@Param('id') id: string) {
    return this.paymentService.getPluginLicenses(id);
  }

  @Post('payment/webhook/stripe')
  @HttpCode(HttpStatus.OK)
  async handleStripeWebhook(@Body() body: any) {
    // TODO: Vérifier la signature du webhook Stripe
    // TODO: Gérer les différents types d'événements (payment_intent.succeeded, customer.subscription.updated, etc.)
    
    if (body.type === 'payment_intent.succeeded') {
      const paymentIntent = body.data.object;
      // Trouver la licence par paymentId et l'activer
      // await this.paymentService.confirmPayment(licenseId, paymentIntent.id);
    } else if (body.type === 'customer.subscription.updated' || body.type === 'invoice.payment_succeeded') {
      const subscription = body.data.object;
      // Renouveler l'abonnement
      // await this.paymentService.renewSubscription(subscription.id);
    }

    return { received: true };
  }
}

