import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import * as path from 'path';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DataExportService } from './data-export.service';
import { RequestDataExportDto } from './dto/request-data-export.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users/data')
@UseGuards(JwtAuthGuard)
export class DataExportController {
  constructor(private readonly dataExportService: DataExportService) {}

  @Post('export')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Request a GDPR data export (async)' })
  @ApiResponse({ status: 202, description: 'Export request accepted' })
  requestExport(
    @CurrentUser() user: { id: string },
    @Body() _dto: RequestDataExportDto,
  ) {
    return this.dataExportService.requestExport(user.id);
  }

  @Get('export/:requestId/status')
  @ApiOperation({ summary: 'Check export request status' })
  getStatus(
    @CurrentUser() user: { id: string },
    @Param('requestId') requestId: string,
  ) {
    return this.dataExportService.getExportStatus(requestId, user.id);
  }

  @Get('export/download/:token')
  @ApiOperation({
    summary: 'Download export ZIP by token (token acts as auth)',
  })
  async download(@Param('token') token: string, @Res() res: Response) {
    const { filePath } = await this.dataExportService.getExportFile(token);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="nestera-data-export.zip"',
    );
    res.sendFile(path.resolve(filePath));
  }
}
