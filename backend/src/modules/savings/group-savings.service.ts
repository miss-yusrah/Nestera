import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  GroupSavingsPool,
  PoolStatus,
} from './entities/group-savings-pool.entity';
import {
  GroupPoolMember,
  MemberRole,
  MemberStatus,
} from './entities/group-pool-member.entity';
import {
  SavingsGroupActivity,
  SavingsGroupActivityType,
} from './entities/savings-group-activity.entity';
import { CreateSavingsGroupDto } from './dto/create-savings-group.dto';
import { ContributeSavingsGroupDto } from './dto/contribute-savings-group.dto';
import { InviteMemberDto } from './dto/invite-member.dto';

@Injectable()
export class GroupSavingsService {
  constructor(
    @InjectRepository(GroupSavingsPool)
    private readonly groupRepository: Repository<GroupSavingsPool>,
    @InjectRepository(GroupPoolMember)
    private readonly memberRepository: Repository<GroupPoolMember>,
    @InjectRepository(SavingsGroupActivity)
    private readonly activityRepository: Repository<SavingsGroupActivity>,
    private readonly dataSource: DataSource,
  ) {}

  async createGroup(
    creatorId: string,
    dto: CreateSavingsGroupDto,
  ): Promise<GroupSavingsPool> {
    return await this.dataSource.transaction(async (manager) => {
      const group = manager.create(GroupSavingsPool, {
        ...dto,
        creatorId,
        currentBalance: 0,
        totalDeposits: 0,
        status: PoolStatus.ACTIVE,
      });
      const savedGroup = await manager.save(group);

      const member = manager.create(GroupPoolMember, {
        poolId: savedGroup.id,
        userId: creatorId,
        role: MemberRole.OWNER,
        walletAddress: dto.multisigAddress, // For creator, we use pool multisig as primary or their wallet
        status: MemberStatus.ACTIVE,
        totalContributed: 0,
        sharePercentage: 100,
        joinedAt: new Date(),
      });
      await manager.save(member);

      const activity = manager.create(SavingsGroupActivity, {
        groupId: savedGroup.id,
        userId: creatorId,
        type: SavingsGroupActivityType.CREATED,
        metadata: { name: savedGroup.name },
      });
      await manager.save(activity);

      return savedGroup;
    });
  }

  async joinGroup(userId: string, groupId: string): Promise<GroupPoolMember> {
    const group = await this.groupRepository.findOneBy({ id: groupId });
    if (!group) throw new NotFoundException('Savings group pool not found');
    if (group.status !== PoolStatus.ACTIVE) {
      throw new BadRequestException('Group pool is not active for joining');
    }

    const existingMember = await this.memberRepository.findOneBy({
      poolId: groupId,
      userId,
    });
    if (existingMember) {
      throw new ConflictException('User is already a member of this pool');
    }

    return await this.dataSource.transaction(async (manager) => {
      const member = manager.create(GroupPoolMember, {
        poolId: groupId,
        userId,
        role: MemberRole.MEMBER,
        status: MemberStatus.ACTIVE,
        totalContributed: 0,
        sharePercentage: 0,
        walletAddress: '', // Should be provided by user in real scenario
        joinedAt: new Date(),
      });
      const savedMember = await manager.save(member);

      const activity = manager.create(SavingsGroupActivity, {
        groupId,
        userId,
        type: SavingsGroupActivityType.JOINED,
      });
      await manager.save(activity);

      return savedMember;
    });
  }

