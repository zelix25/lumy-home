import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PluginsController } from './plugins.controller';
import { PluginsService } from './plugins.service';
import { PluginInstallService } from './plugin-install.service';
import { PluginRuntimeService } from './plugin-runtime.service';
import { PluginUninstallService } from './plugin-uninstall.service';
import { PluginManifestValidatorService } from './plugin-manifest-validator.service';
import { PluginConfigService } from './plugin-config.service';
import { PluginPermissionsService } from './plugin-permissions.service';
import { Plugin } from './entities/plugin.entity';
import { LoggerModule } from '../logger/logger.module';
import { StoreModule } from '../store/store.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Plugin]),
    LoggerModule,
    forwardRef(() => StoreModule),
  ],
  controllers: [PluginsController],
  providers: [
    PluginsService,
    PluginInstallService,
    PluginRuntimeService,
    PluginUninstallService,
    PluginManifestValidatorService,
    PluginConfigService,
    PluginPermissionsService,
  ],
  exports: [
    PluginsService,
    PluginInstallService,
    PluginRuntimeService,
    PluginUninstallService,
    PluginManifestValidatorService,
    PluginConfigService,
    PluginPermissionsService,
  ],
})
export class PluginsModule {}

