import { Module } from '@nestjs/common';
import { WebsocketGateway } from './websocket.gateway';
import { MqttModule } from '../mqtt/mqtt.module';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '../config/config.service';
import { SystemModule } from '../system/system.module';

@Module({
  imports: [MqttModule, ConfigModule, SystemModule],
  providers: [WebsocketGateway, ConfigService],
  exports: [WebsocketGateway],
})
export class WebsocketModule {}

