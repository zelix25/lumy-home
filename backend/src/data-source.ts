import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';

// Charger les variables d'environnement
config();

const configService = new ConfigService();
const dbPath = configService.get<string>('DATABASE_PATH', 'data/homehub.db');
const nodeEnv = configService.get<string>('NODE_ENV', 'development');

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: dbPath,
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
  synchronize: nodeEnv !== 'production',
  logging: nodeEnv === 'development',
});

