import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsArray, IsString } from 'class-validator';

export class BulkTagDto {
  @ApiPropertyOptional({
    description: 'List of transaction IDs to operate on',
    isArray: true,
    example: ['uuid-1', 'uuid-2'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ids?: string[];

  @ApiPropertyOptional({
    description: 'Tags to apply',
    isArray: true,
    example: ['groceries'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Category to set',
    example: 'Groceries',
  })
  @IsOptional()
  @IsString()
  category?: string;
}
