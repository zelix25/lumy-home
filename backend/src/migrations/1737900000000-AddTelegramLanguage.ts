import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Ajoute la colonne language à la table telegram (i18n du bot).
 */
export class AddTelegramLanguage1737900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'telegram',
      new TableColumn({
        name: 'language',
        type: 'varchar',
        length: '10',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('telegram', 'language');
  }
}
