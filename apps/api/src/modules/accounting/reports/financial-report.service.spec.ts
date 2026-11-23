import { Test, TestingModule } from '@nestjs/testing';
import { FinancialReportService } from './financial-report.service';
import { InventoryValuationService } from '../../inventory/valuation/inventory-valuation.service';
import { PrismaService } from '../../../database/prisma.service';

describe('FinancialReportService', () => {
  let service: FinancialReportService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      accountingAccount: {
        findMany: jest.fn(),
      },
      accountingEntryItem: {
        groupBy: jest.fn().mockResolvedValue([]),
      },
      accountingEntry: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      ingredient: {
        findMany: jest.fn(),
      },
      packaging: {
        findMany: jest.fn(),
      },
      product: {
        findMany: jest.fn(),
      },
      generalSupply: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialReportService,
        InventoryValuationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<FinancialReportService>(FinancialReportService);
  });

  describe('getIncomeStatement', () => {
    it('debe calcular formalmente Margen Bruto y Utilidad Neta según fórmula contable', async () => {
      const mockAccounts = [
        {
          id: 'acc-ingreso-1',
          code: '4.1.01.01',
          name: 'Venta de Pastelería y Bollería',
          accountType: 'ingreso',
        },
        {
          id: 'acc-costo-1',
          code: '5.1.01.01',
          name: 'Costo de Materias Primas e Insumos',
          accountType: 'costo',
        },
        {
          id: 'acc-gasto-1',
          code: '6.1.01.01',
          name: 'Gastos Operativos y Remuneraciones',
          accountType: 'gasto',
        },
      ];

      prisma.accountingAccount.findMany.mockResolvedValue(mockAccounts);
      prisma.accountingEntryItem.groupBy.mockResolvedValue([
        { accountId: 'acc-ingreso-1', _sum: { debit: 0, credit: 1000000 } },
        { accountId: 'acc-costo-1', _sum: { debit: 350000, credit: 0 } },
        { accountId: 'acc-gasto-1', _sum: { debit: 250000, credit: 0 } },
      ]);

      const report = await service.getIncomeStatement('2026-11-01', '2026-11-30');

      // 1. Ingresos Operacionales: $1.000.000
      expect(report.ingresosOperacionales.total).toBe(1000000);

      // 2. Costos de Materias Primas: $350.000
      expect(report.costosMateriasPrimas.total).toBe(350000);

      // 3. Margen Bruto = 1.000.000 - 350.000 = $650.000 (65%)
      expect(report.margenBruto).toBe(650000);
      expect(report.margenBrutoPercentage).toBe(65);

      // 4. Gastos Operacionales = $250.000
      expect(report.gastosOperacionales.total).toBe(250000);

      // 5. Utilidad Neta = 650.000 - 250.000 = $400.000 (40%)
      expect(report.utilidadNeta).toBe(400000);
      expect(report.margenNetoPercentage).toBe(40);
    });
  });

  describe('getBalanceSheet', () => {
    it('debe cuadrar formalmente la ecuación Activo = Pasivo + Patrimonio', async () => {
      const mockAccounts = [
        // Activos: $1.500.000
        {
          id: 'acc-1101',
          code: '1.1.01.01',
          name: 'Caja General Efectivo',
          accountType: 'activo',
        },
        {
          id: 'acc-1105',
          code: '1.1.02.01',
          name: 'Inventario Materias Primas',
          accountType: 'activo',
        },
        {
          id: 'acc-1106',
          code: '1.1.02.02',
          name: 'Inventario Productos Terminados',
          accountType: 'activo',
        },
        // Pasivos: $500.000
        {
          id: 'acc-2101',
          code: '2.1.01.01',
          name: 'Proveedores por Pagar',
          accountType: 'pasivo',
        },
        {
          id: 'acc-2102',
          code: '2.1.02.01',
          name: 'IVA Débito Fiscal',
          accountType: 'pasivo',
        },
        // Patrimonio: $700.000
        {
          id: 'acc-3101',
          code: '3.1.01.01',
          name: 'Capital Social Inicial',
          accountType: 'patrimonio',
        },
        // Resultados acumulados del período: Utilidad de $300.000
        {
          id: 'acc-4101',
          code: '4.1.01.01',
          name: 'Ventas de Pastelería',
          accountType: 'ingreso',
        },
        {
          id: 'acc-5101',
          code: '5.1.01.01',
          name: 'Costo de Materias Primas',
          accountType: 'costo',
        },
        {
          id: 'acc-6101',
          code: '6.1.01.01',
          name: 'Gastos Operativos',
          accountType: 'gasto',
        },
      ];

      const mockIngredients = [
        { id: 'ing-1', name: 'Harina Selecta', stock: 50, unit: 'kg', price: 1200 },
        { id: 'ing-2', name: 'Mantequilla Colún', stock: 20, unit: 'kg', price: 6500 },
      ];

      const mockPackaging = [
        { id: 'pack-1', name: 'Caja Torta Kraft 26cm', stock: 100, unit: 'un', costPrice: 500 },
      ];

      const mockProducts = [
        { id: 'prod-1', name: 'Torta Selva Negra', stock: 15, unit: 'un', costPrice: 8000, salePrice: 15000 },
      ];

      prisma.accountingAccount.findMany.mockResolvedValue(mockAccounts);
      prisma.accountingEntryItem.groupBy.mockResolvedValue([
        { accountId: 'acc-1101', _sum: { debit: 500000, credit: 0 } },
        { accountId: 'acc-1105', _sum: { debit: 600000, credit: 0 } },
        { accountId: 'acc-1106', _sum: { debit: 400000, credit: 0 } },
        { accountId: 'acc-2101', _sum: { debit: 0, credit: 400000 } },
        { accountId: 'acc-2102', _sum: { debit: 0, credit: 100000 } },
        { accountId: 'acc-3101', _sum: { debit: 0, credit: 700000 } },
        { accountId: 'acc-4101', _sum: { debit: 0, credit: 800000 } },
        { accountId: 'acc-5101', _sum: { debit: 300000, credit: 0 } },
        { accountId: 'acc-6101', _sum: { debit: 200000, credit: 0 } },
      ]);
      prisma.ingredient.findMany.mockResolvedValue(mockIngredients);
      prisma.packaging.findMany.mockResolvedValue(mockPackaging);
      prisma.product.findMany.mockResolvedValue(mockProducts);

      const balanceSheet = await service.getBalanceSheet('2026-11-30');

      // 1. Total Activos = 500.000 + 600.000 + 400.000 = $1.500.000
      expect(balanceSheet.activos.total).toBe(1500000);
      expect(balanceSheet.activos.disponible.total).toBe(500000);
      expect(balanceSheet.activos.inventarios.total).toBe(1000000);

      // 2. Total Pasivos = 400.000 + 100.000 = $500.000
      expect(balanceSheet.pasivos.total).toBe(500000);
      expect(balanceSheet.pasivos.obligaciones.total).toBe(400000);

      // 3. Resultado del Ejercicio = 800.000 - 300.000 - 200.000 = $300.000
      expect(balanceSheet.patrimonio.resultadoEjercicio).toBe(300000);

      // 4. Total Patrimonio = Capital (700.000) + Resultado (300.000) = $1.000.000
      expect(balanceSheet.patrimonio.total).toBe(1000000);

      // 5. Ecuación Contable: Activo (1.500.000) = Pasivo (500.000) + Patrimonio (1.000.000)
      expect(balanceSheet.totalPasivoMasPatrimonio).toBe(1500000);
      expect(balanceSheet.isBalanced).toBe(true);
      expect(balanceSheet.difference).toBe(0);

      // 6. Valorización de bodega
      // Harina: 50 * 1200 = 60.000 | Mantequilla: 20 * 6500 = 130.000 -> 190.000
      expect(balanceSheet.inventoryValuation.rawMaterialsValue).toBe(190000);
      // Empaques: 100 * 500 = 50.000
      expect(balanceSheet.inventoryValuation.packagingValue).toBe(50000);
      // Torta: 15 * 8000 = 120.000
      expect(balanceSheet.inventoryValuation.finishedProductsValue).toBe(120000);
      expect(balanceSheet.inventoryValuation.totalWarehouseValue).toBe(360000);
    });

    it('debe distinguir entre Capital (3.1.01.01), Resultados Acumulados (3.1.02.02) y Resultado del Ejercicio en el Balance General', async () => {
      const mockAccounts = [
        {
          id: 'acc-1101',
          code: '1.1.01.01',
          name: 'Caja General Efectivo',
          accountType: 'activo',
        },
        {
          id: 'acc-3101',
          code: '3.1.01.01',
          name: 'Capital Social Inicial',
          accountType: 'patrimonio',
        },
        {
          id: 'acc-3103',
          code: '3.1.02.02',
          name: 'Resultados Acumulados (Ejercicios Anteriores)',
          accountType: 'patrimonio',
        },
        {
          id: 'acc-4101',
          code: '4.1.01.01',
          name: 'Ventas de Pastelería',
          accountType: 'ingreso',
        },
        {
          id: 'acc-6101',
          code: '6.1.01.01',
          name: 'Gastos Operativos',
          accountType: 'gasto',
        },
      ];

      prisma.accountingAccount.findMany.mockResolvedValue(mockAccounts);
      prisma.accountingEntryItem.groupBy.mockResolvedValue([
        { accountId: 'acc-1101', _sum: { debit: 1500000, credit: 0 } },
        { accountId: 'acc-3101', _sum: { debit: 0, credit: 800000 } },
        { accountId: 'acc-3103', _sum: { debit: 0, credit: 400000 } },
        { accountId: 'acc-4101', _sum: { debit: 0, credit: 500000 } },
        { accountId: 'acc-6101', _sum: { debit: 200000, credit: 0 } },
      ]);
      prisma.ingredient.findMany.mockResolvedValue([]);
      prisma.packaging.findMany.mockResolvedValue([]);
      prisma.product.findMany.mockResolvedValue([]);

      const balanceSheet = await service.getBalanceSheet('2026-11-30');

      // Activos: $1.500.000
      expect(balanceSheet.activos.total).toBe(1500000);

      // Pasivos: $0
      expect(balanceSheet.pasivos.total).toBe(0);

      // Capital (3.1.01.01): $800.000
      expect(balanceSheet.patrimonio.capital.total).toBe(800000);
      expect(balanceSheet.patrimonio.capital.accounts).toHaveLength(1);
      expect(balanceSheet.patrimonio.capital.accounts[0].code).toBe('3.1.01.01');

      // Resultados Acumulados (3.1.02.02): $400.000
      expect(balanceSheet.patrimonio.resultadosAcumulados?.total).toBe(400000);
      expect(balanceSheet.patrimonio.resultadosAcumulados?.accounts).toHaveLength(1);
      expect(balanceSheet.patrimonio.resultadosAcumulados?.accounts[0].code).toBe('3.1.02.02');

      // Resultado del Ejercicio (Ingresos 500.000 - Gastos 200.000): $300.000
      expect(balanceSheet.patrimonio.resultadoEjercicio).toBe(300000);

      // Total Patrimonio: 800.000 + 400.000 + 300.000 = $1.500.000
      expect(balanceSheet.patrimonio.total).toBe(1500000);

      // Ecuación Contable: Activos ($1.500.000) = Pasivos ($0) + Patrimonio ($1.500.000)
      expect(balanceSheet.isBalanced).toBe(true);
      expect(balanceSheet.difference).toBe(0);
    });
  });
});

