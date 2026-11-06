import { QueryRunner, TableColumn, TableColumnOptions } from 'typeorm';

/**
 * Helpers SQLite pour des migrations idempotentes
 * (nécessaire car les bases neuves sont créées via synchronize,
 * puis les migrations s'exécutent aux redémarrages suivants).
 */

export async function tableExists(
  queryRunner: QueryRunner,
  tableName: string,
): Promise<boolean> {
  const rows: Array<{ name: string }> = await queryRunner.query(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
    [tableName],
  );
  return rows.length > 0;
}

export async function columnExists(
  queryRunner: QueryRunner,
  tableName: string,
  columnName: string,
): Promise<boolean> {
  if (!(await tableExists(queryRunner, tableName))) {
    return false;
  }
  const rows: Array<{ name: string }> = await queryRunner.query(
    `PRAGMA table_info("${tableName}")`,
  );
  return rows.some((row) => row.name === columnName);
}

export async function addColumnIfMissing(
  queryRunner: QueryRunner,
  tableName: string,
  column: TableColumnOptions,
): Promise<boolean> {
  if (!(await tableExists(queryRunner, tableName))) {
    return false;
  }
  if (await columnExists(queryRunner, tableName, column.name)) {
    return false;
  }
  await queryRunner.addColumn(tableName, new TableColumn(column));
  return true;
}
