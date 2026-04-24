import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { CsvFormatterStream } from '@fast-csv/format';

import { Transaction } from '../transactions/entities/transaction.entity';
import { AdminTransactionNote } from './entities/admin-transaction-note.entity';
import { AdminTransactionFilterDto } from './dto/admin-transaction-filter.dto';
import { TransactionStatsQueryDto } from './dto/transaction-stats-query.dto';
import { TransactionStatsDto } from './dto/transaction-stats.dto';
import { SuspiciousTransactionDto } from './dto/suspicious-transaction.dto';
import { PageOptionsDto } from '../../common/dto/page-options.dto';
import { PageDto } from '../../common/dto/page.dto';
import { PageMetaDto } from '../../common/dto/page-meta.dto';
import { paginate } from '../../common/helpers/pagination.helper';

const SUSPICIOUS_AMOUNT_THRESHOLD = 10_000;
const VELOCITY_WINDOW_HOURS = 1;
const VELOCITY_MAX_COUNT = 10;
const FAILURE_WINDOW_HOURS = 24;
const FAILURE_MAX_COUNT = 3;

@Injectable()
export class AdminTransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    @InjectRepository(AdminTransactionNote)
    private readonly noteRepo: Repository<AdminTransactionNote>,
  ) {}

  private buildFilterQuery(
    query: AdminTransactionFilterDto,
  ): SelectQueryBuilder<Transaction> {
    const qb = this.txRepo.createQueryBuilder('tx');

    if (query.type?.length) {
      qb.andWhere('tx.type IN (:...type)', { type: query.type });
    }
    if (query.status?.length) {
      qb.andWhere('tx.status IN (:...status)', { status: query.status });
    }
    if (query.userId) {
      qb.andWhere('tx.userId = :userId', { userId: query.userId });
    }
    if (query.minAmount !== undefined) {
      qb.andWhere('CAST(tx.amount AS DECIMAL) >= :minAmount', {
        minAmount: query.minAmount,
      });
    }
    if (query.maxAmount !== undefined) {
      qb.andWhere('CAST(tx.amount AS DECIMAL) <= :maxAmount', {
        maxAmount: query.maxAmount,
      });
    }
    if (query.startDate) {
      qb.andWhere('tx.createdAt >= :startDate', { startDate: query.startDate });
    }
    if (query.endDate) {
      qb.andWhere('tx.createdAt <= :endDate', { endDate: query.endDate });
    }
    if (query.flagged !== undefined) {
      qb.andWhere('tx.flagged = :flagged', { flagged: query.flagged });
    }

    return qb;
  }

  async findAll(
    query: AdminTransactionFilterDto,
  ): Promise<PageDto<Transaction>> {
    const qb = this.buildFilterQuery(query);
    return paginate(qb, query);
  }

  async findSuspicious(
    query: PageOptionsDto,
  ): Promise<PageDto<SuspiciousTransactionDto>> {
    // Heuristic 1 — Large amount
    const largeAmountTxs = await this.txRepo
      .createQueryBuilder('tx')
      .where('CAST(tx.amount AS DECIMAL) > :threshold', {
        threshold: SUSPICIOUS_AMOUNT_THRESHOLD,
      })
      .getMany();

    // Heuristic 2 — High velocity (rolling 1-hour window)
    const highVelocityTxs = await this.txRepo
      .createQueryBuilder('tx')
      .where(
        `(
          SELECT COUNT(*)
          FROM transactions t2
          WHERE t2."userId" = tx."userId"
            AND t2."createdAt" >= tx."createdAt" - INTERVAL '${VELOCITY_WINDOW_HOURS} hour'
            AND t2."createdAt" <= tx."createdAt"
        ) > :velocityMaxCount`,
        { velocityMaxCount: VELOCITY_MAX_COUNT },
      )
      .getMany();

    // Heuristic 3 — Repeated failures (rolling 24-hour window)
    const repeatedFailureTxs = await this.txRepo
      .createQueryBuilder('tx')
      .where(`tx.status = 'FAILED'`)
      .andWhere(
        `(
          SELECT COUNT(*)
          FROM transactions t2
          WHERE t2."userId" = tx."userId"
            AND t2."status" = 'FAILED'
            AND t2."createdAt" >= tx."createdAt" - INTERVAL '${FAILURE_WINDOW_HOURS} hours'
            AND t2."createdAt" <= tx."createdAt"
        ) > :failureMaxCount`,
        { failureMaxCount: FAILURE_MAX_COUNT },
      )
      .getMany();

    // Merge by id, collecting all triggered reasons
    const merged = new Map<string, SuspiciousTransactionDto>();

    const addToMerged = (tx: Transaction, reason: string) => {
      if (merged.has(tx.id)) {
        merged.get(tx.id)!.reasons.push(reason);
      } else {
        merged.set(tx.id, { ...tx, reasons: [reason] });
      }
    };

    for (const tx of largeAmountTxs) {
      addToMerged(
        tx,
        `Amount exceeds threshold of ${SUSPICIOUS_AMOUNT_THRESHOLD} units`,
      );
    }
    for (const tx of highVelocityTxs) {
      addToMerged(
        tx,
        `User submitted more than ${VELOCITY_MAX_COUNT} transactions within a 1-hour window`,
      );
    }
    for (const tx of repeatedFailureTxs) {
      addToMerged(
        tx,
        `User has more than ${FAILURE_MAX_COUNT} failed transactions within a 24-hour window`,
      );
    }

    const allResults = Array.from(merged.values());
    const totalItemCount = allResults.length;
    const skip = query.skip ?? 0;
    const limit = query.limit ?? 10;
    const pageSlice = allResults.slice(skip, skip + limit);

    const meta = new PageMetaDto({ pageOptionsDto: query, totalItemCount });
    return new PageDto(pageSlice, meta);
  }

  async getStats(
    query: TransactionStatsQueryDto,
  ): Promise<TransactionStatsDto[]> {
    const qb = this.txRepo
      .createQueryBuilder('tx')
      .select(`DATE_TRUNC(:period, tx.createdAt)`, 'period')
      .addSelect('tx.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(CAST(tx.amount AS DECIMAL))', 'totalVolume')
      .addSelect('AVG(CAST(tx.amount AS DECIMAL))', 'averageAmount')
      .setParameter('period', query.period)
      .groupBy(`DATE_TRUNC(:period, tx.createdAt)`)
      .addGroupBy('tx.type');

    if (query.startDate) {
      qb.andWhere('tx.createdAt >= :startDate', { startDate: query.startDate });
    }
    if (query.endDate) {
      qb.andWhere('tx.createdAt <= :endDate', { endDate: query.endDate });
    }

    const raw = await qb.getRawMany();

    return raw.map((row) => ({
      period:
        row.period instanceof Date
          ? row.period.toISOString()
          : String(row.period),
      type: row.type,
      count: Number(row.count),
      totalVolume: String(row.totalVolume),
      averageAmount: String(row.averageAmount),
    }));
  }

  async flagTransaction(id: string, flagged: boolean): Promise<Transaction> {
    const existing = await this.txRepo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Transaction ${id} not found`);
    }
    await this.txRepo.update(id, { flagged });
    return this.txRepo.findOne({ where: { id } }) as Promise<Transaction>;
  }

  async addNote(
    transactionId: string,
    adminId: string,
    content: string,
  ): Promise<AdminTransactionNote> {
    const tx = await this.txRepo.findOne({ where: { id: transactionId } });
    if (!tx) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }
    return this.noteRepo.save(
      this.noteRepo.create({ transactionId, adminId, content }),
    );
  }

  async streamCsv(
    query: AdminTransactionFilterDto,
    stream: CsvFormatterStream<any, any>,
  ): Promise<void> {
    const batchSize = 500;
    let offset = 0;

    while (true) {
      const batch = await this.buildFilterQuery(query)
        .skip(offset)
        .take(batchSize)
        .getMany();

      if (!batch.length) break;

      for (const tx of batch) {
        stream.write({
          id: tx.id,
          userId: tx.userId,
          type: tx.type,
          status: tx.status,
          amount: tx.amount,
          txHash: tx.txHash ?? '',
          publicKey: tx.publicKey ?? '',
          poolId: tx.poolId ?? '',
          flagged: tx.flagged,
          createdAt: tx.createdAt.toISOString(),
        });
      }

      offset += batchSize;
    }

    stream.end();
  }
}
