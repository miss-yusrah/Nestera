import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type WaitlistEventType = 'JOIN' | 'NOTIFY' | 'ACCEPT';

@Entity('waitlist_events')
export class WaitlistEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid', { nullable: true })
  entryId: string | null;

  @Index()
  @Column('uuid')
  userId: string;

  @Index()
  @Column('uuid')
  productId: string;

  @Column('varchar')
  type: WaitlistEventType;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;
}
