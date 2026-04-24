import { IsString, Length, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyTwoFactorDto {
  @ApiProperty({
    example: '123456',
    description: '6-digit TOTP token from authenticator app',
  })
  @IsString()
  @Length(6, 8) // 6 for TOTP, 8 for backup codes
  token: string;
}

export class LoginWithTwoFactorDto {
  @ApiProperty({
    example: '123456',
    description: '6-digit TOTP token or backup code',
  })
  @IsString()
  @Length(6, 8)
  token: string;
}

export class AdminDisableTwoFactorDto {
  @ApiProperty({ description: 'User ID to disable 2FA for' })
  @IsUUID()
  userId: string;
}
