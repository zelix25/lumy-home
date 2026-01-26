import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Migration pour créer la table telegram
 * Date: 2025-01-23
 */
export class CreateTelegramTable1737657600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'telegram',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
          },
          {
            name: 'chatId',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'token_bot',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: 0,
          },
          {
            name: 'pin',
            type: 'varchar',
            length: '6',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'datetime',
            default: "CURRENT_TIMESTAMP",
          },
          {
            name: 'updatedAt',
            type: 'datetime',
            default: "CURRENT_TIMESTAMP",
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('telegram');
  }
}
