import { TxType } from '../../transactions/entities/transaction.entity';

export class TransactionStatsDto {
  period: string;
  type: TxType;
  count: number;
  totalVolume: string;
  averageAmount: string;
}
