import { ApiProperty } from '@nestjs/swagger';

export class ParticipationStatsDto {
  @ApiProperty({ description: 'Total number of unique voters' })
  totalUniqueVoters: number;

  @ApiProperty({ description: 'Average number of voters per proposal' })
  averageVotersPerProposal: number;

  @ApiProperty({ description: 'Percentage of proposals that reached quorum' })
  quorumAchievementRate: number;

  @ApiProperty({ description: 'Total votes cast across all proposals' })
  totalVotesCast: number;

  @ApiProperty({ description: 'Current active voters (voted in last 30 days)' })
  activeVoters: number;
}
