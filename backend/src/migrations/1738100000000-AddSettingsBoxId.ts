import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Ajoute la colonne boxId à la table settings.
 */
export class AddSettingsBoxId1738100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'settings',
      new TableColumn({
        name: 'boxId',
        type: 'varchar',
        length: '12',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('settings', 'boxId');
  }
}
