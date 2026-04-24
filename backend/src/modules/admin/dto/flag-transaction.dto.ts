import { IsBoolean } from 'class-validator';

export class FlagTransactionDto {
  @IsBoolean()
  flagged: boolean;
}
