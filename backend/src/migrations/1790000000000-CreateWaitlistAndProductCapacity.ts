import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class CreateWaitlistAndProductCapacity1790000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add capacity column to savings_products
    await queryRunner.addColumn(
      'savings_products',
      new TableColumn({
        name: 'capacity',
        type: 'int',
        isNullable: true,
      }),
    );

    // Create waitlist_entries table
    await queryRunner.createTable(
      new Table({
        name: 'waitlist_entries',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'userId', type: 'uuid' },
          { name: 'productId', type: 'uuid' },
          { name: 'priority', type: 'int', default: 0 },
          { name: 'notifiedAt', type: 'timestamp', isNullable: true },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
          { name: 'updatedAt', type: 'timestamp', default: 'now()' },
        ],
      }),
    );

    await queryRunner.createIndex(
      'waitlist_entries',
      new TableIndex({
        name: 'IDX_waitlist_product',
        columnNames: ['productId'],
      }),
    );

    await queryRunner.createIndex(
      'waitlist_entries',
      new TableIndex({ name: 'IDX_waitlist_user', columnNames: ['userId'] }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('waitlist_entries', 'IDX_waitlist_user');
    await queryRunner.dropIndex('waitlist_entries', 'IDX_waitlist_product');
    await queryRunner.dropTable('waitlist_entries');
    await queryRunner.dropColumn('savings_products', 'capacity');
  }
}
