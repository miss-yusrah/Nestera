import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsArray, IsString, IsIn } from 'class-validator';

export class TagTransactionDto {
  @ApiPropertyOptional({
    description: 'Tags to apply to the transaction',
    isArray: true,
    example: ['groceries', 'food'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Category to assign',
    example: 'Groceries',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Action to perform on tags',
    example: 'add',
  })
  @IsOptional()
  @IsString()
  @IsIn(['add', 'remove', 'set'])
  action?: 'add' | 'remove' | 'set';
}
