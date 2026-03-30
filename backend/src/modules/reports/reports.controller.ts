import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('tax/:year')
  async getTaxReport(
    @Param('year') yearParam: string,
    @Query('format') format = 'csv',
    @Query('irs1099') irs1099 = 'false',
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const year = Number(yearParam);
    if (!user || !user.id)
      throw new BadRequestException('authenticated user required');
    if (Number.isNaN(year)) throw new BadRequestException('invalid year');
    const irsFlag = irs1099 === 'true';

    const result = await this.reportsService.buildAndStoreTaxReport(
      user.id,
      year,
      { format, irs1099: irsFlag },
    );

    return res.json({ storedPath: result.path, filename: result.filename });
  }
}
