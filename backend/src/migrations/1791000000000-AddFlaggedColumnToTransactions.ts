import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFlaggedColumnToTransactions1791000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE transactions ADD COLUMN flagged BOOLEAN NOT NULL DEFAULT FALSE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE transactions DROP COLUMN flagged`);
  }
}
