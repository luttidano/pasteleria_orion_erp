import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PackagingService } from './packaging.service';
import { PrismaService } from '../../database/prisma.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { StockMovementService } from './stock-movement.service';
import { AccountingOutboxService } from '../accounting/outbox/accounting-outbox.service';
import { AccountingOutboxProcessorService } from '../accounting/outbox/accounting-outbox-processor.service';

describe('PackagingService', () => {
  let service: PackagingService;
  let prisma: any;
  let outboxProcessor: any;

  beforeEach(async () => {
    prisma = {
      packaging: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      stockMovement: {
        create: jest.fn().mockResolvedValue({ id: 'mov-pack-1' }),
      },
      accountingOutbox: {
        upsert: jest.fn().mockResolvedValue({ id: 'outbox-pack-1' }),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn(async (cb: (tx: any) => Promise<any>) => cb(prisma)),
    };

    outboxProcessor = {
      processEvent: jest.fn().mockResolvedValue({
        outboxId: 'outbox-pack-1',
        aggregateType: 'inventory_purchase',
        aggregateId: 'mov-pack-1',
        entryId: 'entry-pack-1',
        entryNumber: 1,
        alreadyProcessed: false,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PackagingService,
        StockMovementService,
        AccountingOutboxService,
        { provide: AccountingOutboxProcessorService, useValue: outboxProcessor },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PackagingService>(PackagingService);
  });

  it('debe obtener todos los empaques con estado de stock calculado', async () => {
    prisma.packaging.findMany.mockResolvedValue([
      {
        id: 'pack-1',
        name: 'Caja Torta 26cm',
        packageType: 'primario',
        category: 'Cajas',
        stock: 50,
        minStock: 20,
        unit: 'un',
        costPrice: 450,
        supplierId: 'sup-1',
        supplier: {
          id: 'sup-1',
          name: 'Envases Chile',
          phone: '+56911112222',
        },
      },
    ]);

    const result = await service.findAll();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Caja Torta 26cm');
    expect(result[0].status).toBe('suficiente');
  });

  it('debe rechazar ajustes que dejen el stock negativo con ConflictException y permitir llegar exactamente a 0', async () => {
    prisma.packaging.findUnique.mockResolvedValue({
      id: 'pack-1',
      name: 'Caja Torta 26cm',
      packageType: 'primario',
      category: 'Cajas',
      stock: 5,
      minStock: 10,
      unit: 'un',
      costPrice: 450,
    });

    await expect(
      service.adjustStock('pack-1', { delta: -10, reasonType: 'waste' }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.packaging.update).not.toHaveBeenCalled();

    prisma.packaging.update.mockImplementation(({ data }: any) => ({
      id: 'pack-1',
      name: 'Caja Torta 26cm',
      packageType: 'primario',
      category: 'Cajas',
      stock: data.stock,
      minStock: 10,
      unit: 'un',
      costPrice: 450,
    }));

    const result = await service.adjustStock('pack-1', {
      delta: -5,
      reasonType: 'waste',
      reason: 'Cajas humedecidas',
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(result.stock).toBe(0);
    expect(result.status).toBe('agotado');
    expect(prisma.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          itemType: 'packaging',
          movementType: 'waste',
          quantityDelta: -5,
          totalCost: 2250,
        }),
      }),
    );
    expect(outboxProcessor.processEvent).toHaveBeenCalledWith('outbox-pack-1');
  });

  it('debe recalcular costo promedio ponderado al registrar compra de empaques', async () => {
    prisma.packaging.findUnique.mockResolvedValue({
      id: 'pack-1',
      name: 'Caja Torta 26cm',
      packageType: 'primario',
      category: 'Cajas',
      stock: 10,
      minStock: 5,
      unit: 'un',
      costPrice: 400,
    });
    prisma.packaging.update.mockImplementation(({ data }: any) => ({
      id: 'pack-1',
      name: 'Caja Torta 26cm',
      packageType: 'primario',
      category: 'Cajas',
      stock: data.stock,
      minStock: 5,
      unit: 'un',
      costPrice: data.costPrice,
    }));

    // Compra de 10 un a $5.950 bruto c/factura -> neto $5.000 ($500 c/u)
    // Costo promedio: (10*400 + 5000) / 20 = 450
    const result = await service.adjustStock('pack-1', {
      delta: 10,
      reasonType: 'purchase',
      totalCost: 5950,
      hasInvoice: true,
      paymentMethod: 'efectivo',
    });

    expect(result.stock).toBe(20);
    expect(result.costPrice).toBe(450);
    expect(prisma.accountingOutbox.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          aggregateType: 'inventory_purchase',
        }),
      }),
    );
  });

  it('debe lanzar NotFoundException si el empaque no existe', async () => {
    prisma.packaging.findUnique.mockResolvedValue(null);

    await expect(service.findOne('id-inexistente')).rejects.toThrow(NotFoundException);
  });

  describe('AdjustStockDto con ValidationPipe estricto', () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    it('debe rechazar valores no numéricos, Infinity o propiedades extra y aceptar delta numérico válido', async () => {
      await expect(
        pipe.transform({ delta: 'abc' }, { type: 'body', metatype: AdjustStockDto }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        pipe.transform(
          { delta: Number.POSITIVE_INFINITY },
          { type: 'body', metatype: AdjustStockDto },
        ),
      ).rejects.toThrow(BadRequestException);

      const valid = await pipe.transform(
        { delta: '5', reason: 'Reposición semanal' },
        { type: 'body', metatype: AdjustStockDto },
      );
      expect(valid.delta).toBe(5);
      expect(valid.reason).toBe('Reposición semanal');
    });
  });
});
