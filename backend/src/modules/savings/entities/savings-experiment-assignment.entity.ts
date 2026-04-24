import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('savings_experiment_assignments')
@Index(['experimentId', 'userId'], { unique: true })
@Index(['experimentId', 'variantKey'])
export class SavingsExperimentAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  experimentId: string;

  @Column('uuid')
  userId: string;

  @Column()
  variantKey: string;

  @Column({ type: 'timestamp', nullable: true })
  convertedAt: Date | null;

  @Column('decimal', { precision: 14, scale: 2, default: 0 })
  conversionValue: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
