import { Module } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '../config/config.service';

@Module({
  imports: [ConfigModule],
  providers: [MqttService, ConfigService],
  exports: [MqttService],
})
export class MqttModule {}

