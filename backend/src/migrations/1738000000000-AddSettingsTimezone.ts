import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Ajoute la colonne timezone à la table settings.
 */
export class AddSettingsTimezone1738000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'settings',
      new TableColumn({
        name: 'timezone',
        type: 'varchar',
        length: '64',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('settings', 'timezone');
  }
}
