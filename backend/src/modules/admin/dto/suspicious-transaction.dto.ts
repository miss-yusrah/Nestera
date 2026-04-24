import {
  TxStatus,
  TxType,
} from '../../transactions/entities/transaction.entity';

export class SuspiciousTransactionDto {
  id: string;
  userId: string;
  type: TxType;
  amount: string;
  txHash?: string | null;
  status?: TxStatus;
  publicKey: string | null;
  eventId: string | null;
  ledgerSequence: string | null;
  poolId: string | null;
  metadata: Record<string, unknown> | null;
  flagged: boolean;
  category: string | null;
  tags: string[];
  createdAt: Date;
  reasons: string[];
}
