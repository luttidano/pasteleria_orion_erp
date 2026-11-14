import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PosSummaryService } from './pos-summary.service';
import { PrismaService } from '../../database/prisma.service';

describe('PosSummaryService', () => {
  let service: PosSummaryService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      posSale: {
        groupBy: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PosSummaryService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PosSummaryService>(PosSummaryService);
  });

  it('debe sumar por separado efectivo en gaveta, tarjetas POS y transferencias', async () => {
    prisma.posSale.groupBy.mockResolvedValue([
      { paymentMethod: 'efectivo', _sum: { total: 12500 }, _count: { _all: 2 } },
      { paymentMethod: 'debito', _sum: { total: 8000 }, _count: { _all: 1 } },
      { paymentMethod: 'credito', _sum: { total: 4500 }, _count: { _all: 1 } },
      { paymentMethod: 'transferencia', _sum: { total: 3000 }, _count: { _all: 1 } },
    ]);

    const summary = await service.getSalesSummary(
      '2026-11-11T03:00:00.000Z',
      '2026-11-12T02:59:59.999Z',
    );

    expect(summary.cashSalesTotal).toBe(12500);
    expect(summary.cardPosTotal).toBe(12500);
    expect(summary.debitTotal).toBe(8000);
    expect(summary.creditTotal).toBe(4500);
    expect(summary.transferTotal).toBe(3000);
    expect(summary.totalSales).toBe(28000);
    expect(summary.transactionsCount).toBe(5);
  });

  it('debe rechazar un rango de fechas inválido (from > to)', async () => {
    await expect(
      service.getSalesSummary(
        '2026-11-12T00:00:00.000Z',
        '2026-11-11T00:00:00.000Z',
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
