import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DelegationResponseDto } from './dto/delegation-response.dto';
import { VotingPowerResponseDto } from './dto/voting-power-response.dto';
import { DelegateVoteDto } from './dto/delegate-vote.dto';
import { GovernanceService } from './governance.service';

@ApiTags('governance')
@ApiBearerAuth()
@Controller('user')
@UseGuards(JwtAuthGuard)
export class GovernanceController {
  constructor(private readonly governanceService: GovernanceService) {}

  @Get('delegation')
  @ApiOperation({
    summary: 'Get the authenticated user delegation target',
    description:
      'Reads the Soroban governance contract mapping for the authenticated user and returns the delegated wallet address when present.',
  })
  @ApiResponse({
    status: 200,
    description: 'Delegation lookup result',
    type: DelegationResponseDto,
  })
  getDelegation(
    @CurrentUser() user: { id: string },
  ): Promise<DelegationResponseDto> {
    return this.governanceService.getUserDelegation(user.id);
  }

  @Post('delegation')
  @ApiOperation({
    summary: 'Delegate voting power to another address',
    description: 'Updates the Soroban governance contract to delegate the user\'s voting power to another Stellar address.',
  })
  @ApiResponse({
    status: 200,
    description: 'Delegation updated successfully',
    schema: {
      type: 'object',
      properties: {
        transactionHash: { type: 'string' },
      },
    },
  })
  delegate(
    @CurrentUser() user: { id: string },
    @Body() delegateVoteDto: DelegateVoteDto,
  ): Promise<{ transactionHash: string }> {
    return this.governanceService.delegateVotingPower(user.id, delegateVoteDto.delegateAddress);
  }

  @Get('voting-power')
  @ApiOperation({
    summary: 'Get the authenticated user voting power',
    description:
      'Returns the current NST token balance for the authenticated user, representing their voting power in the governance system.',
  })
  @ApiResponse({
    status: 200,
    description: 'Voting power lookup result',
    type: VotingPowerResponseDto,
  })
  getVotingPower(
    @CurrentUser() user: { id: string },
  ): Promise<VotingPowerResponseDto> {
    return this.governanceService.getUserVotingPower(user.id);
  }
}

