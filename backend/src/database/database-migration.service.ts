import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Garantit l'application des migrations TypeORM au démarrage
 * et journalise clairement le résultat (utile en Docker / prod).
 *
 * TypeORM exécute déjà les migrations via `migrationsRun`, mais ce service :
 * - applique les migrations encore en attente (filet de sécurité)
 * - échoue le démarrage si une migration plante
 * - laisse une trace explicite dans les logs
 */
@Injectable()
export class DatabaseMigrationService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseMigrationService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    if (!this.dataSource.isInitialized) {
      await this.dataSource.initialize();
    }

    const hasPending = await this.dataSource.showMigrations();
    if (!hasPending) {
      this.logger.log('Schéma à jour — aucune migration en attente');
      return;
    }

    this.logger.log('Migrations en attente détectées — application…');
    const executed = await this.dataSource.runMigrations({ transaction: 'each' });

    if (executed.length === 0) {
      this.logger.log('Aucune migration exécutée');
      return;
    }

    for (const migration of executed) {
      this.logger.log(`Migration appliquée : ${migration.name}`);
    }
    this.logger.log(`${executed.length} migration(s) appliquée(s) avec succès`);
  }
}
