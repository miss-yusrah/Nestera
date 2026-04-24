import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateSavingsExperimentTables1791200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'savings_experiments',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'key', type: 'varchar', isUnique: true },
          { name: 'name', type: 'varchar' },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'productId', type: 'uuid', isNullable: true },
          { name: 'variants', type: 'jsonb' },
          { name: 'configuration', type: 'jsonb', isNullable: true },
          { name: 'status', type: 'varchar', default: "'DRAFT'" },
          { name: 'minSampleSize', type: 'int', default: 100 },
          {
            name: 'confidenceLevel',
            type: 'decimal',
            precision: 4,
            scale: 2,
            default: 0.95,
          },
          { name: 'startedAt', type: 'timestamp', isNullable: true },
          { name: 'endedAt', type: 'timestamp', isNullable: true },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
          { name: 'updatedAt', type: 'timestamp', default: 'now()' },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'savings_experiment_assignments',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'experimentId', type: 'uuid' },
          { name: 'userId', type: 'uuid' },
          { name: 'variantKey', type: 'varchar' },
          { name: 'convertedAt', type: 'timestamp', isNullable: true },
          {
            name: 'conversionValue',
            type: 'decimal',
            precision: 14,
            scale: 2,
            default: 0,
          },
          { name: 'metadata', type: 'jsonb', isNullable: true },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
          { name: 'updatedAt', type: 'timestamp', default: 'now()' },
        ],
      }),
    );

    await queryRunner.createIndex(
      'savings_experiment_assignments',
      new TableIndex({
        name: 'IDX_savings_experiment_user_unique',
        columnNames: ['experimentId', 'userId'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'savings_experiment_assignments',
      new TableIndex({
        name: 'IDX_savings_experiment_variant',
        columnNames: ['experimentId', 'variantKey'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'savings_experiment_assignments',
      'IDX_savings_experiment_variant',
    );
    await queryRunner.dropIndex(
      'savings_experiment_assignments',
      'IDX_savings_experiment_user_unique',
    );
    await queryRunner.dropTable('savings_experiment_assignments');
    await queryRunner.dropTable('savings_experiments');
  }
}
