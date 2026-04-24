import { ApiProperty } from '@nestjs/swagger';

export class TrendDataPoint {
  @ApiProperty({ description: 'The time interval (e.g. 2026-03)' })
  interval: string;

  @ApiProperty({ description: 'Number of proposals created' })
  proposalsCount: number;

  @ApiProperty({ description: 'Number of votes cast' })
  votesCount: number;

  @ApiProperty({ description: 'Total voting power used' })
  totalWeight: string;
}

export class GovernanceTrendDto {
  @ApiProperty({ type: [TrendDataPoint] })
  trends: TrendDataPoint[];
}
