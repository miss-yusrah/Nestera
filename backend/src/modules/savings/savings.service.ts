import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { Repository } from 'typeorm';
import { SavingsProduct } from './entities/savings-product.entity';
import {
  UserSubscription,
  SubscriptionStatus,
} from './entities/user-subscription.entity';
import { SavingsGoal, SavingsGoalStatus } from './entities/savings-goal.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { User } from '../user/entities/user.entity';
import { SavingsService as BlockchainSavingsService } from '../blockchain/savings.service';

export interface SavingsGoalProgress {
  id: string;
  userId: string;
  goalName: string;
  targetAmount: number;
  targetDate: Date;
  status: SavingsGoalStatus;
  metadata: SavingsGoal['metadata'];
  createdAt: Date;
  updatedAt: Date;
  currentBalance: number;
  percentageComplete: number;
}

export interface UserSubscriptionWithLiveBalance extends UserSubscription {
  indexedAmount: number;
  liveBalance: number;
  liveBalanceStroops: number;
  balanceSource: 'rpc' | 'cache';
  vaultContractId: string | null;
}

const STROOPS_PER_XLM = 10_000_000;
const POOLS_CACHE_KEY = 'pools_all';

@Injectable()
export class SavingsService {
  private readonly logger = new Logger(SavingsService.name);

