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
}

