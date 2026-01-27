import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { Telegram } from './entities/telegram.entity';
import { LoggerModule } from '../logger/logger.module';
import { DevicesModule } from '../devices/devices.module';
import { UpdaterModule } from '../updater/updater.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Telegram]),
    LoggerModule,
    forwardRef(() => DevicesModule),
    forwardRef(() => UpdaterModule),
  ],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
