import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggerModule } from './logger/logger.module';
import { MqttModule } from './mqtt/mqtt.module';
import { WebsocketModule } from './websocket/websocket.module';
import { DevicesModule } from './devices/devices.module';
import { AiModule } from './ai/ai.module';
import { HistoryModule } from './history/history.module';
import { PlanModule } from './plan/plan.module';
import { configValidationSchema } from './config/config.validation';

@Module({
  imports: [
    // Configuration globale
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: configValidationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
    // Base de données SQLite
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const dbPath = configService.get<string>('DATABASE_PATH', 'data/homehub.db');
        const nodeEnv = configService.get<string>('NODE_ENV', 'development');
        return {
          type: 'sqlite',
          database: dbPath,
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: nodeEnv !== 'production',
          logging: nodeEnv === 'development',
        };
      },
      inject: [ConfigService],
    }),
    // Modules personnalisés
    LoggerModule,
    MqttModule,
    WebsocketModule,
    DevicesModule,
    AiModule,
    HistoryModule,
    PlanModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

