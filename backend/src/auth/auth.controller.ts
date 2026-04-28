import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
  Request,
  UnauthorizedException,
  NotFoundException,
  Ip,
  Headers,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiHeader,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { TwoFactorService } from './two-factor.service';
import {
  RegisterDto,
  LoginDto,
  GetNonceDto,
  VerifySignatureDto,
  LinkWalletDto,
  RefreshTokenDto,
} from './dto/auth.dto';
import {
  VerifyTwoFactorDto,
  LoginWithTwoFactorDto,
  AdminDisableTwoFactorDto,
} from './dto/two-factor.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthRateLimit } from './decorators/auth-rate-limit.decorator';
import { AuthRateLimitGuard } from './guards/auth-rate-limit.guard';

@ApiTags('auth')
@Controller('auth')
@UseGuards(AuthRateLimitGuard) // Apply auth rate limiting to all routes
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  @Post('register')
  @AuthRateLimit({ limit: 3, ttl: 3600000 }) // 3 per hour
  @Throttle({ auth: { limit: 5, ttl: 15 * 60 * 1000 } })
  @ApiOperation({ summary: 'Register a new email/password account' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  @ApiResponse({ status: 429, description: 'Too many registration attempts' })
  @ApiHeader({
    name: 'X-RateLimit-Limit',
    description: 'Maximum requests allowed',
  })
  @ApiHeader({
    name: 'X-RateLimit-Remaining',
    description: 'Remaining requests',
  })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @AuthRateLimit({ limit: 5, ttl: 900000 }) // 5 per 15 minutes
  @Throttle({ auth: { limit: 5, ttl: 15 * 60 * 1000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login and receive a JWT' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too many login attempts' })
  @ApiHeader({
    name: 'X-RateLimit-Limit',
    description: 'Maximum requests allowed',
  })
  @ApiHeader({
    name: 'X-RateLimit-Remaining',
    description: 'Remaining requests',
  })
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.authService.login(dto, ip);
  }

  @Get('nonce')
  @AuthRateLimit({ limit: 10, ttl: 900000 }) // 10 per 15 minutes
  @Throttle({ auth: { limit: 5, ttl: 15 * 60 * 1000 } })
  @ApiOperation({ summary: 'Generate a one-time nonce for wallet signature' })
  @ApiResponse({ status: 200, description: 'Nonce generated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid public key format' })
  @ApiResponse({ status: 429, description: 'Too many nonce requests' })
  @ApiHeader({
    name: 'X-RateLimit-Limit',
    description: 'Maximum requests allowed',
  })
  @ApiHeader({
    name: 'X-RateLimit-Remaining',
    description: 'Remaining requests',
  })
  getNonce(@Query('publicKey') publicKey: string) {
    return this.authService.generateNonce(publicKey);
  }

  @Post('verify-signature')
  @AuthRateLimit({ limit: 5, ttl: 900000 }) // 5 per 15 minutes
  @Throttle({ auth: { limit: 5, ttl: 15 * 60 * 1000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify wallet signature and receive a JWT' })
  @ApiResponse({ status: 200, description: 'Signature verified successfully' })
  @ApiResponse({ status: 401, description: 'Invalid signature or nonce' })
  @ApiResponse({ status: 429, description: 'Too many verification attempts' })
  @ApiHeader({
    name: 'X-RateLimit-Limit',
    description: 'Maximum requests allowed',
  })
  @ApiHeader({
    name: 'X-RateLimit-Remaining',
    description: 'Remaining requests',
  })
  verifySignature(@Body() dto: VerifySignatureDto, @Ip() ip: string) {
    return this.authService.verifySignature(dto, ip);
  }

  /**
   * POST /auth/link-wallet
   *
   * Links a Stellar wallet address to the currently authenticated email account.
   *
   * Pre-conditions (enforced by this endpoint):
   *  - Caller must provide a valid Bearer JWT (JwtAuthGuard)
   *  - publicKey must be a valid Stellar Ed25519 public key
   *  - signature must be a valid Ed25519 signature of `nonce` by the wallet's secret key
   *  - publicKey must not already be linked to ANY account (returns 409 if so)
   */
  @Post('link-wallet')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Link a Stellar wallet address to the authenticated email account',
    description:
      '1. Call GET /auth/nonce?publicKey=<key> to get a fresh nonce. ' +
      '2. Sign the nonce bytes with the wallet secret key (Ed25519). ' +
      '3. POST { publicKey, nonce, signature } with your Bearer token.',
  })
  @ApiResponse({ status: 200, description: 'Wallet linked successfully' })
  @ApiResponse({ status: 400, description: 'Invalid public key format' })
  @ApiResponse({
    status: 401,
    description: 'Invalid or missing JWT / bad signature',
  })
  @ApiResponse({
    status: 409,
    description: 'Wallet already linked to an account',
  })
  linkWallet(
    @Request() req: { user: { id: string } },
    @Body() dto: LinkWalletDto,
  ) {
    return this.authService.linkWallet(req.user.id, dto);
  }

  // --- Two-Factor Authentication Endpoints ---

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Enable 2FA - generates secret and backup codes',
    description:
      'Returns a TOTP secret, otpauth:// URL for QR code generation, and backup codes. ' +
      'Call POST /auth/2fa/verify with a valid token to activate.',
  })
  @ApiResponse({
    status: 201,
    description: 'Secret and backup codes generated',
  })
  @ApiResponse({ status: 400, description: '2FA already enabled' })
  enable2fa(@Request() req: { user: { id: string } }) {
    return this.twoFactorService.enable(req.user.id);
  }

  @Post('2fa/verify')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Verify and activate 2FA with a TOTP token',
    description:
      'After enabling, submit a token from your authenticator app to confirm setup.',
  })
  @ApiResponse({ status: 200, description: '2FA activated' })
  @ApiResponse({ status: 401, description: 'Invalid token' })
  verify2fa(
    @Request() req: { user: { id: string } },
    @Body() dto: VerifyTwoFactorDto,
  ) {
    return this.twoFactorService.verify(req.user.id, dto.token);
  }

  @Post('2fa/validate')
  @AuthRateLimit({ limit: 5, ttl: 900000 }) // 5 per 15 minutes
  @Throttle({ auth: { limit: 5, ttl: 15 * 60 * 1000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Complete login with 2FA token',
    description:
      'When login returns requiresTwoFactor: true, call this endpoint with the userId and TOTP token.',
  })
  @ApiResponse({ status: 200, description: 'JWT returned on success' })
  @ApiResponse({ status: 401, description: 'Invalid 2FA token' })
  @ApiResponse({ status: 429, description: 'Too many 2FA attempts' })
  @ApiHeader({
    name: 'X-RateLimit-Limit',
    description: 'Maximum requests allowed',
  })
  @ApiHeader({
    name: 'X-RateLimit-Remaining',
    description: 'Remaining requests',
  })
  async validate2fa(
    @Body('userId') userId: string,
    @Body() dto: LoginWithTwoFactorDto,
  ) {
    const valid = await this.twoFactorService.validateLogin(userId, dto.token);
    if (!valid) {
      throw new UnauthorizedException('Invalid 2FA token');
    }
    return this.twoFactorService.completeLogin(userId);
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disable 2FA for your account' })
  @ApiResponse({ status: 200, description: '2FA disabled' })
  @ApiResponse({ status: 400, description: '2FA not enabled' })
  disable2fa(@Request() req: { user: { id: string } }) {
    return this.twoFactorService.disable(req.user.id);
  }

  @Post('2fa/admin-disable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Admin: disable 2FA for a locked account',
    description: 'Requires ADMIN role',
  })
  @ApiResponse({ status: 200, description: '2FA disabled for target user' })
  @ApiResponse({ status: 400, description: '2FA not enabled for user' })
  adminDisable2fa(
    @Request() req: { user: { id: string; role: string } },
    @Body() dto: AdminDisableTwoFactorDto,
  ) {
    if (req.user.role !== 'ADMIN') {
      throw new UnauthorizedException('Admin access required');
    }
    return this.twoFactorService.adminDisable(dto.userId);
  }

  @Get('2fa/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check if 2FA is enabled for your account' })
  @ApiResponse({ status: 200, description: '2FA status' })
  get2faStatus(@Request() req: { user: { id: string } }) {
    return this.twoFactorService.getStatus(req.user.id);
  }

  // --- Refresh Token Endpoints ---

  @Post('refresh')
  @AuthRateLimit({ limit: 10, ttl: 900000 }) // 10 per 15 minutes
  @Throttle({ auth: { limit: 10, ttl: 15 * 60 * 1000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token using refresh token',
    description:
      'Exchanges a valid refresh token for a new access token and refresh token (token rotation).',
  })
  @ApiResponse({ status: 200, description: 'New tokens generated' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  @ApiResponse({ status: 429, description: 'Too many refresh attempts' })
  @ApiHeader({
    name: 'X-RateLimit-Limit',
    description: 'Maximum requests allowed',
  })
  @ApiHeader({
    name: 'X-RateLimit-Remaining',
    description: 'Remaining requests',
  })
  refreshToken(
    @Body() dto: RefreshTokenDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.authService.refreshToken({
      ...dto,
      deviceId: dto.deviceId || userAgent?.substring(0, 64),
    });
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Logout and revoke current session and refresh token',
  })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(
    @Request() req: { user: { id: string; jti?: string } },
    @Body('refreshToken') refreshToken?: string,
  ) {
    // Revoke session if JTI is present
    if (req.user.jti) {
      await this.authService.revokeSession(req.user.jti);
    }
    // Revoke refresh token if provided
    if (refreshToken) {
      await this.authService.revokeRefreshToken(refreshToken);
    }
    return { message: 'Logged out successfully' };
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout from all devices' })
  @ApiResponse({ status: 200, description: 'Logged out from all devices' })
  async logoutAll(@Request() req: { user: { id: string } }) {
    const tokenCount = await this.authService.revokeAllUserTokens(req.user.id);
    const sessionCount = await this.authService.revokeAllUserSessions(
      req.user.id,
    );
    return {
      message: `Logged out from ${tokenCount} token(s) and ${sessionCount} session(s)`,
    };
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get active sessions' })
  @ApiResponse({ status: 200, description: 'List of active sessions' })
  async getSessions(@Request() req: { user: { id: string } }) {
    const sessions = await this.authService.getUserSessions(req.user.id);
    return { sessions };
  }

  // --- Admin Endpoints ---

  @Post('admin/unlock-account')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Admin: Unlock a locked user account',
    description: 'Requires ADMIN role',
  })
  @ApiResponse({ status: 200, description: 'Account unlocked' })
  @ApiResponse({ status: 401, description: 'Admin access required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async adminUnlockAccount(
    @Request() req: { user: { id: string; role: string } },
    @Body('userId') targetUserId: string,
  ) {
    if (req.user.role !== 'ADMIN') {
      throw new UnauthorizedException('Admin access required');
    }
    const success = await this.authService.unlockUser(targetUserId);
    if (!success) {
      throw new NotFoundException('User not found');
    }
    return { message: 'Account unlocked successfully' };
  }
}
