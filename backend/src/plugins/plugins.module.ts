import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PluginsController } from './plugins.controller';
import { PluginsStaticController } from './plugins-static.controller';
import { PluginPaymentController } from './payment/plugin-payment.controller';
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
import { PluginNotificationService } from './plugin-notification.service';
import { PluginStorageService } from './plugin-storage.service';
import { PluginErrorService } from './plugin-error.service';
import { PluginCircuitBreakerService } from './plugin-circuit-breaker.service';
import { PluginIsolationService } from './plugin-isolation.service';
import { PluginTestService } from './plugin-test.service';
import { PluginAnalyticsService } from './plugin-analytics.service';
import { PluginMonitoringService } from './plugin-monitoring.service';
import { PluginPaymentService } from './payment/plugin-payment.service';
import { PluginLicenseService } from './payment/plugin-license.service';
import { Plugin } from './entities/plugin.entity';
import { PluginUIExtension } from './entities/plugin-ui-extension.entity';
import { PluginAutomationExtension } from './entities/plugin-automation-extension.entity';
import { PluginNotification } from './entities/plugin-notification.entity';
import { PluginStorage } from './entities/plugin-storage.entity';
import { PluginError } from './entities/plugin-error.entity';
import { PluginTest } from './entities/plugin-test.entity';
import { PluginTestRun } from './entities/plugin-test-run.entity';
import { PluginAnalytics } from './entities/plugin-analytics.entity';
import { PluginLicense } from './entities/plugin-license.entity';
import { LoggerModule } from '../logger/logger.module';
import { StoreModule } from '../store/store.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Plugin,
      PluginUIExtension,
      PluginAutomationExtension,
      PluginNotification,
      PluginStorage,
      PluginError,
      PluginTest,
      PluginTestRun,
      PluginAnalytics,
      PluginLicense,
    ]),
    LoggerModule,
    WebsocketModule,
    forwardRef(() => StoreModule),
  ],
  controllers: [PluginsController, PluginsStaticController, PluginPaymentController],
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
    PluginNotificationService,
    PluginStorageService,
    PluginErrorService,
    PluginCircuitBreakerService,
    PluginIsolationService,
    PluginTestService,
    PluginAnalyticsService,
    PluginMonitoringService,
    PluginPaymentService,
    PluginLicenseService,
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
    PluginNotificationService,
    PluginStorageService,
    PluginErrorService,
    PluginCircuitBreakerService,
    PluginIsolationService,
    PluginTestService,
    PluginAnalyticsService,
    PluginMonitoringService,
    PluginPaymentService,
    PluginLicenseService,
  ],
})
export class PluginsModule {}

