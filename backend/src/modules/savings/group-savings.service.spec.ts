import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { GroupSavingsService } from './group-savings.service';
import {
  GroupSavingsPool,
  PoolStatus,
} from './entities/group-savings-pool.entity';
import {
  GroupPoolMember,
  MemberRole,
} from './entities/group-pool-member.entity';
import {
  SavingsGroupActivity,
  SavingsGroupActivityType,
} from './entities/savings-group-activity.entity';
import { ConflictException, ForbiddenException } from '@nestjs/common';

describe('GroupSavingsService', () => {
  let service: GroupSavingsService;
  let groupRepository: any;
  let memberRepository: any;
  let activityRepository: any;
  let dataSource: any;

  beforeEach(async () => {
    groupRepository = {
      findOneBy: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    memberRepository = {
      findOneBy: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      remove: jest.fn(),
    };
    activityRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };
    dataSource = {
      transaction: jest.fn((cb) =>
        cb({
          create: jest.fn((entity: any, data: any) => data),
          save: jest.fn((data: any) => Promise.resolve(data)),
          remove: jest.fn((data: any) => Promise.resolve(data)),
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupSavingsService,
        {
          provide: getRepositoryToken(GroupSavingsPool),
          useValue: groupRepository,
        },
        {
          provide: getRepositoryToken(GroupPoolMember),
          useValue: memberRepository,
        },
        {
          provide: getRepositoryToken(SavingsGroupActivity),
          useValue: activityRepository,
        },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<GroupSavingsService>(GroupSavingsService);
  });

  describe('createGroup', () => {
    it('should create a group pool and add creator as owner', async () => {
      const dto = {
        name: 'Test Pool',
        targetAmount: 1000,
        productId: 'prod-1',
        multisigAddress: 'G...XYZ',
        requiredSignatures: 2,
        totalSigners: 3,
      };
      const userId = 'user-1';

      const result = await service.createGroup(userId, dto);

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(result.name).toBe('Test Pool');
      expect(result.creatorId).toBe(userId);
    });
  });

  describe('joinGroup', () => {
    it('should allow a user to join an active group pool', async () => {
      const userId = 'user-2';
      const groupId = 'group-1';
      groupRepository.findOneBy.mockResolvedValue({
        id: groupId,
        status: PoolStatus.ACTIVE,
      });
      memberRepository.findOneBy.mockResolvedValue(null);

      const result = await service.joinGroup(userId, groupId);

      expect(result.userId).toBe(userId);
      expect(result.poolId).toBe(groupId);
    });

    it('should throw ConflictException if already a member', async () => {
      groupRepository.findOneBy.mockResolvedValue({
        id: 'group-1',
        status: PoolStatus.ACTIVE,
      });
      memberRepository.findOneBy.mockResolvedValue({ id: 'member-1' });

      await expect(service.joinGroup('user-1', 'group-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('inviteMember', () => {
    it('should allow admin to invite a user', async () => {
      const adminId = 'admin-1';
      const groupId = 'group-1';
      const targetUserId = 'user-3';
      const dto = { userId: targetUserId };

      groupRepository.findOneBy.mockResolvedValue({ id: groupId });
      memberRepository.findOneBy
        .mockResolvedValueOnce({
          id: 'admin-member',
          role: MemberRole.OWNER,
        })
        .mockResolvedValueOnce(null);

      const result = await service.inviteMember(adminId, groupId, dto);

      expect(result.userId).toBe(targetUserId);
      expect(result.role).toBe(MemberRole.MEMBER);
    });

    it('should throw ForbiddenException if non-admin invites', async () => {
      groupRepository.findOneBy.mockResolvedValue({ id: 'group-1' });
      memberRepository.findOneBy.mockResolvedValue({
        id: 'member-1',
        role: MemberRole.MEMBER,
      });

      await expect(
        service.inviteMember('user-1', 'group-1', { userId: 'user-2' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('contribute', () => {
    it('should update group pool and member contribution amounts', async () => {
      const userId = 'user-1';
      const groupId = 'group-1';
      const dto = { amount: 100 };

      groupRepository.findOneBy.mockResolvedValue({
        id: groupId,
        status: PoolStatus.ACTIVE,
        currentBalance: 0,
        targetAmount: 1000,
      });
      memberRepository.findOneBy.mockResolvedValue({
        poolId: groupId,
        userId,
        totalContributed: 0,
      });

      const result = await service.contribute(userId, groupId, dto);

      expect(Number(result.currentBalance)).toBe(100);
    });

    it('should track cumulative contributions correctly', async () => {
      groupRepository.findOneBy.mockResolvedValue({
        id: 'group-1',
        status: PoolStatus.ACTIVE,
        currentBalance: 950,
        targetAmount: 1000,
      });
      memberRepository.findOneBy.mockResolvedValue({
        poolId: 'group-1',
        totalContributed: 200,
      });

      const result = await service.contribute('user-1', 'group-1', {
        amount: 50,
      });

      expect(Number(result.currentBalance)).toBe(1000);
    });
  });

  describe('leaveGroup', () => {
    it('should refund user and remove member from pool', async () => {
      const userId = 'user-1';
      const groupId = 'group-1';
      groupRepository.findOneBy.mockResolvedValue({
        id: groupId,
        currentBalance: 500,
        totalDeposits: 500,
      });
      memberRepository.findOneBy.mockResolvedValue({
        id: 'member-1',
        totalContributed: 100,
      });

      const result = await service.leaveGroup(userId, groupId);

      expect(result.success).toBe(true);
      expect(result.refundAmount).toBe(100);
    });
  });
});
