import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { PluginsService } from './plugins.service';
import { PluginUIExtensionService } from './plugin-ui-extension.service';
import { PluginAutomationExtensionService } from './plugin-automation-extension.service';
import { PluginNotificationService } from './plugin-notification.service';
import { PluginStorageService } from './plugin-storage.service';
import { PluginErrorService } from './plugin-error.service';
import { PluginCircuitBreakerService } from './plugin-circuit-breaker.service';
import { PluginIsolationService } from './plugin-isolation.service';
import { PluginTestService } from './plugin-test.service';
import { PluginAnalyticsService } from './plugin-analytics.service';
import { PluginMonitoringService } from './plugin-monitoring.service';
import { ErrorSeverity, ErrorStatus } from './entities/plugin-error.entity';
import { TestType } from './entities/plugin-test.entity';
import { AnalyticsEventType } from './entities/plugin-analytics.entity';
import { CreateTestDto } from './dto/create-test.dto';
import { InstallPluginDto } from './dto/install-plugin.dto';
import { InstallFromStoreDto } from './dto/install-from-store.dto';
import { UpdateConfigDto } from './dto/update-config.dto';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { SetStorageDto } from './dto/set-storage.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UIExtensionType } from './entities/plugin-ui-extension.entity';

@Controller('plugins')
@UseGuards(JwtAuthGuard)
export class PluginsController {
  constructor(
    private readonly pluginsService: PluginsService,
    private readonly uiExtensionService: PluginUIExtensionService,
    private readonly automationExtensionService: PluginAutomationExtensionService,
    private readonly notificationService: PluginNotificationService,
    private readonly storageService: PluginStorageService,
    private readonly errorService: PluginErrorService,
    private readonly circuitBreakerService: PluginCircuitBreakerService,
    private readonly isolationService: PluginIsolationService,
    private readonly testService: PluginTestService,
    private readonly analyticsService: PluginAnalyticsService,
    private readonly monitoringService: PluginMonitoringService,
  ) {}

  /**
   * Récupère tous les plugins
   */
  @Get()
  async findAll() {
    return this.pluginsService.findAll();
  }

  /**
   * Récupère un plugin par son ID
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.pluginsService.findOne(id);
  }

  /**
   * Installe un nouveau plugin (méthode manuelle - pour tests)
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async install(@Body() installDto: InstallPluginDto) {
    return this.pluginsService.install(installDto);
  }

  /**
   * Récupère les plugins disponibles sur le Lumy Store
   */
  @Get('store/available')
  async getAvailablePluginsFromStore(
    @CurrentUser() user: { id: string; email: string },
    @Query('search') search?: string,
    @Query('category') category?: string,
  ) {
    return this.pluginsService.getAvailablePluginsFromStore(user.id, search, category);
  }

  /**
   * Récupère les détails d'un plugin depuis le Lumy Store
   */
  @Get('store/:pluginId')
  async getPluginFromStore(
    @CurrentUser() user: { id: string; email: string },
    @Param('pluginId') pluginId: string,
  ) {
    return this.pluginsService.getPluginFromStore(user.id, pluginId);
  }

  /**
   * Installe un plugin depuis le Lumy Store
   */
  @Post('store/install')
  @HttpCode(HttpStatus.CREATED)
  async installFromStore(
    @CurrentUser() user: { id: string; email: string },
    @Body() installDto: InstallFromStoreDto,
  ) {
    return this.pluginsService.installFromStore(user.id, installDto.pluginId);
  }

  /**
   * Active un plugin
   */
  @Post(':id/enable')
  @HttpCode(HttpStatus.OK)
  async enable(@Param('id') id: string) {
    return this.pluginsService.enable(id);
  }

  /**
   * Désactive un plugin
   */
  @Post(':id/disable')
  @HttpCode(HttpStatus.OK)
  async disable(@Param('id') id: string) {
    return this.pluginsService.disable(id);
  }

  /**
   * Désinstalle un plugin
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async uninstall(@Param('id') id: string) {
    await this.pluginsService.uninstall(id);
  }

  /**
   * Met à jour la configuration d'un plugin
   */
  @Put(':id/config')
  @HttpCode(HttpStatus.OK)
  async updateConfig(
    @Param('id') id: string,
    @Body() updateConfigDto: UpdateConfigDto,
  ) {
    return this.pluginsService.updateConfig(id, updateConfigDto.config);
  }