  constructor(
    @InjectRepository(SavingsProduct)
    private readonly productRepository: Repository<SavingsProduct>,
    @InjectRepository(UserSubscription)
    private readonly subscriptionRepository: Repository<UserSubscription>,
    @InjectRepository(SavingsGoal)
    private readonly goalRepository: Repository<SavingsGoal>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly blockchainSavingsService: BlockchainSavingsService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async createProduct(dto: CreateProductDto): Promise<SavingsProduct> {
    if (dto.minAmount > dto.maxAmount) {
      throw new BadRequestException(
        'minAmount must be less than or equal to maxAmount',
      );
    }
    const product = this.productRepository.create({
      ...dto,
      isActive: dto.isActive ?? true,
    });
    const savedProduct = await this.productRepository.save(product);
    await this.invalidatePoolsCache();
    return savedProduct;
  }

  async updateProduct(
    id: string,
    dto: UpdateProductDto,
  ): Promise<SavingsProduct> {
    const product = await this.productRepository.findOneBy({ id });
    if (!product) {
      throw new NotFoundException(`Savings product ${id} not found`);
    }
    if (
      dto.minAmount != null &&
      dto.maxAmount != null &&
      dto.minAmount > dto.maxAmount
    ) {
      throw new BadRequestException(
        'minAmount must be less than or equal to maxAmount',
      );
    }
    Object.assign(product, dto);
    const updatedProduct = await this.productRepository.save(product);
    await this.invalidatePoolsCache();
    return updatedProduct;
  }

  async findAllProducts(activeOnly = false): Promise<SavingsProduct[]> {
    return await this.productRepository.find({
      where: activeOnly ? { isActive: true } : undefined,
      order: { createdAt: 'DESC' },
    });
  }

  async findOneProduct(id: string): Promise<SavingsProduct> {
    const product = await this.productRepository.findOneBy({ id });
    if (!product) {
      throw new NotFoundException(`Savings product ${id} not found`);
    }
    return product;
  }

  async findProductWithLiveData(id: string): Promise<{
    product: SavingsProduct;
    totalAssets: number;
  }> {
    const product = await this.findOneProduct(id);

    let totalAssets = 0;

    // Query live contract data if contractId is available
    if (product.contractId) {
      try {
        totalAssets = await this.blockchainSavingsService.getVaultTotalAssets(
          product.contractId,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to fetch live total_assets for contract ${product.contractId}: ${(error as Error).message}`,
        );
        // Continue with totalAssets = 0 if contract query fails
      }
    }

    return { product, totalAssets };
  }

  async subscribe(
    userId: string,
    productId: string,
    amount: number,
  ): Promise<UserSubscription> {
    const product = await this.findOneProduct(productId);
    if (!product.isActive) {
      throw new BadRequestException(
        'This savings product is not available for subscription',
      );
    }
    if (
      amount < Number(product.minAmount) ||
      amount > Number(product.maxAmount)
    ) {
      throw new BadRequestException(
        `Amount must be between ${product.minAmount} and ${product.maxAmount}`,
      );
    }

    const subscription = this.subscriptionRepository.create({
      userId,
      productId: product.id,
      amount,
      status: SubscriptionStatus.ACTIVE,
      startDate: new Date(),
      endDate: product.tenureMonths
        ? (() => {
            const d = new Date();
            d.setMonth(d.getMonth() + product.tenureMonths);
            return d;
          })()
        : null,
    });
    return await this.subscriptionRepository.save(subscription);
  }

  async findMySubscriptions(
    userId: string,
  ): Promise<UserSubscriptionWithLiveBalance[]> {
    const [subscriptions, user] = await Promise.all([
      this.subscriptionRepository.find({
        where: { userId },
        order: { createdAt: 'DESC' },
      }),
      this.userRepository.findOne({
        where: { id: userId },
        select: ['id', 'publicKey'],
      }),
    ]);

    if (!subscriptions.length) {
      return [];
    }

    if (!user?.publicKey) {
      return subscriptions.map((subscription) =>
        this.mapSubscriptionWithLiveBalance(
          subscription,
          Number(subscription.amount),
          Math.round(Number(subscription.amount) * STROOPS_PER_XLM),
          'cache',
          null,
        ),
      );
    }

    const userPublicKey = user.publicKey;

    const defaultVaultContractId =
      this.configService.get<string>('stellar.contractId') || null;

    return await Promise.all(
      subscriptions.map(async (subscription) => {
        const fallbackAmount = Number(subscription.amount);
        const vaultContractId =
          this.resolveVaultContractId(subscription) ?? defaultVaultContractId;

        if (!vaultContractId) {
          return this.mapSubscriptionWithLiveBalance(
            subscription,
            fallbackAmount,
            Math.round(fallbackAmount * STROOPS_PER_XLM),
            'cache',
            null,
          );
        }

        const liveBalanceStroops =
          await this.blockchainSavingsService.getUserVaultBalance(
            vaultContractId,
            userPublicKey,
          );

        return this.mapSubscriptionWithLiveBalance(
          subscription,
          this.stroopsToDecimal(liveBalanceStroops),
          liveBalanceStroops,
          'rpc',
          vaultContractId,
        );
      }),
    );
  }

  async invalidatePoolsCache(): Promise<void> {
    await this.cacheManager.del(POOLS_CACHE_KEY);
    this.logger.log(
      `Invalidated savings products cache key: ${POOLS_CACHE_KEY}`,
    );
  }

  async findMyGoals(userId: string): Promise<SavingsGoalProgress[]> {
    const [goals, user] = await Promise.all([
      this.goalRepository.find({
        where: { userId },
        order: { createdAt: 'DESC' },
      }),
      this.userRepository.findOne({
        where: { id: userId },
        select: ['id', 'publicKey'],
      }),
    ]);

    if (!goals.length) {
      return [];
    }

    const liveVaultBalanceStroops = user?.publicKey
      ? (
          await this.blockchainSavingsService.getUserSavingsBalance(
            user.publicKey,
          )
        ).total
      : 0;

    return goals.map((goal) =>
      this.mapGoalWithProgress(goal, liveVaultBalanceStroops),
    );
  }

  async createGoal(
    userId: string,
    goalName: string,
    targetAmount: number,
    targetDate: Date,
    metadata?: any,
  ): Promise<SavingsGoal> {
    const goal = this.goalRepository.create({
      userId,
      goalName,
      targetAmount,
      targetDate,
      metadata: metadata || null,
    });

    return await this.goalRepository.save(goal);
  }

  async updateGoal(
    goalId: string,
    userId: string,
    updates: {
      goalName?: string;
      targetAmount?: number;
      targetDate?: Date;
      status?: any;
      metadata?: any;
    },
  ): Promise<SavingsGoal> {
    const goal = await this.goalRepository.findOne({
      where: { id: goalId, userId },
    });

    if (!goal) {
      throw new NotFoundException(
        `Savings goal ${goalId} not found or does not belong to user`,
      );
    }

    Object.assign(goal, updates);
    return await this.goalRepository.save(goal);
  }

  async deleteGoal(goalId: string, userId: string): Promise<void> {
    const goal = await this.goalRepository.findOne({
      where: { id: goalId, userId },
    });

    if (!goal) {
      throw new NotFoundException(
        `Savings goal ${goalId} not found or does not belong to user`,
      );
    }

    await this.goalRepository.remove(goal);
  }

  private mapGoalWithProgress(
    goal: SavingsGoal,
    liveVaultBalanceStroops: number,
  ): SavingsGoalProgress {
    const targetAmount = Number(goal.targetAmount);
    const currentBalance = this.stroopsToDecimal(liveVaultBalanceStroops);
    const percentageComplete = this.calculatePercentageComplete(
      liveVaultBalanceStroops,
      targetAmount,
    );

    return {
      id: goal.id,
      userId: goal.userId,
      goalName: goal.goalName,
      targetAmount,
      targetDate: goal.targetDate,
      status: goal.status,
      metadata: goal.metadata,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
      currentBalance,
      percentageComplete,
    };
  }

  private mapSubscriptionWithLiveBalance(
    subscription: UserSubscription,
    liveBalance: number,
    liveBalanceStroops: number,
    balanceSource: 'rpc' | 'cache',
    vaultContractId: string | null,
  ): UserSubscriptionWithLiveBalance {
    return {
      ...subscription,
      indexedAmount: Number(subscription.amount),
      liveBalance,
      liveBalanceStroops,
      balanceSource,
      vaultContractId,
    };
  }

  private resolveVaultContractId(
    subscription: UserSubscription,
  ): string | null {
    const candidates = [
      (subscription as UserSubscription & { contractId?: unknown }).contractId,
      (
        subscription.product as SavingsProduct & {
          contractId?: unknown;
          vaultContractId?: unknown;
        }
      )?.contractId,
      (
        subscription.product as SavingsProduct & {
          contractId?: unknown;
          vaultContractId?: unknown;
        }
      )?.vaultContractId,
    ];

    const contractId = candidates.find(
      (candidate): candidate is string =>
        typeof candidate === 'string' && candidate.trim().length > 0,
    );

    return contractId ?? null;
  }

  private calculatePercentageComplete(
    liveVaultBalanceStroops: number,
    targetAmount: number,
  ): number {
    if (targetAmount <= 0) {
      return 0;
    }

    const targetAmountStroops = Math.round(targetAmount * STROOPS_PER_XLM);
    if (targetAmountStroops <= 0) {
      return 0;
    }

    const percentage = (liveVaultBalanceStroops / targetAmountStroops) * 100;

    return Math.max(0, Math.min(100, Math.round(percentage)));
  }

  private stroopsToDecimal(amountInStroops: number): number {
    return Number((amountInStroops / STROOPS_PER_XLM).toFixed(2));
  }
}
