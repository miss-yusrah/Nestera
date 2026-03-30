import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { EditProposalDto } from './dto/edit-proposal.dto';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CastVoteDto } from './dto/cast-vote.dto';
import { ProposalListItemDto } from './dto/proposal-list-item.dto';
import { ProposalResponseDto } from './dto/proposal-response.dto';
import { ProposalVotesResponseDto } from './dto/proposal-votes-response.dto';
import { ProposalStatus } from './entities/governance-proposal.entity';
import { GovernanceService } from './governance.service';

@ApiTags('governance')
@Controller('governance/proposals')
export class GovernanceProposalsController {
  constructor(private readonly governanceService: GovernanceService) {}

  @Post('create')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a governance proposal',
    description:
      'Creates a structured governance proposal with validation, voting-power threshold checks, supporting attachments, and quorum calculation.',
  })
  @ApiResponse({
    status: 201,
    description: 'Governance proposal created successfully',
    type: ProposalResponseDto,
  })
  createProposal(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateProposalDto,
  ): Promise<ProposalResponseDto> {
    return this.governanceService.createProposal(user.id, dto);
  }

  @Post(':id/edit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Edit a governance proposal before voting starts',
    description:
      'Allows the proposal creator to update structured proposal details before the voting window opens.',
  })
  @ApiResponse({
    status: 200,
    description: 'Governance proposal updated successfully',
    type: ProposalResponseDto,
  })
  editProposal(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: EditProposalDto,
  ): Promise<ProposalResponseDto> {
    return this.governanceService.editProposal(user.id, id, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List governance proposals',
    description:
      'Returns indexed proposals from the DB cache, optionally filtered by status.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ProposalStatus,
    description:
      'Filter by proposal status (e.g. ACTIVE, PASSED, FAILED, CANCELLED)',
    example: 'ACTIVE',
  })
  @ApiResponse({
    status: 200,
    description:
      'List of proposals with computed vote percentages and timeline boundaries',
    type: [ProposalListItemDto],
  })
  getProposals(
    @Query('status') statusKey?: string,
  ): Promise<ProposalListItemDto[]> {
    let status: ProposalStatus | undefined;

    if (statusKey !== undefined) {
      // Accept both enum keys (ACTIVE) and enum values (Active)
      const byKey =
        ProposalStatus[statusKey.toUpperCase() as keyof typeof ProposalStatus];
      const byValue = Object.values(ProposalStatus).includes(
        statusKey as ProposalStatus,
      )
        ? (statusKey as ProposalStatus)
        : undefined;
      status = byKey ?? byValue;

      if (!status) {
        throw new BadRequestException(
          `Invalid status "${statusKey}". Valid values: ${Object.keys(ProposalStatus).join(', ')}`,
        );
      }
    }

    return this.governanceService.getProposals(status);
  }

  @Post(':id/vote')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cast a vote on an active proposal',
    description: 'Allows a user to cast a weighted vote (for/against/abstain) on an active proposal. Voting power is calculated based on lifetime deposits.',
  })
  @ApiResponse({
    status: 201,
    description: 'Vote cast successfully, returns transaction receipt',
    schema: {
      type: 'object',
      properties: {
        transactionHash: { type: 'string' },
      },
    },
  })
  castVote(
    @Param('id', ParseIntPipe) id: number,
    @Body() castVoteDto: CastVoteDto,
    @CurrentUser() user: { id: string },
  ): Promise<{ transactionHash: string }> {
    return this.governanceService.castVote(user.id, id, castVoteDto.direction);
  }

  @Get(':id/votes')
  @ApiOperation({
    summary: 'Get proposal vote tally and recent voters',
    description:
      'Returns a proposal vote tally plus the most recent voters for a given proposal onChainId.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Zero-based page index (20 votes per page)',
    example: 0,
  })
  @ApiResponse({
    status: 200,
    description: 'Vote tally and recent voter list for proposal',
    type: ProposalVotesResponseDto,
  })
  getProposalVotes(
    @Param('id', ParseIntPipe) id: number,
    @Query('page', new DefaultValuePipe(0), ParseIntPipe) page: number,
  ): Promise<ProposalVotesResponseDto> {
    return this.governanceService.getProposalVotesByOnChainId(id, page);
  }
}

