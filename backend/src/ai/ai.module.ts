import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { Automation } from './entities/automation.entity';
import { DevicesModule } from '../devices/devices.module';
import { LoggerModule } from '../logger/logger.module';
import { HistoryTimelineModule } from '../history_timeline/history_timeline.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Automation]),
    DevicesModule,
    LoggerModule,
    forwardRef(() => HistoryTimelineModule),
  ],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}