  /**
   * Analyse les permissions d'un plugin (déclarées vs détectées)
   */
  @Get(':id/permissions/analyze')
  @HttpCode(HttpStatus.OK)
  async analyzePermissions(@Param('id') id: string) {
    return this.pluginsService.analyzePermissions(id);
  }

  /**
   * Récupère toutes les extensions UI disponibles
   */
  @Get('ui-extensions')
  async getAllExtensions(@Query('type') type?: UIExtensionType) {
    return this.uiExtensionService.getAllExtensions(type);
  }

  /**
   * Récupère toutes les pages disponibles
   */
  @Get('ui-extensions/pages')
  async getAvailablePages() {
    return this.uiExtensionService.getAvailablePages();
  }

  /**
   * Récupère tous les widgets disponibles
   */
  @Get('ui-extensions/widgets')
  async getAvailableWidgets() {
    return this.uiExtensionService.getAvailableWidgets();
  }

  /**
   * Récupère tous les éléments de menu disponibles
   */
  @Get('ui-extensions/menu-items')
  async getAvailableMenuItems() {
    return this.uiExtensionService.getAvailableMenuItems();
  }

  /**
   * Récupère toutes les extensions UI d'un plugin
   */
  @Get(':id/ui-extensions')
  async getPluginExtensions(
    @Param('id') id: string,
    @Query('type') type?: UIExtensionType,
  ) {
    return this.uiExtensionService.getPluginExtensions(id, type);
  }

  /**
   * Récupère toutes les extensions d'automatisation disponibles
   */
  @Get('automation-extensions')
  async getAllAutomationExtensions(@Query('type') type?: string) {
    return this.automationExtensionService.getAllExtensions(type as any);
  }

  /**
   * Récupère tous les triggers disponibles
   */
  @Get('automation-extensions/triggers')
  async getAvailableTriggers() {
    return this.automationExtensionService.getAvailableTriggers();
  }

  /**
   * Récupère toutes les conditions disponibles
   */
  @Get('automation-extensions/conditions')
  async getAvailableConditions() {
    return this.automationExtensionService.getAvailableConditions();
  }

  /**
   * Récupère toutes les actions disponibles
   */
  @Get('automation-extensions/actions')
  async getAvailableActions() {
    return this.automationExtensionService.getAvailableActions();
  }

  /**
   * Récupère toutes les extensions d'automatisation d'un plugin
   */
  @Get(':id/automation-extensions')
  async getPluginAutomationExtensions(
    @Param('id') id: string,
    @Query('type') type?: string,
  ) {
    return this.automationExtensionService.getPluginExtensions(id, type as any);
  }

  /**
   * Envoie une notification depuis un plugin
   */
  @Post(':id/notifications')
  @HttpCode(HttpStatus.CREATED)
  async sendNotification(
    @Param('id') pluginId: string,
    @Body() notificationDto: CreateNotificationDto,
  ) {
    return this.notificationService.sendNotification(pluginId, {
      ...notificationDto,
      expiresAt: notificationDto.expiresAt
        ? new Date(notificationDto.expiresAt)
        : undefined,
    });
  }

  /**
   * Récupère les notifications de l'utilisateur
   */
  @Get('notifications')
  async getUserNotifications(
    @CurrentUser() user: { id: string },
    @Query('limit') limit?: number,
    @Query('unreadOnly') unreadOnly?: boolean,
  ) {
    return this.notificationService.getUserNotifications(
      user.id,
      limit ? parseInt(limit.toString(), 10) : 50,
      unreadOnly === true,
    );
  }

  /**
   * Marque une notification comme lue
   */
  @Put('notifications/:notificationId/read')
  @HttpCode(HttpStatus.OK)
  async markNotificationAsRead(
    @Param('notificationId') notificationId: string,
    @CurrentUser() user: { id: string },
  ) {
    await this.notificationService.markAsRead(notificationId, user.id);
    return { message: 'Notification marquée comme lue' };
  }

  /**
   * Supprime une notification
   */
  @Delete('notifications/:notificationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteNotification(
    @Param('notificationId') notificationId: string,
    @CurrentUser() user: { id: string },
  ) {
    await this.notificationService.deleteNotification(notificationId, user.id);
  }

  /**
   * Récupère les statistiques de notifications d'un plugin
   */
  @Get(':id/notifications/stats')
  async getPluginNotificationStats(@Param('id') pluginId: string) {
    return this.notificationService.getPluginNotificationStats(pluginId);
  }

