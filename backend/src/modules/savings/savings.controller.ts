import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  Param,
} from '@nestjs/common';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SavingsService } from './savings.service';
import { SavingsProduct } from './entities/savings-product.entity';
import { UserSubscription } from './entities/user-subscription.entity';
import { SubscribeDto } from './dto/subscribe.dto';
import { ProductDetailsDto } from './dto/product-details.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  SavingsGoalProgress,
  UserSubscriptionWithLiveBalance,
} from './savings.service';

@ApiTags('savings')
@Controller('savings')
export class SavingsController {
  constructor(private readonly savingsService: SavingsService) {}

  @Get('products')
  @UseInterceptors(CacheInterceptor)
  @CacheKey('pools_all')
  @CacheTTL(60000)
  @ApiOperation({ summary: 'List all savings products' })
  @ApiResponse({ status: 200, description: 'List of savings products' })
  async getProducts(): Promise<SavingsProduct[]> {
    return await this.savingsService.findAllProducts(true);
  }

  @Get('products/:id')
  @Throttle({ rpc: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: 'Get detailed product information with live contract data',
    description:
      'Retrieve a single savings product by ID with live total_assets from the Soroban vault contract',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Product UUID',
  })
  @ApiResponse({
    status: 200,
    description: 'Product details with live contract data',
    type: ProductDetailsDto,
  })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  @ApiResponse({
    status: 503,
    description: 'Soroban RPC service unavailable',
  })
  @ApiResponse({
    status: 504,
    description: 'Soroban RPC request timeout',
  })
  async getProductDetails(@Param('id') id: string): Promise<ProductDetailsDto> {
    const { product, totalAssets } =
      await this.savingsService.findProductWithLiveData(id);

    const totalAssetsXlm = totalAssets / 10_000_000;

    return {
      id: product.id,
      name: product.name,
      type: product.type,
      description: product.description,
      interestRate: product.interestRate,
      minAmount: product.minAmount,
      maxAmount: product.maxAmount,
      tenureMonths: product.tenureMonths,
      isActive: product.isActive,
      contractId: product.contractId,
      totalAssets,
      totalAssetsXlm,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Subscribe to a savings product' })
  @ApiBody({ type: SubscribeDto })
  @ApiResponse({
    status: 201,
    description: 'Subscription created',
    type: UserSubscription,
  })
  @ApiResponse({ status: 400, description: 'Invalid product or amount' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async subscribe(
    @Body() dto: SubscribeDto,
    @CurrentUser() user: { id: string; email: string },
  ): Promise<UserSubscription> {
    return await this.savingsService.subscribe(
      user.id,
      dto.productId,
      dto.amount,
    );
  }

  @Get('my-subscriptions')
  @Throttle({ rpc: { limit: 10, ttl: 60000 } })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user subscriptions' })
  @ApiResponse({ status: 200, description: 'List of user subscriptions' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async getMySubscriptions(
    @CurrentUser() user: { id: string; email: string },
  ): Promise<UserSubscriptionWithLiveBalance[]> {
    return await this.savingsService.findMySubscriptions(user.id);
  }

  @Get('my-goals')
  @Throttle({ rpc: { limit: 10, ttl: 60000 } })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Get current user savings goals enriched with live Soroban balance progress',
  })
  @ApiResponse({
    status: 200,
    description:
      'List of savings goals with current balance and percentage completion',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async getMyGoals(
    @CurrentUser() user: { id: string; email: string },
  ): Promise<SavingsGoalProgress[]> {
    return await this.savingsService.findMyGoals(user.id);
  }
}
