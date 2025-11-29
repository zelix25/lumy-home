import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutomationsController } from './automations.controller';
import { AutomationsService } from './automations.service';
import { Automation } from '../ai/entities/automation.entity';
import { AutomationExecutionLog } from './entities/automation-execution-log.entity';
import { DevicesModule } from '../devices/devices.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { LoggerModule } from '../logger/logger.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Automation, AutomationExecutionLog]),
    forwardRef(() => DevicesModule),
    forwardRef(() => WebsocketModule),
    LoggerModule,
  ],
  controllers: [AutomationsController],
  providers: [AutomationsService],
  exports: [AutomationsService],
})
export class AutomationsModule {}

