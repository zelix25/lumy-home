import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PluginsController } from './plugins.controller';
import { PluginsStaticController } from './plugins-static.controller';
import { PluginsService } from './plugins.service';
import { PluginInstallService } from './plugin-install.service';
import { PluginRuntimeService } from './plugin-runtime.service';
import { PluginUninstallService } from './plugin-uninstall.service';
import { PluginManifestValidatorService } from './plugin-manifest-validator.service';
import { PluginConfigService } from './plugin-config.service';
import { PluginPermissionsService } from './plugin-permissions.service';
import { PluginUIExtensionService } from './plugin-ui-extension.service';
import { PluginAutomationExtensionService } from './plugin-automation-extension.service';
import { PluginHooksService } from './plugin-hooks.service';
import { Plugin } from './entities/plugin.entity';
import { PluginUIExtension } from './entities/plugin-ui-extension.entity';
import { PluginAutomationExtension } from './entities/plugin-automation-extension.entity';
import { LoggerModule } from '../logger/logger.module';
import { StoreModule } from '../store/store.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Plugin,
      PluginUIExtension,
      PluginAutomationExtension,
    ]),
    LoggerModule,
    forwardRef(() => StoreModule),
  ],
  controllers: [PluginsController, PluginsStaticController],
  providers: [
    PluginsService,
    PluginInstallService,
    PluginRuntimeService,
    PluginUninstallService,
    PluginManifestValidatorService,
    PluginConfigService,
    PluginPermissionsService,
    PluginUIExtensionService,
    PluginAutomationExtensionService,
    PluginHooksService,
  ],
  exports: [
    PluginsService,
    PluginInstallService,
    PluginRuntimeService,
    PluginUninstallService,
    PluginManifestValidatorService,
    PluginConfigService,
    PluginPermissionsService,
    PluginUIExtensionService,
    PluginAutomationExtensionService,
    PluginHooksService,
  ],
})
export class PluginsModule {}