  /**
   * Stocke une valeur pour un plugin
   */
  @Post(':id/storage')
  @HttpCode(HttpStatus.CREATED)
  async setStorage(
    @Param('id') pluginId: string,
    @Body() setStorageDto: SetStorageDto,
  ) {
    return this.storageService.set(
      pluginId,
      setStorageDto.key,
      setStorageDto.value,
      setStorageDto.ttl,
    );
  }

  /**
   * Récupère une valeur pour un plugin
   */
  @Get(':id/storage/:key')
  async getStorage(
    @Param('id') pluginId: string,
    @Param('key') key: string,
  ) {
    const value = await this.storageService.get(pluginId, key);
    if (value === null) {
      throw new NotFoundException(`Clé "${key}" non trouvée pour ce plugin`);
    }
    return { key, value };
  }

  /**
   * Vérifie si une clé existe pour un plugin
   */
  @Get(':id/storage/:key/exists')
  async hasStorage(
    @Param('id') pluginId: string,
    @Param('key') key: string,
  ) {
    const exists = await this.storageService.has(pluginId, key);
    return { key, exists };
  }

  /**
   * Récupère toutes les clés d'un plugin
   */
  @Get(':id/storage/keys')
  async getStorageKeys(@Param('id') pluginId: string) {
    const keys = await this.storageService.keys(pluginId);
    return { keys };
  }

  /**
   * Récupère toutes les entrées d'un plugin
   */
  @Get(':id/storage')
  async getAllStorage(@Param('id') pluginId: string) {
    const data = await this.storageService.getAll(pluginId);
    return data;
  }

  /**
   * Supprime une clé pour un plugin
   */
  @Delete(':id/storage/:key')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteStorage(
    @Param('id') pluginId: string,
    @Param('key') key: string,
  ) {
    const deleted = await this.storageService.delete(pluginId, key);
    if (!deleted) {
      throw new NotFoundException(`Clé "${key}" non trouvée pour ce plugin`);
    }
  }

  /**
   * Supprime toutes les données d'un plugin
   */
  @Delete(':id/storage')
  @HttpCode(HttpStatus.OK)
  async clearStorage(@Param('id') pluginId: string) {
    const count = await this.storageService.clear(pluginId);
    return { message: `${count} entrée(s) supprimée(s)`, count };
  }

  /**
   * Récupère les statistiques de stockage d'un plugin
   */
  @Get(':id/storage/stats')
  async getStorageStats(@Param('id') pluginId: string) {
    return this.storageService.getStats(pluginId);
  }

  /**
   * Récupère les erreurs d'un plugin
   */
  @Get(':id/errors')
  async getPluginErrors(
    @Param('id') pluginId: string,
    @Query('limit') limit?: number,
    @Query('severity') severity?: ErrorSeverity,
    @Query('status') status?: ErrorStatus,
  ) {
    return this.errorService.getPluginErrors(
      pluginId,
      limit ? parseInt(limit.toString(), 10) : 50,
      severity,
      status,
    );
  }

  /**
   * Récupère les statistiques d'erreurs d'un plugin
   */
  @Get(':id/errors/stats')
  async getPluginErrorStats(@Param('id') pluginId: string) {
    return this.errorService.getPluginErrorStats(pluginId);
  }

  /**
   * Marque une erreur comme résolue
   */
  @Put('errors/:errorId/resolve')
  @HttpCode(HttpStatus.OK)
  async resolveError(@Param('errorId') errorId: string) {
    return this.errorService.markAsResolved(errorId);
  }

  /**
   * Marque une erreur comme ignorée
   */
  @Put('errors/:errorId/ignore')
  @HttpCode(HttpStatus.OK)
  async ignoreError(@Param('errorId') errorId: string) {
    return this.errorService.markAsIgnored(errorId);
  }

  /**
   * Récupère l'état du circuit breaker d'un plugin
   */
  @Get(':id/circuit-breaker/state')
  async getCircuitBreakerState(@Param('id') pluginId: string) {
    const state = this.circuitBreakerService.getCircuitState(pluginId);
    const stats = this.circuitBreakerService.getCircuitStats(pluginId);
    return {
      state: state || 'closed',
      stats: stats || null,
    };
  }

  /**
   * Réinitialise le circuit breaker d'un plugin
   */
  @Post(':id/circuit-breaker/reset')
  @HttpCode(HttpStatus.OK)
  async resetCircuitBreaker(@Param('id') pluginId: string) {
    this.circuitBreakerService.resetCircuit(pluginId);
    this.isolationService.resetIsolation(pluginId);
    return { message: 'Circuit breaker réinitialisé' };
  }

