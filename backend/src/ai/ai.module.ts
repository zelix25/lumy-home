import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { Automation } from './entities/automation.entity';
import { DevicesModule } from '../devices/devices.module';
import { LoggerModule } from '../logger/logger.module';
import { HistoryModule } from '../history/history.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Automation]),
    DevicesModule,
    LoggerModule,
    forwardRef(() => HistoryModule),
  ],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}

