import { IsEmail, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsStellarPublicKey } from '../../common/validators/is-stellar-key.validator';
import { IsStrongPassword } from '../../common/validators/is-strong-password.validator';

export class RegisterDto {
  @ApiProperty({ example: 'alice@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'MyP@ssw0rd!',
    description:
      'Must be 8-72 characters and contain at least one uppercase letter, ' +
      'one lowercase letter, one digit, and one special character.',
  })
  @IsString()
  @IsStrongPassword()
  password: string;

  @ApiProperty({ example: 'Alice', required: false })
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: 'ABC12345',
    description: 'Referral code from another user',
  })
  @IsOptional()
  @IsString()
  referralCode?: string;

  @ApiPropertyOptional({
    example: 'device-123',
    description: 'Device identifier',
  })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({ example: 'My Phone', description: 'Device name' })
  @IsOptional()
  @IsString()
  deviceName?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'alice@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'supersecret123' })
  @IsString()
  password: string;

  @ApiPropertyOptional({
    example: 'device-123',
    description: 'Device identifier',
  })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({ example: 'My Phone', description: 'Device name' })
  @IsOptional()
  @IsString()
  deviceName?: string;
}

export class GetNonceDto {
  @ApiProperty({ example: 'GABC...' })
  @IsStellarPublicKey()
  publicKey: string;
}

export class VerifySignatureDto {
  @ApiProperty({ example: 'GABC...' })
  @IsStellarPublicKey()
  publicKey: string;

  @ApiProperty({ description: 'Hex-encoded Ed25519 signature over the nonce' })
  @IsString()
  signature: string;

  @ApiProperty({ description: 'The nonce returned by GET /auth/nonce' })
  @IsString()
  nonce: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token' })
  @IsString()
  token: string;

  @ApiPropertyOptional({
    example: 'device-123',
    description: 'Device identifier',
  })
  @IsOptional()
  @IsString()
  deviceId?: string;
}

/**
 * Body accepted by POST /auth/link-wallet.
 * The caller must:
 *  1. Fetch a nonce via GET /auth/nonce?publicKey=<key>
 *  2. Sign the nonce bytes with the wallet's Ed25519 secret key
 *  3. Submit this DTO together with a valid JWT (Bearer token)
 */
export class LinkWalletDto {
  @ApiProperty({
    example: 'GABC1234...',
    description: 'Stellar G... public key to link to the authenticated account',
  })
  @IsStellarPublicKey()
  publicKey: string;

  @ApiProperty({
    description: 'The nonce returned by GET /auth/nonce?publicKey=<key>',
  })
  @IsString()
  nonce: string;

  @ApiProperty({
    description: 'Hex-encoded Ed25519 signature of the nonce bytes',
  })
  @IsString()
  signature: string;
}
