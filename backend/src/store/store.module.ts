import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoreAuthService } from './store-auth.service';
import { StoreAuthController } from './store-auth.controller';
import { StoreApiService } from './store-api.service';
import { User } from '../auth/entities/user.entity';
import { LoggerModule } from '../logger/logger.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), LoggerModule],
  controllers: [StoreAuthController],
  providers: [StoreAuthService, StoreApiService],
  exports: [StoreAuthService, StoreApiService],
})
export class StoreModule {}