  async inviteMember(
    adminId: string,
    groupId: string,
    dto: InviteMemberDto,
  ): Promise<GroupPoolMember> {
    const group = await this.groupRepository.findOneBy({ id: groupId });
    if (!group) throw new NotFoundException('Savings group pool not found');

    const adminMember = await this.memberRepository.findOneBy({
      poolId: groupId,
      userId: adminId,
    });
    if (
      !adminMember ||
      (adminMember.role !== MemberRole.ADMIN &&
        adminMember.role !== MemberRole.OWNER)
    ) {
      throw new ForbiddenException(
        'Only group admins or owners can invite members',
      );
    }

    const targetUserId = dto.userId;
    const existingMember = await this.memberRepository.findOneBy({
      poolId: groupId,
      userId: targetUserId,
    });
    if (existingMember) {
      throw new ConflictException('User is already a member of this pool');
    }

    return await this.dataSource.transaction(async (manager) => {
      const member = manager.create(GroupPoolMember, {
        poolId: groupId,
        userId: targetUserId,
        role: MemberRole.MEMBER,
        status: MemberStatus.ACTIVE,
        totalContributed: 0,
        sharePercentage: 0,
        walletAddress: '', // To be updated by user on join
        joinedAt: new Date(),
      });
      const savedMember = await manager.save(member);

      const activity = manager.create(SavingsGroupActivity, {
        groupId,
        userId: targetUserId,
        type: SavingsGroupActivityType.INVITED,
        metadata: { invitedBy: adminId },
      });
      await manager.save(activity);

      return savedMember;
    });
  }

  async listMembers(groupId: string): Promise<GroupPoolMember[]> {
    const group = await this.groupRepository.findOneBy({ id: groupId });
    if (!group) throw new NotFoundException('Savings group pool not found');

    return await this.memberRepository.find({
      where: { poolId: groupId },
      relations: ['user'],
      order: { joinedAt: 'ASC' },
    });
  }

  async contribute(
    userId: string,
    groupId: string,
    dto: ContributeSavingsGroupDto,
  ): Promise<GroupSavingsPool> {
    const group = await this.groupRepository.findOneBy({ id: groupId });
    if (!group) throw new NotFoundException('Savings group pool not found');
    if (group.status !== PoolStatus.ACTIVE) {
      throw new BadRequestException(
        'Group pool is not accepting contributions',
      );
    }

    const member = await this.memberRepository.findOneBy({
      poolId: groupId,
      userId,
    });
    if (!member) {
      throw new ForbiddenException('Only pool members can contribute');
    }

    return await this.dataSource.transaction(async (manager) => {
      const amount = Number(dto.amount);

      // Update member contribution
      member.totalContributed = Number(member.totalContributed) + amount;
      await manager.save(member);

      // Update pool total
      group.totalDeposits = Number(group.totalDeposits) + amount;
      group.currentBalance = Number(group.currentBalance) + amount;

      // Check if target reached
      if (
        group.targetAmount &&
        Number(group.currentBalance) >= Number(group.targetAmount)
      ) {
        // Pool logic might differ, but for now we keep it active or mark closed
      }

      const savedGroup = await manager.save(group);

      // Record activity
      const activity = manager.create(SavingsGroupActivity, {
        groupId,
        userId,
        type: SavingsGroupActivityType.CONTRIBUTED,
        amount,
      });
      await manager.save(activity);

      return savedGroup;
    });
  }

  async getActivity(groupId: string): Promise<SavingsGroupActivity[]> {
    const group = await this.groupRepository.findOneBy({ id: groupId });
    if (!group) throw new NotFoundException('Savings group not found');

    return await this.activityRepository.find({
      where: { groupId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async leaveGroup(
    userId: string,
    groupId: string,
  ): Promise<{ success: boolean; refundAmount: number }> {
    const group = await this.groupRepository.findOneBy({ id: groupId });
    if (!group) throw new NotFoundException('Savings group pool not found');

    const member = await this.memberRepository.findOneBy({
      poolId: groupId,
      userId,
    });
    if (!member) throw new NotFoundException('Pool membership not found');

    return await this.dataSource.transaction(async (manager) => {
      const refundAmount = Number(member.totalContributed);

      // Update pool amount
      group.totalDeposits = Number(group.totalDeposits) - refundAmount;
      group.currentBalance = Number(group.currentBalance) - refundAmount;

      await manager.save(group);

      // Record refund activity
      if (refundAmount > 0) {
        const refundActivity = manager.create(SavingsGroupActivity, {
          groupId,
          userId,
          type: SavingsGroupActivityType.REFUNDED,
          amount: refundAmount,
        });
        await manager.save(refundActivity);
      }

      // Record leave activity
      const leaveActivity = manager.create(SavingsGroupActivity, {
        groupId,
        userId,
        type: SavingsGroupActivityType.LEFT,
      });
      await manager.save(leaveActivity);

      // Remove member
      await manager.remove(member);

      return { success: true, refundAmount };
    });
  }
}
