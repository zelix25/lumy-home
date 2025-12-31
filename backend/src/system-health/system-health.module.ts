import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemHealthService } from './system-health.service';
import { SystemHealthController } from './system-health.controller';
import { SystemNotification } from './entities/system-notification.entity';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SystemNotification]),
    WebsocketModule,
  ],
  controllers: [SystemHealthController],
  providers: [SystemHealthService],
  exports: [SystemHealthService],
})
export class SystemHealthModule {}

