import { ApiProperty } from '@nestjs/swagger';
import { VoteDirection } from '../entities/vote.entity';

export class VoteResponseDto {
  @ApiProperty({ description: 'Unique vote identifier' })
  id: string;

  @ApiProperty({ description: 'Voter wallet address' })
  walletAddress: string;

  @ApiProperty({
    enum: VoteDirection,
    description: 'Vote direction (FOR or AGAINST)',
  })
  direction: VoteDirection;

  @ApiProperty({ description: 'Vote weight (voting power)' })
  weight: number;

  @ApiProperty({ description: 'Associated proposal ID' })
  proposalId: string;

  @ApiProperty({ description: 'Vote cast timestamp' })
  createdAt: Date;
}
