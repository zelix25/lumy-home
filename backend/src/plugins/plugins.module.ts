import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PluginsController } from './plugins.controller';
import { PluginsService } from './plugins.service';
import { PluginsStoreService } from './plugins-store.service';
import { PluginPermissionsService } from './permissions/plugin-permissions.service';
import { PluginConfigService } from './configuration/plugin-config.service';
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
import { PluginAnalyticsService } from './analytics/plugin-analytics.service';
import { PluginPaymentService } from './payment/plugin-payment.service';
import { Plugin } from './entities/plugin.entity';
import { PluginCertification } from './certification/plugin-certification.entity';
import { PluginAutomationExtension } from './automation/plugin-automation-extension.entity';
import { PluginUIExtension } from './ui/plugin-ui-extension.entity';
import { PluginNotification } from './notifications/plugin-notification.entity';
import { PluginStorage } from './storage/plugin-storage.entity';
import { PluginError } from './errors/plugin-error.entity';
import { PluginTest } from './tests/plugin-test.entity';
import { PluginTestRun } from './tests/plugin-test-run.entity';
import { PluginAnalytics } from './analytics/plugin-analytics.entity';
import { PluginLicense } from './payment/plugin-license.entity';
import { LoggerModule } from '../logger/logger.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Plugin, PluginCertification, PluginAutomationExtension, PluginUIExtension, PluginNotification, PluginStorage, PluginError, PluginTest, PluginTestRun, PluginAnalytics, PluginLicense]),
    LoggerModule,
    WebsocketModule,
  ],
  controllers: [PluginsController],
  providers: [
    PluginsService,
    PluginsStoreService,
    PluginPermissionsService,
    PluginConfigService,
    PluginUpdateService,
    PluginHooksService,
    PluginDependenciesService,
    PluginLoggerService,
    PluginMonitoringService,
    PluginCompatibilityService,
    PluginCertificationService,
    PluginBackupService,
    PluginAutomationExtensionService,
    PluginUIExtensionService,
    PluginNotificationService,
    PluginStorageService,
    PluginErrorService,
    PluginTestService,
    PluginAnalyticsService,
    PluginPaymentService,
  ],
  exports: [
    PluginsService,
    PluginPermissionsService,
    PluginConfigService,
    PluginUpdateService,
    PluginHooksService,
    PluginDependenciesService,
    PluginLoggerService,
    PluginMonitoringService,
    PluginCompatibilityService,
    PluginCertificationService,
    PluginBackupService,
    PluginAutomationExtensionService,
    PluginUIExtensionService,
    PluginNotificationService,
    PluginStorageService,
    PluginErrorService,
    PluginTestService,
    PluginAnalyticsService,
    PluginPaymentService,
  ],
})
export class PluginsModule {}

