import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsNumberString,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { PageOptionsDto } from '../../../common/dto/page-options.dto';
import {
  TxStatus,
  TxType,
} from '../../transactions/entities/transaction.entity';

export class AdminTransactionFilterDto extends PageOptionsDto {
  @ApiPropertyOptional({ enum: TxType, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(TxType, { each: true })
  type?: TxType[];

  @ApiPropertyOptional({ enum: TxStatus, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(TxStatus, { each: true })
  status?: TxStatus[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  minAmount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  maxAmount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  flagged?: boolean;
}
