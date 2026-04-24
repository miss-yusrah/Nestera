import { IsIn, IsISO8601, IsOptional } from 'class-validator';

export class TransactionStatsQueryDto {
  @IsIn(['daily', 'weekly', 'monthly'])
  period: 'daily' | 'weekly' | 'monthly';

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;
}
