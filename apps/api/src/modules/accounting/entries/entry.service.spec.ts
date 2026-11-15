import { BadRequestException, ConflictException, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EntryService } from './entry.service';
import { EntryVoidService } from './entry-void.service';
import { AccountingIntegrationService } from '../outbox/accounting-integration.service';
import { PrismaService } from '../../../database/prisma.service';
import { AccountingPeriodService } from '../periods/accounting-period.service';
import { InventoryValuationService } from '../../inventory/valuation/inventory-valuation.service';
import { AccountingEntryOrigin } from '../../../common/enums';
import { CreateAccountingEntryDto } from '../dto/create-accounting-entry.dto';

interface SeedAccount {
  id: string;
  code: string;
  name: string;
  accountType: string;
  isActive: boolean;
}

const DEFAULT_ACCOUNTS: SeedAccount[] = [
  { id: 'acc-1101', code: '1101', name: 'Caja General Efectivo', accountType: 'activo', isActive: true },
  { id: 'acc-1102', code: '1102', name: 'Banco / Transbank Débito', accountType: 'activo', isActive: true },
  { id: 'acc-1103', code: '1103', name: 'Banco / Tarjeta Crédito', accountType: 'activo', isActive: true },
  { id: 'acc-1104', code: '1104', name: 'Banco / Transferencias', accountType: 'activo', isActive: true },
  { id: 'acc-1105', code: '1105', name: 'Inventario Materias Primas', accountType: 'activo', isActive: true },
  { id: 'acc-1106', code: '1106', name: 'Inventario Productos Terminados', accountType: 'activo', isActive: true },
  { id: 'acc-1108', code: '1108', name: 'IVA Crédito Fiscal', accountType: 'activo', isActive: true },
  { id: 'acc-2101', code: '2101', name: 'Proveedores por Pagar', accountType: 'pasivo', isActive: true },
  { id: 'acc-2102', code: '2102', name: 'IVA Débito Fiscal', accountType: 'pasivo', isActive: true },
  { id: 'acc-4101', code: '4101', name: 'Venta de Pastelería y Bollería', accountType: 'ingreso', isActive: true },
  { id: 'acc-4102', code: '4102', name: 'Otros Ingresos / Sobrantes de Caja', accountType: 'ingreso', isActive: true },
  { id: 'acc-5101', code: '5101', name: 'Costo de Ventas / Materias Primas', accountType: 'costo', isActive: true },
  { id: 'acc-6101', code: '6101', name: 'Gastos Operativos y Suministros', accountType: 'gasto', isActive: true },
  { id: 'acc-6103', code: '6103', name: 'Faltantes de Caja', accountType: 'gasto', isActive: true },
  { id: 'acc-6104', code: '6104', name: 'Pérdidas por Merma y Ajustes', accountType: 'gasto', isActive: true },
];

function createAccountFinder(accounts: SeedAccount[]) {
  return jest.fn().mockImplementation(({ where }: { where: any }) => {
    const matches = accounts.filter((acc) => {
      if (where?.isActive !== undefined && acc.isActive !== where.isActive) return false;
      if (typeof where?.code === 'string' && acc.code !== where.code) return false;
      if (where?.code?.notIn && where.code.notIn.includes(acc.code)) return false;
      if (where?.accountType && acc.accountType !== where.accountType) return false;
      if (where?.name?.contains) {
        const needle = String(where.name.contains).toLowerCase();
        if (!acc.name.toLowerCase().includes(needle)) return false;
      }
      return true;
    });
    matches.sort((a, b) => a.code.localeCompare(b.code));
    return Promise.resolve(matches[0] ?? null);
  });
}

