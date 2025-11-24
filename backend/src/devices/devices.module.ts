import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { Zigbee2MqttService } from './zigbee2mqtt.service';
import { Device } from './entities/device.entity';
import { MqttModule } from '../mqtt/mqtt.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { LoggerModule } from '../logger/logger.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Device]),
    LoggerModule,
    MqttModule,
    WebsocketModule,
  ],
  controllers: [DevicesController],
  providers: [DevicesService, Zigbee2MqttService],
  exports: [DevicesService, Zigbee2MqttService],
})
export class DevicesModule {}

