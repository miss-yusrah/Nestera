import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type ExperimentStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';

export interface ExperimentVariant {
  key: string;
  weight: number;
  config: Record<string, any>;
}

@Entity('savings_experiments')
@Index(['status', 'createdAt'])
export class SavingsExperiment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  key: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'uuid', nullable: true })
  productId: string | null;

  @Column({ type: 'jsonb' })
  variants: ExperimentVariant[];

  @Column({ type: 'jsonb', nullable: true })
  configuration: Record<string, any> | null;

  @Column({ type: 'varchar', default: 'DRAFT' })
  status: ExperimentStatus;

  @Column({ type: 'int', default: 100 })
  minSampleSize: number;

  @Column({ type: 'decimal', precision: 4, scale: 2, default: 0.95 })
  confidenceLevel: number;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  endedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
