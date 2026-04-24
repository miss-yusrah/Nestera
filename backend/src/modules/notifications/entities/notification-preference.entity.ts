import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

export enum DigestFrequency {
  INSTANT = 'instant',
  DAILY = 'daily',
  WEEKLY = 'weekly',
}

@Entity('notification_preferences')
@Unique(['userId'])
export class NotificationPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  // ── Channel preferences ──────────────────────────────────────────────────
  @Column({ type: 'boolean', default: true })
  emailNotifications: boolean;

  @Column({ type: 'boolean', default: true })
  inAppNotifications: boolean;

  @Column({ type: 'boolean', default: false })
  pushNotifications: boolean;

  @Column({ type: 'boolean', default: false })
  smsNotifications: boolean;

  // ── Notification type preferences ────────────────────────────────────────
  @Column({ type: 'boolean', default: true })
  depositNotifications: boolean;

  @Column({ type: 'boolean', default: true })
  withdrawalNotifications: boolean;

  @Column({ type: 'boolean', default: true })
  goalNotifications: boolean;

  @Column({ type: 'boolean', default: true })
  governanceNotifications: boolean;

  @Column({ type: 'boolean', default: false })
  marketingNotifications: boolean;

  // Legacy columns kept for backward compatibility
  @Column({ type: 'boolean', default: true })
  sweepNotifications: boolean;

  @Column({ type: 'boolean', default: true })
  claimNotifications: boolean;

  @Column({ type: 'boolean', default: true })
  yieldNotifications: boolean;

  @Column({ type: 'boolean', default: true })
  milestoneNotifications: boolean;

  // ── Quiet hours ──────────────────────────────────────────────────────────
  @Column({ type: 'boolean', default: false })
  quietHoursEnabled: boolean;

  @Column({ type: 'varchar', length: 5, default: '22:00' })
  quietHoursStart: string; // HH:MM

  @Column({ type: 'varchar', length: 5, default: '08:00' })
  quietHoursEnd: string; // HH:MM

  @Column({ type: 'varchar', length: 50, default: 'UTC' })
  timezone: string;

  // ── Digest frequency ─────────────────────────────────────────────────────
  @Column({
    type: 'enum',
    enum: DigestFrequency,
    default: DigestFrequency.INSTANT,
  })
  digestFrequency: DigestFrequency;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
