import {
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
  Patch,
  Param,
  Body,
  Post,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { format as csvFormat } from '@fast-csv/format';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminTransactionsService } from './admin-transactions.service';
import { AdminTransactionFilterDto } from './dto/admin-transaction-filter.dto';
import { PageDto } from '../../common/dto/page.dto';
import { PageOptionsDto } from '../../common/dto/page-options.dto';
import { Transaction } from '../transactions/entities/transaction.entity';
import { SuspiciousTransactionDto } from './dto/suspicious-transaction.dto';
import { TransactionStatsQueryDto } from './dto/transaction-stats-query.dto';
import { TransactionStatsDto } from './dto/transaction-stats.dto';
import { FlagTransactionDto } from './dto/flag-transaction.dto';
import { AddAdminNoteDto } from './dto/add-admin-note.dto';
import { AdminTransactionNote } from './entities/admin-transaction-note.entity';

@ApiTags('admin')
@Controller('admin/transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth()
export class AdminTransactionsController {
  constructor(
    private readonly adminTransactionsService: AdminTransactionsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all transactions with advanced filtering' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of transactions',
    type: PageDto<Transaction>,
  })
  async listTransactions(
    @Query() query: AdminTransactionFilterDto,
  ): Promise<PageDto<Transaction>> {
    return this.adminTransactionsService.findAll(query);
  }

  @Get('suspicious')
  @ApiOperation({ summary: 'List suspicious transactions' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of suspicious transactions',
    type: PageDto<SuspiciousTransactionDto>,
  })
  async listSuspicious(
    @Query() query: PageOptionsDto,
  ): Promise<PageDto<SuspiciousTransactionDto>> {
    return this.adminTransactionsService.findSuspicious(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get transaction statistics' })
  @ApiResponse({
    status: 200,
    description: 'Transaction statistics grouped by period and type',
    type: [TransactionStatsDto],
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - period parameter missing or invalid',
  })
  async getStats(
    @Query() query: TransactionStatsQueryDto,
  ): Promise<TransactionStatsDto[]> {
    return this.adminTransactionsService.getStats(query);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export transactions to CSV' })
  @ApiResponse({
    status: 200,
    description: 'CSV file containing filtered transactions',
  })
  async exportCsv(
    @Query() query: AdminTransactionFilterDto,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="admin_transactions_export.csv"',
    );

    const csvStream = csvFormat({ headers: true, quoteColumns: true });
    csvStream.pipe(res);

    await this.adminTransactionsService.streamCsv(query, csvStream);
  }

  @Patch(':id/flag')
  @ApiOperation({ summary: 'Flag a transaction for review' })
  @ApiResponse({
    status: 200,
    description: 'Transaction flagged successfully',
    type: Transaction,
  })
  @ApiResponse({
    status: 404,
    description: 'Transaction not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request body',
  })
  async flagTransaction(
    @Param('id') id: string,
    @Body() body: FlagTransactionDto,
  ): Promise<Transaction> {
    return this.adminTransactionsService.flagTransaction(id, body.flagged);
  }

  @Post(':id/notes')
  @HttpCode(201)
  @ApiOperation({ summary: 'Add an admin note to a transaction' })
  @ApiResponse({
    status: 201,
    description: 'Admin note created successfully',
    type: AdminTransactionNote,
  })
  @ApiResponse({
    status: 404,
    description: 'Transaction not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request body',
  })
  async addNote(
    @Param('id') id: string,
    @Body() body: AddAdminNoteDto,
    @CurrentUser() user: any,
  ): Promise<AdminTransactionNote> {
    return this.adminTransactionsService.addNote(id, user.id, body.content);
  }
}
