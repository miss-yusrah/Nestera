import { ApiProperty } from '@nestjs/swagger';
import { ProposalCategory } from '../entities/governance-proposal.entity';

export class CategorySuccessRate {
  @ApiProperty({ enum: ProposalCategory })
  category: ProposalCategory;

  @ApiProperty({ description: 'Number of passed proposals' })
  passed: number;

  @ApiProperty({ description: 'Number of failed proposals' })
  failed: number;

  @ApiProperty({ description: 'Percentage of passed proposals' })
  successRate: number;
}

export class ProposalAnalyticsDto {
  @ApiProperty({ description: 'Total number of proposals' })
  totalProposals: number;

  @ApiProperty({ description: 'Total number of passed proposals' })
  passedProposals: number;

  @ApiProperty({ description: 'Percentage of passed proposals' })
  overallSuccessRate: number;

  @ApiProperty({ description: 'Average voting power per proposal' })
  averageVotingPower: string;

  @ApiProperty({ type: [CategorySuccessRate] })
  categoryBreakdown: CategorySuccessRate[];
}
