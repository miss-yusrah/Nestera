import { EventEmitter2 } from '@nestjs/event-emitter';
import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GovernanceService } from './governance.service';
import { UserService } from '../user/user.service';
import { StellarService } from '../blockchain/stellar.service';
import { SavingsService } from '../blockchain/savings.service';
import {
  GovernanceProposal,
  ProposalAttachmentType,
  ProposalCategory,
  ProposalStatus,
  ProposalType,
} from './entities/governance-proposal.entity';
import { Vote, VoteDirection } from './entities/vote.entity';
import { Delegation } from './entities/delegation.entity';
import { TransactionsService } from '../transactions/transactions.service';
import { LedgerTransaction } from '../blockchain/entities/transaction.entity';
import { User } from '../user/entities/user.entity';

describe('GovernanceService', () => {
  let service: GovernanceService;
  let userService: { findById: jest.Mock };
  let stellarService: {
    getDelegationForUser: jest.Mock;
    getRpcServer: jest.Mock;
  };
  let savingsService: { getUserVaultBalance: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let proposalRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    findOneBy: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let voteRepo: {
    count: jest.Mock;
    createQueryBuilder: jest.Mock;
    find: jest.Mock;
    findOneBy: jest.Mock;
    findAndCount: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let userRepo: {
    find: jest.Mock;
  };
  let transactionsService: any;
  let transactionRepo: { createQueryBuilder: jest.Mock };
  let delegationRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    delete: jest.Mock;
    upsert: jest.Mock;
  };

  beforeEach(async () => {
    userService = { findById: jest.fn() };
    stellarService = {
      getDelegationForUser: jest.fn(),
      getRpcServer: jest.fn().mockReturnValue({
        getLatestLedger: jest.fn().mockResolvedValue({ sequence: 1000 }),
      }),
    };
    savingsService = { getUserVaultBalance: jest.fn() };
    eventEmitter = { emit: jest.fn() };
    proposalRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    voteRepo = {
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
      find: jest.fn(),
      findOneBy: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    userRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    transactionsService = {};
    transactionRepo = { createQueryBuilder: jest.fn() };
    delegationRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue(undefined),
      upsert: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GovernanceService,
        { provide: UserService, useValue: userService },
        { provide: StellarService, useValue: stellarService },
        { provide: SavingsService, useValue: savingsService },
        { provide: TransactionsService, useValue: transactionsService },
        { provide: EventEmitter2, useValue: eventEmitter },
        {
          provide: getRepositoryToken(GovernanceProposal),
          useValue: proposalRepo,
        },
        { provide: getRepositoryToken(Vote), useValue: voteRepo },
        {
          provide: getRepositoryToken(LedgerTransaction),
          useValue: transactionRepo,
        },
        {
          provide: getRepositoryToken(Delegation),
          useValue: delegationRepo,
        },
        {
          provide: getRepositoryToken(User),
          useValue: userRepo,
        },
      ],
    }).compile();

    service = module.get<GovernanceService>(GovernanceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when the user has no linked wallet', async () => {
    userService.findById.mockResolvedValue({ id: 'user-1', publicKey: null });

    await expect(service.getUserDelegation('user-1')).resolves.toEqual({
      delegate: null,
    });
    expect(stellarService.getDelegationForUser).not.toHaveBeenCalled();
  });

  it('returns null when no delegation exists on-chain', async () => {
    userService.findById.mockResolvedValue({
      id: 'user-1',
      publicKey: 'GUSERPUBLICKEY123',
    });
    stellarService.getDelegationForUser.mockResolvedValue(null);

    await expect(service.getUserDelegation('user-1')).resolves.toEqual({
      delegate: null,
    });
  });

  it('returns the delegated wallet address when present', async () => {
    userService.findById.mockResolvedValue({
      id: 'user-1',
      publicKey: 'GUSERPUBLICKEY123',
    });
    stellarService.getDelegationForUser.mockResolvedValue('GDELEGATE123');

    await expect(service.getUserDelegation('user-1')).resolves.toEqual({
      delegate: 'GDELEGATE123',
    });
  });

  describe('createProposal', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
      process.env = {
        ...OLD_ENV,
        NST_GOVERNANCE_CONTRACT_ID: 'CONTRACT123',
        GOVERNANCE_PROPOSAL_THRESHOLD: '100',
        GOVERNANCE_QUORUM_BPS: '5000',
        GOVERNANCE_MAX_VOTING_POWER: '10000',
        GOVERNANCE_START_DELAY_LEDGERS: '100',
        GOVERNANCE_VOTING_PERIOD_LEDGERS: '500',
      };
    });

    afterEach(() => {
      process.env = OLD_ENV;
    });

    it('creates a structured governance proposal and emits an event', async () => {
      userService.findById.mockResolvedValue({
        id: 'user-1',
        publicKey: 'GUSERPUBLICKEY123',
      });
      savingsService.getUserVaultBalance.mockResolvedValue(2_000_000_000);
      userRepo.find.mockResolvedValue([{ id: 'user-1' }]);
      proposalRepo.findOne.mockResolvedValue({ onChainId: 7 });
      proposalRepo.create.mockImplementation((input) => ({
        id: 'proposal-1',
        createdAt: new Date('2026-03-30T12:00:00.000Z'),
        updatedAt: new Date('2026-03-30T12:00:00.000Z'),
        ...input,
      }));
      proposalRepo.save.mockImplementation(async (proposal) => proposal);

      const result = await service.createProposal('user-1', {
        description: 'Increase flexi rate',
        type: ProposalType.RATE_CHANGE,
        action: {
          target: 'flexiRate',
          newValue: 12,
        },
        attachments: [
          {
            name: 'Model',
            url: 'https://example.com/model.pdf',
            type: ProposalAttachmentType.DOCUMENT,
          },
        ],
      });

      expect(proposalRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          onChainId: 8,
          proposer: 'GUSERPUBLICKEY123',
          createdByUserId: 'user-1',
          category: ProposalCategory.TECHNICAL,
          type: ProposalType.RATE_CHANGE,
          action: {
            target: 'flexiRate',
            newValue: 12,
          },
          attachments: [
            {
              name: 'Model',
              url: 'https://example.com/model.pdf',
              type: ProposalAttachmentType.DOCUMENT,
            },
          ],
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'governance.proposal.created',
        expect.objectContaining({
          proposalId: 'proposal-1',
          onChainId: 8,
          proposer: 'GUSERPUBLICKEY123',
          type: ProposalType.RATE_CHANGE,
        }),
      );
      expect(result.requiredQuorum).toBe('100.00000000');
      expect(result.proposalThreshold).toBe('100.00000000');
      expect(result.canEdit).toBe(true);
    });

    it('rejects proposal creation when user is below the voting-power threshold', async () => {
      userService.findById.mockResolvedValue({
        id: 'user-1',
        publicKey: 'GUSERPUBLICKEY123',
      });
      savingsService.getUserVaultBalance.mockResolvedValue(500_000_000);

      await expect(
        service.createProposal('user-1', {
          description: 'Pause the contract',
          type: ProposalType.PAUSE,
          action: { reason: 'Emergency maintenance' },
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('editProposal', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
      process.env = {
        ...OLD_ENV,
        NST_GOVERNANCE_CONTRACT_ID: 'CONTRACT123',
      };
    });

    afterEach(() => {
      process.env = OLD_ENV;
    });

    it('allows the creator to edit a proposal before voting starts', async () => {
      proposalRepo.findOneBy.mockResolvedValue({
        id: 'proposal-1',
        onChainId: 5,
        title: 'Allocate treasury',
        description: 'Old description',
        category: ProposalCategory.TREASURY,
        type: ProposalType.TREASURY_ALLOCATION,
        action: {
          recipient: 'GOLDRECIPIENT',
          amount: 1000,
          asset: 'NST',
        },
        attachments: [],
        proposer: 'GUSERPUBLICKEY123',
        createdByUserId: 'user-1',
        startBlock: 1400,
        endBlock: 1900,
        status: ProposalStatus.ACTIVE,
        requiredQuorum: '5000.00000000',
        quorumBps: 5000,
        proposalThreshold: '100.00000000',
        createdAt: new Date('2026-03-29T12:00:00.000Z'),
        updatedAt: new Date('2026-03-29T12:00:00.000Z'),
      });
      voteRepo.count.mockResolvedValue(0);
      proposalRepo.save.mockImplementation(async (proposal) => ({
        ...proposal,
        updatedAt: new Date('2026-03-30T12:00:00.000Z'),
      }));

      const result = await service.editProposal('user-1', 'proposal-1', {
        description: 'Allocate additional funds',
        action: {
          recipient: 'GNEWRECIPIENT',
          amount: 2500,
          asset: 'USDC',
        },
        attachments: [
          {
            name: 'Budget',
            url: 'https://example.com/budget',
            type: ProposalAttachmentType.LINK,
          },
        ],
        startBlock: 1500,
        endBlock: 2100,
      });

      expect(proposalRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Allocate additional funds',
          action: {
            recipient: 'GNEWRECIPIENT',
            amount: 2500,
            asset: 'USDC',
          },
          attachments: [
            {
              name: 'Budget',
              url: 'https://example.com/budget',
              type: ProposalAttachmentType.LINK,
            },
          ],
          startBlock: 1500,
          endBlock: 2100,
        }),
      );
      expect(result.canEdit).toBe(true);
    });

    it('rejects edits from non-creators', async () => {
      proposalRepo.findOneBy.mockResolvedValue({
        id: 'proposal-1',
        createdByUserId: 'someone-else',
      });

      await expect(
        service.editProposal('user-1', 'proposal-1', {
          description: 'New description',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('getProposalVotesByOnChainId', () => {
    it('returns recent votes and tallies', async () => {
      proposalRepo.findOneBy.mockResolvedValue({
        id: 'proposal-1',
        onChainId: 3,
      });
      voteRepo.findAndCount.mockResolvedValue([
        [
          {
            walletAddress: 'GWALLET1',
            direction: VoteDirection.FOR,
            weight: 30,
            createdAt: new Date('2026-03-30T10:00:00.000Z'),
          },
          {
            walletAddress: 'GWALLET2',
            direction: VoteDirection.AGAINST,
            weight: 20,
            createdAt: new Date('2026-03-30T11:00:00.000Z'),
          },
        ],
        2,
      ]);

      const result = await service.getProposalVotesByOnChainId(3, 0);

      expect(result.tally.forVotes).toBe(1);
      expect(result.tally.againstVotes).toBe(1);
      expect(result.tally.totalWeight).toBe('50');
      expect(result.recentVoters).toHaveLength(2);
    });
  });

  describe('castVote', () => {
    it('throws BadRequestException if user has no publicKey', async () => {
      userService.findById.mockResolvedValue({ id: 'user-1', publicKey: null });

      await expect(service.castVote('user-1', 1, 'FOR' as any)).rejects.toThrow(
        'User must have a public key to vote',
      );
    });

    it('throws NotFoundException if proposal not found', async () => {
      userService.findById.mockResolvedValue({
        id: 'user-1',
        publicKey: 'PK1',
      });
      proposalRepo.findOneBy.mockResolvedValue(null);

      await expect(service.castVote('user-1', 1, 'FOR' as any)).rejects.toThrow(
        'Proposal 1 not found',
      );
    });

    it('throws BadRequestException if already voted', async () => {
      userService.findById.mockResolvedValue({
        id: 'user-1',
        publicKey: 'PK1',
      });
      proposalRepo.findOneBy.mockResolvedValue({
        id: 'p1',
        onChainId: 1,
        status: 'Active',
      });
      voteRepo.findOneBy.mockResolvedValue({ id: 'v1' });

      await expect(service.castVote('user-1', 1, 'FOR' as any)).rejects.toThrow(
        'User has already voted on this proposal',
      );
    });
  });

  describe('delegateVotingPower', () => {
    it('returns a mock transaction hash', async () => {
      userService.findById.mockResolvedValue({
        id: 'user-1',
        publicKey: 'PK1',
      });

      const result = await service.delegateVotingPower('user-1', 'DELEGATE_PK');
      expect(result.transactionHash).toBeDefined();
      expect(result.transactionHash).toMatch(/^0x/);
    });
  });

  describe('delegate (loop detection)', () => {
    it('rejects delegation to self', async () => {
      userService.findById.mockResolvedValue({
        id: 'user-1',
        publicKey: 'GUSERPUBLICKEY123',
      });

      await expect(
        service.delegate('user-1', 'GUSERPUBLICKEY123'),
      ).rejects.toThrow('Cannot delegate to yourself');
    });

    it('rejects direct loop (A→B→A)', async () => {
      userService.findById.mockResolvedValue({
        id: 'user-1',
        publicKey: 'GA',
      });
      // Simulate that GA already delegates to GB
      delegationRepo.findOne.mockImplementation(({ where }) => {
        if (where.delegatorAddress === 'GA') {
          return Promise.resolve({
            delegatorAddress: 'GA',
            delegateAddress: 'GB',
          });
        }
        if (where.delegatorAddress === 'GB' && where.delegateAddress === 'GA') {
          return Promise.resolve({
            delegatorAddress: 'GB',
            delegateAddress: 'GA',
          });
        }
        return Promise.resolve(null);
      });

      // Try to delegate from GB to GA (would create loop)
      userService.findById.mockResolvedValue({
        id: 'user-2',
        publicKey: 'GB',
      });
      await expect(service.delegate('user-2', 'GA')).rejects.toThrow(
        'Delegation loop detected in chain',
      );
    });

    it('rejects long chain loop (A→B→C→A)', async () => {
      // User A delegates to B
      userService.findById.mockResolvedValue({
        id: 'user-a',
        publicKey: 'GA',
      });
      delegationRepo.findOne.mockImplementation(({ where }) => {
        if (where.delegatorAddress === 'GA') {
          return Promise.resolve({
            delegatorAddress: 'GA',
            delegateAddress: 'GB',
          });
        }
        if (where.delegatorAddress === 'GB') {
          return Promise.resolve({
            delegatorAddress: 'GB',
            delegateAddress: 'GC',
          });
        }
        if (where.delegatorAddress === 'GC') {
          return Promise.resolve({
            delegatorAddress: 'GC',
            delegateAddress: 'GA',
          });
        }
        return Promise.resolve(null);
      });

      // Try to delegate from GC to GA (would create A→B→C→A loop)
      userService.findById.mockResolvedValue({
        id: 'user-c',
        publicKey: 'GC',
      });
      await expect(service.delegate('user-c', 'GA')).rejects.toThrow(
        'Delegation loop detected in chain',
      );
    });

    it('rejects delegation exceeding max chain depth', async () => {
      userService.findById.mockResolvedValue({
        id: 'user-1',
        publicKey: 'GF',
      });
      // Simulate a chain of 5 delegations (A→B→C→D→E→F)
      delegationRepo.findOne.mockImplementation(({ where }) => {
        const chains: Record<string, string> = {
          GA: 'GB',
          GB: 'GC',
          GC: 'GD',
          GD: 'GE',
          GE: 'GF',
        };
        const delegate = chains[where.delegatorAddress as string];
        if (delegate) {
          return Promise.resolve({
            delegatorAddress: where.delegatorAddress,
            delegateAddress: delegate,
          });
        }
        return Promise.resolve(null);
      });
      delegationRepo.find.mockImplementation(({ where }) => {
        const incoming: Record<string, string[]> = {
          GB: ['GA'],
          GC: ['GB'],
          GD: ['GC'],
          GE: ['GD'],
          GF: ['GE'],
        };
        return Promise.resolve(
          (incoming[where.delegateAddress as string] ?? []).map(
            (delegatorAddress) => ({
              delegatorAddress,
              delegateAddress: where.delegateAddress,
            }),
          ),
        );
      });

      // Try to delegate from GF to GG (would be 6th level)
      await expect(service.delegate('user-f', 'GG')).rejects.toThrow(
        'Delegation chain would exceed maximum depth of 5',
      );
    });

    it('allows valid delegation with no loop and within depth limit', async () => {
      userService.findById.mockResolvedValue({
        id: 'user-1',
        publicKey: 'GA',
      });
      delegationRepo.findOne.mockResolvedValue(null);
      delegationRepo.upsert.mockResolvedValue(undefined);
      eventEmitter.emit.mockClear();

      const result = await service.delegate('user-1', 'GB');

      expect(result.transactionHash).toBeDefined();
      expect(delegationRepo.upsert).toHaveBeenCalledWith(
        { delegatorAddress: 'GA', delegateAddress: 'GB' },
        ['delegatorAddress'],
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'governance.delegation.changed',
        { delegator: 'GA', delegate: 'GB' },
      );
    });
  });

  describe('getDelegationChain', () => {
    it('returns empty chain for user with no delegation', async () => {
      userService.findById.mockResolvedValue({
        id: 'user-1',
        publicKey: 'GA',
      });
      delegationRepo.findOne.mockResolvedValue(null);

      const result = await service.getDelegationChain('user-1');

      expect(result).toEqual({ chain: [], depth: 0, hasLoop: false });
    });

    it('returns delegation chain with depth and loop detection', async () => {
      userService.findById.mockResolvedValue({
        id: 'user-1',
        publicKey: 'GA',
      });
      delegationRepo.findOne.mockImplementation(({ where }) => {
        if (where.delegatorAddress === 'GA') {
          return Promise.resolve({
            delegatorAddress: 'GA',
            delegateAddress: 'GB',
          });
        }
        if (where.delegatorAddress === 'GB') {
          return Promise.resolve({
            delegatorAddress: 'GB',
            delegateAddress: 'GC',
          });
        }
        return Promise.resolve(null);
      });

      const result = await service.getDelegationChain('user-1');

      expect(result.chain).toEqual(['GB', 'GC']);
      expect(result.depth).toBe(2);
      expect(result.hasLoop).toBe(false);
    });

    it('detects loop in delegation chain', async () => {
      userService.findById.mockResolvedValue({
        id: 'user-1',
        publicKey: 'GA',
      });
      delegationRepo.findOne.mockImplementation(({ where }) => {
        if (where.delegatorAddress === 'GA') {
          return Promise.resolve({
            delegatorAddress: 'GA',
            delegateAddress: 'GB',
          });
        }
        if (where.delegatorAddress === 'GB') {
          return Promise.resolve({
            delegatorAddress: 'GB',
            delegateAddress: 'GA',
          });
        }
        return Promise.resolve(null);
      });

      const result = await service.getDelegationChain('user-1');

      expect(result.chain).toEqual(['GB', 'GA']);
      expect(result.depth).toBe(2);
      expect(result.hasLoop).toBe(true);
    });
  });
});
