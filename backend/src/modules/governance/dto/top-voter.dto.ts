import { ApiProperty } from '@nestjs/swagger';

export class TopVoterDto {
  @ApiProperty({ description: 'The wallet address of the voter' })
  walletAddress: string;

  @ApiProperty({ description: 'Number of unique proposals voted on' })
  voteCount: number;

  @ApiProperty({ description: 'Total voting power used across all proposals' })
  totalWeight: string;

  @ApiProperty({ description: 'Rank of the voter based on activity' })
  rank: number;
}
