import { ApiProperty } from '@nestjs/swagger';

export class VotingPowerBreakdownDto {
  @ApiProperty({
    description: "User's own voting power (not delegated to others)",
    example: 10000,
  })
  ownPower: number;

  @ApiProperty({
    description: 'Voting power delegated to others',
    example: 5000,
  })
  delegatedToOthers: number;

  @ApiProperty({
    description: 'Voting power delegated from others to this user',
    example: 2500,
  })
  delegatedFromOthers: number;
}

export class VotingPowerResponseDto {
  @ApiProperty({
    description: "The user's voting power as a formatted string",
    example: '12,500 NST',
  })
  votingPower: string;

  @ApiProperty({
    description: 'Breakdown of voting power components',
    type: VotingPowerBreakdownDto,
    required: false,
  })
  breakdown?: VotingPowerBreakdownDto;
}
