import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import {
  Transaction,
  TxType,
} from '../transactions/entities/transaction.entity';
import { SavingsProduct } from '../savings/entities/savings-product.entity';
import { User } from '../user/entities/user.entity';

describe('ReportsService', () => {
  let service: ReportsService;
  const mockTxRepo = { find: jest.fn() };
  const mockProductRepo = { findOneBy: jest.fn() };
  const mockUserRepo = { findOne: jest.fn() };
  const mockConfig = { get: jest.fn().mockReturnValue('test-key') };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: getRepositoryToken(Transaction), useValue: mockTxRepo },
        {
          provide: getRepositoryToken(SavingsProduct),
          useValue: mockProductRepo,
        },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('generateTaxReportCSV aggregates transactions into CSV', async () => {
    const txs = [
      {
        userId: 'u1',
        type: TxType.DEPOSIT,
        amount: '100',
        poolId: 'p1',
        createdAt: new Date('2025-03-01'),
      },
      {
        userId: 'u1',
        type: TxType.YIELD,
        amount: '5',
        poolId: 'p1',
        createdAt: new Date('2025-04-01'),
      },
      {
        userId: 'u1',
        type: TxType.WITHDRAW,
        amount: '120',
        poolId: 'p1',
        createdAt: new Date('2025-12-01'),
      },
      {
        userId: 'u1',
        type: TxType.DEPOSIT,
        amount: '50',
        poolId: 'p2',
        createdAt: new Date('2025-06-01'),
      },
    ];

    mockTxRepo.find.mockResolvedValue(txs);
    mockProductRepo.findOneBy.mockResolvedValue({ id: 'p1', name: 'Pool One' });

    const buf = await service.generateTaxReportCSV('u1', 2025);
    const csv = buf.toString();
    expect(csv).toContain(
      'productId,productName,interest,deposits,withdrawals,gains',
    );
    expect(csv).toContain('Pool One');
    expect(csv).toContain('5');
    expect(csv).toContain('100');
    expect(csv).toContain('120');
  });

  it('generate1099CSV sums interest and includes user info', async () => {
    const txs = [
      {
        userId: 'u1',
        type: TxType.YIELD,
        amount: '2.5',
        createdAt: new Date('2025-01-02'),
      },
      {
        userId: 'u1',
        type: TxType.YIELD,
        amount: '1.5',
        createdAt: new Date('2025-05-02'),
      },
    ];
    mockTxRepo.find.mockResolvedValue(txs);
    mockUserRepo.findOne.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      name: 'Alice',
      tin: '123-45-6789',
      accountNumber: 'ACC123',
    });

    const buf = await service.generate1099CSV('u1', 2025);
    const csv = buf.toString();
    expect(csv).toContain(
      'payer_name,payer_tin,recipient_name,recipient_tin,recipient_account_number,year,interest_income,federal_tax_withheld',
    );
    expect(csv).toContain('Alice');
    expect(csv).toContain('123-45-6789');
    expect(csv).toContain('4');
  });

  it('generatePdfReport returns a Buffer', async () => {
    const products = new Map<string, any>();
    products.set('p1', {
      productName: 'Pool One',
      interest: 1.23,
      deposits: 100,
      withdrawals: 110,
      gains: 10,
    });
    const buf = await service.generatePdfReport('u1', 2025, products as any);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
  });
});
