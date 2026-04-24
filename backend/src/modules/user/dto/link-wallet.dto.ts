import { IsString, Matches, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LinkWalletDto {
  @ApiProperty({ description: 'Stellar public key (G...)' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^G[A-Z2-7]{55}$/, { message: 'Invalid Stellar public key format' })
  address: string;

  @ApiProperty({ description: 'Signed message proving wallet ownership' })
  @IsString()
  @IsNotEmpty()
  signature: string;

  @ApiProperty({ description: 'The message that was signed' })
  @IsString()
  @IsNotEmpty()
  message: string;
}
