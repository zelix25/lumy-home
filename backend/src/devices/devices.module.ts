import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { Zigbee2MqttService } from './zigbee2mqtt.service';
import { Device } from './entities/device.entity';
import { MqttModule } from '../mqtt/mqtt.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { LoggerModule } from '../logger/logger.module';
import { HistoryTimelineModule } from '../history_timeline/history_timeline.module';
import { HistoryModule } from '../history/history.module';
import { AutomationsModule } from '../automations/automations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Device]),
    LoggerModule,
    MqttModule,
    WebsocketModule,
    HistoryModule,
    forwardRef(() => HistoryTimelineModule),
    forwardRef(() => AutomationsModule),
  ],
  controllers: [DevicesController],
  providers: [DevicesService, Zigbee2MqttService],
  exports: [DevicesService, Zigbee2MqttService],
})
export class DevicesModule {}

