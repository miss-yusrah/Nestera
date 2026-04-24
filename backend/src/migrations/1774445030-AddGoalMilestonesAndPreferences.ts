import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class AddGoalMilestonesAndPreferences1774445030 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add milestonesSent JSONB to savings_goals
    await queryRunner.query(
      `ALTER TABLE "savings_goals" ADD COLUMN IF NOT EXISTS "milestonesSent" jsonb DEFAULT '{}'::jsonb`,
    );

    // Add milestoneNotifications boolean to notification_preferences
    await queryRunner.query(
      `ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "milestoneNotifications" boolean DEFAULT true`,
    );

    // Create goal_milestone_events table for analytics/tracking
    await queryRunner.createTable(
      new Table({
        name: 'goal_milestone_events',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'goalId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'percentage',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'occurredAt',
            type: 'timestamp',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // Add new enum values for notifications.type if they don't exist
    // Note: altering enum types can fail on older PG versions; we ignore errors
    try {
      await queryRunner.query(
        `ALTER TYPE "notifications_type_enum" ADD VALUE 'GOAL_MILESTONE'`,
      );
    } catch (e) {
      // ignore
    }

    try {
      await queryRunner.query(
        `ALTER TYPE "notifications_type_enum" ADD VALUE 'GOAL_COMPLETED'`,
      );
    } catch (e) {
      // ignore
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove added columns and table. Note: we do not remove enum values as it's non-trivial.
    await queryRunner.query(
      `ALTER TABLE "savings_goals" DROP COLUMN IF EXISTS "milestonesSent"`,
    );

    await queryRunner.query(
      `ALTER TABLE "notification_preferences" DROP COLUMN IF EXISTS "milestoneNotifications"`,
    );

    await queryRunner.query(`DROP TABLE IF EXISTS "goal_milestone_events"`);
  }
}