  /**
   * Récupère toutes les erreurs non résolues
   */
  @Get('errors/unresolved')
  async getUnresolvedErrors(@Query('limit') limit?: number) {
    return this.errorService.getUnresolvedErrors(
      limit ? parseInt(limit.toString(), 10) : 100,
    );
  }

  /**
   * Crée un test pour un plugin
   */
  @Post(':id/tests')
  @HttpCode(HttpStatus.CREATED)
  async createTest(
    @Param('id') pluginId: string,
    @Body() createTestDto: CreateTestDto,
  ) {
    return this.testService.createTest(pluginId, createTestDto);
  }

  /**
   * Récupère tous les tests d'un plugin
   */
  @Get(':id/tests')
  async getPluginTests(
    @Param('id') pluginId: string,
    @Query('type') type?: TestType,
  ) {
    return this.testService.getPluginTests(pluginId, type);
  }

  /**
   * Récupère un test par ID
   */
  @Get('tests/:testId')
  async getTest(@Param('testId') testId: string) {
    return this.testService.getTest(testId);
  }

  /**
   * Exécute un test
   */
  @Post('tests/:testId/run')
  @HttpCode(HttpStatus.OK)
  async runTest(@Param('testId') testId: string) {
    return this.testService.runTest(testId);
  }

  /**
   * Exécute tous les tests d'un plugin
   */
  @Post(':id/tests/run-all')
  @HttpCode(HttpStatus.OK)
  async runAllTests(@Param('id') pluginId: string) {
    return this.testService.runAllTests(pluginId);
  }

  /**
   * Vérifie si un plugin peut être publié (tous les tests requis passent)
   */
  @Get(':id/tests/can-publish')
  async canPublish(@Param('id') pluginId: string) {
    return this.testService.canPublish(pluginId);
  }

  /**
   * Récupère les statistiques de tests d'un plugin
   */
  @Get(':id/tests/stats')
  async getTestStats(@Param('id') pluginId: string) {
    return this.testService.getTestStats(pluginId);
  }

  /**
   * Supprime un test
   */
  @Delete('tests/:testId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTest(@Param('testId') testId: string) {
    await this.testService.deleteTest(testId);
  }

  /**
   * Enregistre un événement d'analytics pour un plugin
   */
  @Post(':id/analytics/track')
  @HttpCode(HttpStatus.CREATED)
  async trackEvent(
    @Param('id') pluginId: string,
    @Body() eventDto: { eventType: AnalyticsEventType; userId?: string; metadata?: Record<string, any>; context?: string },
  ) {
    return this.analyticsService.trackEvent(pluginId, eventDto);
  }

  /**
   * Récupère les statistiques d'analytics d'un plugin
   */
  @Get(':id/analytics/stats')
  async getPluginAnalyticsStats(
    @Param('id') pluginId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.analyticsService.getPluginStats(pluginId, start, end);
  }

  /**
   * Récupère les événements d'analytics d'un plugin
   */
  @Get(':id/analytics/events')
  async getPluginAnalyticsEvents(
    @Param('id') pluginId: string,
    @Query('limit') limit?: number,
    @Query('eventType') eventType?: AnalyticsEventType,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.analyticsService.getPluginEvents(
      pluginId,
      limit ? parseInt(limit.toString(), 10) : 100,
      eventType,
      start,
      end,
    );
  }

  /**
   * Récupère les statistiques globales d'analytics
   */
  @Get('analytics/global')
  async getGlobalAnalytics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.analyticsService.getGlobalStats(start, end);
  }

  /**
   * Récupère les métriques de monitoring d'un plugin
   */
  @Get(':id/monitoring/metrics')
  async getPluginMetrics(@Param('id') pluginId: string) {
    return this.monitoringService.getPluginMetrics(pluginId);
  }

  /**
   * Récupère les statistiques d'exécution d'un plugin
   */
  @Get(':id/monitoring/execution-stats')
  async getExecutionStats(@Param('id') pluginId: string) {
    return this.monitoringService.getExecutionStats(pluginId);
  }

  /**
   * Récupère le rapport de santé d'un plugin
   */
  @Get(':id/monitoring/health')
  async getHealthReport(@Param('id') pluginId: string) {
    return this.monitoringService.getHealthReport(pluginId);
  }

  /**
   * Récupère les métriques de tous les plugins
   */
  @Get('monitoring/all-metrics')
  async getAllPluginsMetrics() {
    return this.monitoringService.getAllPluginsMetrics();
  }
}

