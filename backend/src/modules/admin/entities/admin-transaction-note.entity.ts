import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Transaction } from '../../transactions/entities/transaction.entity';

@Entity('admin_transaction_notes')
export class AdminTransactionNote extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_admin_notes_transaction_id')
  @Column('uuid')
  transactionId: string;

  @ManyToOne(() => Transaction, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transactionId' })
  transaction?: Transaction;

  @Column('uuid')
  adminId: string;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn()
  createdAt: Date;
}
