import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { PluginsService } from './plugins.service';
import { InstallPluginDto } from './dto/install-plugin.dto';
import { InstallFromStoreDto } from './dto/install-from-store.dto';
import { UpdateConfigDto } from './dto/update-config.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('plugins')
@UseGuards(JwtAuthGuard)
export class PluginsController {
  constructor(private readonly pluginsService: PluginsService) {}

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
}

