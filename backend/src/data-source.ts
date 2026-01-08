import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { History } from './history/entities/history.entity';
import { History as HistoryTimeline } from './history_timeline/entities/history_timeline.entity';
import { Plan } from './plan/entities/plan.entity';
import { Room } from './rooms/entities/room.entity';
import { Device } from './devices/entities/device.entity';
import { Automation } from './ai/entities/automation.entity';
import { AutomationExecutionLog } from './automations/entities/automation-execution-log.entity';
import { Settings } from './settings/entities/settings.entity';
import { User } from './auth/entities/user.entity';

// Charger les variables d'environnement
config();

const configService = new ConfigService();
const dbPath = configService.get<string>('DATABASE_PATH', 'data/lumy.db');
const nodeEnv = configService.get<string>('NODE_ENV', 'development');

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: dbPath,
  entities: [
    History,
    HistoryTimeline,
    Plan,
    Room,
    Device,
    Automation,
    AutomationExecutionLog,
    Settings,
    User,
  ],
  migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
  synchronize: nodeEnv !== 'production',
  logging: false, /*nodeEnv === 'development',*/
});

