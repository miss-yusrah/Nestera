import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsArray, IsString } from 'class-validator';

export class RequestDataExportDto {
  @ApiPropertyOptional({
    description: 'Specific data sections to include. Defaults to all.',
    example: ['profile', 'transactions', 'savings', 'goals', 'notifications'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sections?: string[];
}
