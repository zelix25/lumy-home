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
import { HistoryTimelineModule } from './history_timeline/history_timeline.module';
import { HistoryModule } from './history/history.module';
import { PlanModule } from './plan/plan.module';
import { AuthModule } from './auth/auth.module';
import { SettingsModule } from './settings/settings.module';
import { AutomationsModule } from './automations/automations.module';
import { RoomsModule } from './rooms/rooms.module';
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
          migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
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
    HistoryTimelineModule,
    HistoryModule,
    PlanModule,
    AuthModule,
    SettingsModule,
    AutomationsModule,
    RoomsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

