import { Module } from '@nestjs/common';
import { UpdaterService } from './updater.service';
import { UpdaterController } from './updater.controller';
import { WebsocketModule } from '../websocket/websocket.module';
import { LoggerModule } from '../logger/logger.module';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '../config/config.service';

@Module({
  imports: [WebsocketModule, LoggerModule, ConfigModule],
  controllers: [UpdaterController],
  providers: [UpdaterService, ConfigService],
  exports: [UpdaterService],
})
export class UpdaterModule {}
