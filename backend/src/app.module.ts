import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { existsSync } from 'fs';
import { join } from 'path';
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
import { WeatherModule } from './weather/weather.module';
import { StoreModule } from './store/store.module';
import { PluginsModule } from './plugins/plugins.module';
import { SystemHealthModule } from './system-health/system-health.module';
import { configValidationSchema } from './config/config.validation';

@Module({
  imports: [
    // Configuration globale
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        `.env.${process.env.NODE_ENV || 'development'}`,
        '.env',
      ],
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
        const dbPath = configService.get<string>('DATABASE_PATH', 'data/lumy.db');
        const nodeEnv = configService.get<string>('NODE_ENV', 'development');
        
        // Résoudre le chemin absolu de la base de données
        const absoluteDbPath = dbPath.startsWith('/') || dbPath.match(/^[A-Z]:/i)
          ? dbPath
          : join(process.cwd(), dbPath);
        
        // En production, synchroniser uniquement si la base de données n'existe pas encore
        // Cela permet de créer toutes les tables lors de la première exécution
        const shouldSynchronize = nodeEnv !== 'production' || !existsSync(absoluteDbPath);
        
        return {
          type: 'sqlite',
          database: dbPath,
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
          synchronize: shouldSynchronize,
          /* logging: nodeEnv === 'development',*/
          logging: false,
        };
      },
      inject: [ConfigService],
    }),
    // Module de planification pour les tâches cron
    ScheduleModule.forRoot(),
    // Module d'événements pour les hooks de plugins
    EventEmitterModule.forRoot(),
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
    WeatherModule,
    StoreModule,
    PluginsModule,
    SystemHealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

