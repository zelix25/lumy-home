import { MigrationInterface, QueryRunner } from 'typeorm';
import { addColumnIfMissing, tableExists } from './migration.utils';

/**
 * Aligne le schéma SQLite des bases déjà déployées avec les entités actuelles.
 * Toutes les opérations sont idempotentes (safe après un synchronize initial).
 */
export class EnsureSchemaColumns1762430400000 implements MigrationInterface {
  name = 'EnsureSchemaColumns1762430400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // devices.icon — icônes personnalisées UI
    await addColumnIfMissing(queryRunner, 'devices', {
      name: 'icon',
      type: 'varchar',
      length: '50',
      isNullable: true,
    });

    // users — connexion store par clé API
    await addColumnIfMissing(queryRunner, 'users', {
      name: 'storeApiToken',
      type: 'varchar',
      length: '255',
      isNullable: true,
    });
    await addColumnIfMissing(queryRunner, 'users', {
      name: 'storeApiTokenGeneratedAt',
      type: 'datetime',
      isNullable: true,
    });
    await addColumnIfMissing(queryRunner, 'users', {
      name: 'storeEmail',
      type: 'varchar',
      length: '255',
      isNullable: true,
    });

    // settings — timezone / boxId
    await addColumnIfMissing(queryRunner, 'settings', {
      name: 'timezone',
      type: 'varchar',
      length: '64',
      isNullable: true,
    });
    await addColumnIfMissing(queryRunner, 'settings', {
      name: 'boxId',
      type: 'varchar',
      length: '36',
      isNullable: true,
    });

    // telegram.language — i18n bot
    if (await tableExists(queryRunner, 'telegram')) {
      await addColumnIfMissing(queryRunner, 'telegram', {
        name: 'language',
        type: 'varchar',
        length: '10',
        isNullable: true,
      });
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Pas de rollback destructif automatique sur SQLite (données utilisateur).
    // Les colonnes ajoutées restent en place.
    void queryRunner;
  }
}