describe('EntryService', () => {
  let service: EntryService;
  let prisma: any;
  let periodService: any;
  let valuationService: any;

  beforeEach(async () => {
    prisma = {
      accountingEntry: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'entry-1',
          entryNumber: 1n,
          items: [],
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      accountingAccount: {
        findFirst: createAccountFinder(DEFAULT_ACCOUNTS),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn(async (cb: (tx: any) => Promise<any>) => cb(prisma)),
    };

    periodService = {
      assertPeriodOpen: jest.fn().mockResolvedValue({ year: 2026, month: 11 }),
      getLockedLookup: jest.fn(),
    };

    valuationService = {
      getIngredientUnitCostsInTx: jest.fn().mockResolvedValue(new Map()),
      getSaleItemUnitCostsInTx: jest.fn().mockResolvedValue({
        products: new Map(),
        packagings: new Map(),
      }),
      getItemUnitCostInTx: jest.fn().mockResolvedValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntryService,
        EntryVoidService,
        AccountingIntegrationService,
        { provide: PrismaService, useValue: prisma },
        { provide: AccountingPeriodService, useValue: periodService },
        { provide: InventoryValuationService, useValue: valuationService },
      ],
    }).compile();

    service = module.get<EntryService>(EntryService);
  });

  describe('registerSaleIncome', () => {
    it.each([
      { paymentMethod: 'efectivo', expectedAssetId: 'acc-1101' },
      { paymentMethod: 'debito', expectedAssetId: 'acc-1102' },
      { paymentMethod: 'credito', expectedAssetId: 'acc-1102' },
      { paymentMethod: 'transferencia', expectedAssetId: 'acc-1102' },
    ])(
      'debe imputar método "$paymentMethod" en cuenta $expectedAssetId e IVA Débito en 2102 (nunca 2101)',
      async ({ paymentMethod, expectedAssetId }) => {
        await service.registerSaleIncome({
          id: `sale-${paymentMethod}`,
          ticketNumber: 'TK-1001',
          soldAt: '2026-11-11T18:00:00.000Z',
          total: 1190,
          paymentMethod,
        });

        expect(prisma.accountingEntry.create).toHaveBeenCalledTimes(1);
        const createArg = prisma.accountingEntry.create.mock.calls[0][0];
        const items = createArg.data.items.create;

        expect(items).toEqual([
          {
            accountId: expectedAssetId,
            debit: 1190,
            credit: 0,
            description: `Ingreso venta ${paymentMethod}`,
          },
          {
            accountId: 'acc-4101',
            debit: 0,
            credit: 1000,
            description: 'Venta neta productos',
          },
          {
            accountId: 'acc-2102',
            debit: 0,
            credit: 190,
            description: '19% IVA Débito Fiscal',
          },
        ]);
      },
    );

    it('NO debe imputar IVA a 2101 (Proveedores) si faltan las cuentas específicas de IVA', async () => {
      const withoutVat = DEFAULT_ACCOUNTS.filter((acc) => acc.code !== '2102');
      prisma.accountingAccount.findFirst = createAccountFinder(withoutVat);

      await service.registerSaleIncome({
        id: 'sale-no-vat',
        ticketNumber: 'TK-1002',
        soldAt: '2026-11-11T18:00:00.000Z',
        total: 1190,
        paymentMethod: 'debito',
      });

      const items = prisma.accountingEntry.create.mock.calls[0][0].data.items.create;
      expect(items.some((item: any) => item.accountId === 'acc-2101')).toBe(false);
      expect(items).toHaveLength(2);
      expect(items[0]).toMatchObject({ accountId: 'acc-1102', debit: 1190 });
      expect(items[1]).toMatchObject({ accountId: 'acc-4101', credit: 1190 });
    });

    it('debe consolidar medios digitales en 1102 cuando 1103 y 1104 están inactivas (y priorizar 1102 sobre 1101)', async () => {
      const onlyConsolidatedBank = DEFAULT_ACCOUNTS.filter(
        (acc) => acc.code !== '1103' && acc.code !== '1104',
      );
      prisma.accountingAccount.findFirst = createAccountFinder(onlyConsolidatedBank);

      await service.registerSaleIncome({
        id: 'sale-mp-credit',
        ticketNumber: 'TK-1004',
        soldAt: '2026-11-12T16:00:00.000Z',
        total: 10000,
        paymentMethod: 'credito',
      });

      const saleItems = prisma.accountingEntry.create.mock.calls[0][0].data.items.create;
      expect(saleItems[0]).toMatchObject({ accountId: 'acc-1102', debit: 10000 });

      await service.registerInventoryPurchase('outbox-pur-mp', {
        itemType: 'ingredient',
        itemId: 'ing-mp',
        itemName: 'Crema de Leche',
        quantity: 2,
        unit: 'lt',
        totalCost: 11900,
        hasInvoice: true,
        paymentMethod: 'transferencia',
        occurredAt: '2026-11-12T16:05:00.000Z',
      });

      const purchaseItems =
        prisma.accountingEntry.create.mock.calls[1][0].data.items.create;
      expect(purchaseItems[2]).toMatchObject({ accountId: 'acc-1102', credit: 11900 });
    });

    it('debe convertir soldAt UTC nocturno (22:30 CLT) a la fecha comercial de America/Santiago', async () => {
      await service.registerSaleIncome({
        id: 'sale-night-clt',
        ticketNumber: 'TK-1003',
        soldAt: '2026-11-12T01:30:00.000Z', // 2026-11-11 22:30 America/Santiago (-03:00)
        total: 2380,
        paymentMethod: 'efectivo',
      });

      expect(periodService.assertPeriodOpen).toHaveBeenCalledWith('2026-11-11', prisma);
      expect(prisma.accountingEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entryDate: new Date('2026-11-11T00:00:00.000Z'),
          }),
        }),
      );
    });
  });

  describe('registerShiftDifferenceAdjustment', () => {
    it('debe convertir closedAt a fecha de Chile si no se provee entryDate explícito y persistir posShiftId', async () => {
      await service.registerShiftDifferenceAdjustment({
        shiftId: 'shift-1',
        shiftNumber: 7,
        closedAt: '2026-07-15T02:00:00.000Z', // 2026-07-14 22:00 America/Santiago (-04:00)
        cashDifference: -500,
      });

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(periodService.assertPeriodOpen).toHaveBeenCalledWith('2026-07-14', prisma);
      expect(prisma.accountingEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            posShiftId: 'shift-1',
            entryDate: new Date('2026-07-14T00:00:00.000Z'),
            items: {
              create: expect.arrayContaining([
                expect.objectContaining({ accountId: 'acc-6103', debit: 500, credit: 0 }),
                expect.objectContaining({ accountId: 'acc-1101', debit: 0, credit: 500 }),
              ]),
            },
          }),
        }),
      );
    });

    it('debe ser idempotente si el turno ya tiene un ajuste contable activo', async () => {
      prisma.accountingEntry.findFirst.mockResolvedValueOnce({
        id: 'existing-shift-entry',
        entryNumber: 88n,
      });

      const res = await service.registerShiftDifferenceAdjustment({
        shiftId: 'shift-1',
        shiftNumber: 7,
        closedAt: '2026-07-15T02:00:00.000Z',
        cashDifference: 300,
      });

      expect(res).toEqual({
        entryId: 'existing-shift-entry',
        entryNumber: 88,
      });
      expect(prisma.accountingEntry.create).not.toHaveBeenCalled();
    });
  });

  describe('voidEntry y aislamiento de esquema (concurrencia ACID)', () => {
    it('debe adquirir FOR UPDATE y usar updateMany condicional al anular; rechaza race con ConflictException', async () => {
      prisma.accountingEntry.findUnique.mockResolvedValueOnce({
        id: 'entry-10',
        entryNumber: 10n,
        entryDate: new Date('2026-11-10T00:00:00.000Z'),
        origin: AccountingEntryOrigin.manual,
        status: 'active',
        items: [
          { accountId: 'acc-1101', debit: 1000, credit: 0, description: 'Caja' },
          { accountId: 'acc-4101', debit: 0, credit: 1000, description: 'Venta' },
        ],
      });
      prisma.accountingEntry.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(
        service.voidEntry('entry-10', { reason: 'Error de monto' }, 'admin-1'),
      ).rejects.toThrow(ConflictException);
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(prisma.accountingEntry.create).not.toHaveBeenCalled();
    });

    it('debe usar advisory lock de Contabilidad y ser idempotente sin tocar pos_sale en registerSaleIncome', async () => {
      prisma.accountingEntry.findFirst.mockResolvedValueOnce({
        id: 'existing-sale-entry',
        entryNumber: 55n,
      });

      const res = await service.registerSaleIncome({
        id: 'sale-pending-1',
        ticketNumber: 'TK-900',
        soldAt: '2026-11-11T16:00:00.000Z',
        total: 1190,
        paymentMethod: 'efectivo',
      });

      expect(res).toEqual({ entryId: 'existing-sale-entry', entryNumber: 55 });
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(prisma.accountingEntry.create).not.toHaveBeenCalled();
    });
  });

  describe('CreateAccountingEntryDto con ValidationPipe estricto', () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    it('debe exigir formato estricto YYYY-MM-DD en entryDate', async () => {
      const baseItems = [
        {
          accountId: '11111111-1111-4111-8111-111111111111',
          debit: 1000,
          credit: 0,
        },
        {
          accountId: '22222222-2222-4222-8222-222222222222',
          debit: 0,
          credit: 1000,
        },
      ];

      await expect(
        pipe.transform(
          {
            entryDate: '2026-11-11T03:00:00.000Z',
            concept: 'Compra harina',
            items: baseItems,
          },
          { type: 'body', metatype: CreateAccountingEntryDto },
        ),
      ).rejects.toThrow(BadRequestException);

      const valid = await pipe.transform(
        {
          entryDate: '2026-11-11',
          concept: 'Compra harina',
          items: baseItems,
        },
        { type: 'body', metatype: CreateAccountingEntryDto },
      );
      expect(valid.entryDate).toBe('2026-11-11');
    });
  });

  describe('Contabilidad Perpetua de Inventario', () => {
    it('registerInventoryPurchase debe desglosar 1108 IVA Crédito en compras con factura y llevar general_supply a 6101', async () => {
      await service.registerInventoryPurchase('outbox-pur-1', {
        itemType: 'ingredient',
        itemId: 'ing-1',
        itemName: 'Harina 25kg',
        quantity: 2,
        unit: 'saco',
        totalCost: 23800,
        hasInvoice: true,
        paymentMethod: 'efectivo',
        occurredAt: '2026-11-12T15:00:00.000Z',
      });

      const items1 = prisma.accountingEntry.create.mock.calls[0][0].data.items.create;
      expect(items1).toEqual([
        expect.objectContaining({ accountId: 'acc-1105', debit: 20000, credit: 0 }),
        expect.objectContaining({ accountId: 'acc-1108', debit: 3800, credit: 0 }),
        expect.objectContaining({ accountId: 'acc-1101', debit: 0, credit: 23800 }),
      ]);

      await service.registerInventoryPurchase('outbox-pur-2', {
        itemType: 'general_supply',
        itemId: 'gs-1',
        itemName: 'Cloro Industrial',
        quantity: 1,
        unit: 'bidón',
        totalCost: 11900,
        hasInvoice: false,
        paymentMethod: 'credito_proveedor',
        occurredAt: '2026-11-12T15:30:00.000Z',
      });

      const items2 = prisma.accountingEntry.create.mock.calls[1][0].data.items.create;
      expect(items2).toEqual([
        expect.objectContaining({ accountId: 'acc-6101', debit: 11900, credit: 0 }),
        expect.objectContaining({ accountId: 'acc-2101', debit: 0, credit: 11900 }),
      ]);
    });

    it('registerProductionTransfer debe trasladar costo de 1105 a 1106 y recuperar costos faltantes desde InventoryValuationService en reintento', async () => {
      valuationService.getIngredientUnitCostsInTx.mockResolvedValueOnce(
        new Map([['ing-missing', { unitCost: 2000, unit: 'kg' }]]),
      );

      await service.registerProductionTransfer('outbox-prod-1', {
        recipeId: 'rec-1',
        recipeName: 'Kuchen',
        productId: 'prod-1',
        productName: 'Kuchen Manzana',
        batches: 1,
        unitsProduced: 8,
        totalCost: 3000,
        producedAt: '2026-11-12T15:00:00.000Z',
        missingCostIngredients: [
          { ingredientId: 'ing-missing', name: 'Manzana', deductedQty: 2 },
        ],
      });

      const items = prisma.accountingEntry.create.mock.calls[0][0].data.items.create;
      expect(items).toEqual([
        expect.objectContaining({ accountId: 'acc-1106', debit: 7000, credit: 0 }),
        expect.objectContaining({ accountId: 'acc-1105', debit: 0, credit: 7000 }),
      ]);
    });

    it('registerInventoryAdjustment debe registrar mermas en 6104 y sobrantes en 4102', async () => {
      await service.registerInventoryAdjustment('outbox-adj-waste', {
        itemType: 'product',
        itemId: 'prod-1',
        itemName: 'Torta Chocolate',
        reasonType: 'waste',
        quantityDelta: -2,
        unit: 'un',
        unitCost: 4500,
        totalCost: 9000,
        occurredAt: '2026-11-12T16:00:00.000Z',
      });

      expect(prisma.accountingEntry.create.mock.calls[0][0].data.items.create).toEqual([
        expect.objectContaining({ accountId: 'acc-6104', debit: 9000, credit: 0 }),
        expect.objectContaining({ accountId: 'acc-1106', debit: 0, credit: 9000 }),
      ]);

      await service.registerInventoryAdjustment('outbox-adj-surplus', {
        itemType: 'ingredient',
        itemId: 'ing-1',
        itemName: 'Azúcar',
        reasonType: 'recount_surplus',
        quantityDelta: 3,
        unit: 'kg',
        unitCost: 1100,
        totalCost: 3300,
        occurredAt: '2026-11-12T16:10:00.000Z',
      });

      expect(prisma.accountingEntry.create.mock.calls[1][0].data.items.create).toEqual([
        expect.objectContaining({ accountId: 'acc-1105', debit: 3300, credit: 0 }),
        expect.objectContaining({ accountId: 'acc-4102', debit: 0, credit: 3300 }),
      ]);
    });

    it('registerSaleCogs debe descargar 1106/1105 contra 5101 usando origin=inventory y devolver recoveredItemCosts sin mutar posSaleItem', async () => {
      valuationService.getSaleItemUnitCostsInTx.mockResolvedValueOnce({
        products: new Map([['prod-1', { unitCost: 3500 }]]),
        packagings: new Map(),
      });

      const result = await service.registerSaleCogs('outbox-cogs-1', {
        ticketNumber: 'TK-888',
        soldAt: '2026-11-12T17:00:00.000Z',
        items: [
          {
            saleItemId: 'sale-item-1',
            productId: 'prod-1',
            packagingId: null,
            productName: 'Pie de Limón',
            quantity: 2,
            unitCost: 0, // recuperado en reintento -> 3500
          },
          {
            productId: null,
            packagingId: 'pack-1',
            productName: 'Bolsa Kraft',
            quantity: 2,
            unitCost: 50,
          },
        ],
      });

      expect(result).toEqual({
        entryId: 'entry-1',
        entryNumber: 1,
        recoveredItemCosts: [{ saleItemId: 'sale-item-1', unitCost: 3500 }],
      });

      const createArg = prisma.accountingEntry.create.mock.calls[0][0];
      expect(createArg.data.origin).toBe(AccountingEntryOrigin.inventory);
      expect(createArg.data.outboxId).toBe('outbox-cogs-1');
      expect(createArg.data.items.create).toEqual([
        expect.objectContaining({ accountId: 'acc-5101', debit: 7100, credit: 0 }),
        expect.objectContaining({ accountId: 'acc-1106', debit: 0, credit: 7000 }),
        expect.objectContaining({ accountId: 'acc-1105', debit: 0, credit: 100 }),
      ]);
    });
  });
});

