import { Test, TestingModule } from '@nestjs/testing';
import { FinancialReportService } from './financial-report.service';
import { PrismaService } from '../../database/prisma.service';

describe('FinancialReportService', () => {
  let service: FinancialReportService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      accountingAccount: {
        findMany: jest.fn(),
      },
      ingredient: {
        findMany: jest.fn(),
      },
      product: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialReportService,
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
          code: '4101',
          name: 'Venta de Pastelería y Bollería',
          accountType: 'ingreso',
          entryItems: [
            { debit: 0, credit: 1000000 }, // 1.000.000 ingreso
          ],
        },
        {
          id: 'acc-costo-1',
          code: '5101',
          name: 'Costo de Materias Primas e Insumos',
          accountType: 'costo',
          entryItems: [
            { debit: 350000, credit: 0 }, // 350.000 costo materias primas
          ],
        },
        {
          id: 'acc-gasto-1',
          code: '6101',
          name: 'Gastos Operativos y Remuneraciones',
          accountType: 'gasto',
          entryItems: [
            { debit: 250000, credit: 0 }, // 250.000 sueldos, arriendo, luz
          ],
        },
      ];

      prisma.accountingAccount.findMany.mockResolvedValue(mockAccounts);

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
          code: '1101',
          name: 'Caja General Efectivo',
          accountType: 'activo',
          entryItems: [{ debit: 500000, credit: 0 }],
        },
        {
          id: 'acc-1105',
          code: '1105',
          name: 'Inventario Materias Primas',
          accountType: 'activo',
          entryItems: [{ debit: 600000, credit: 0 }],
        },
        {
          id: 'acc-1106',
          code: '1106',
          name: 'Inventario Productos Terminados',
          accountType: 'activo',
          entryItems: [{ debit: 400000, credit: 0 }],
        },
        // Pasivos: $500.000
        {
          id: 'acc-2101',
          code: '2101',
          name: 'Proveedores por Pagar',
          accountType: 'pasivo',
          entryItems: [{ debit: 0, credit: 400000 }],
        },
        {
          id: 'acc-2102',
          code: '2102',
          name: 'IVA Débito Fiscal',
          accountType: 'pasivo',
          entryItems: [{ debit: 0, credit: 100000 }],
        },
        // Patrimonio: $700.000
        {
          id: 'acc-3101',
          code: '3101',
          name: 'Capital Social Inicial',
          accountType: 'patrimonio',
          entryItems: [{ debit: 0, credit: 700000 }],
        },
        // Resultados acumulados del período: Utilidad de $300.000
        {
          id: 'acc-4101',
          code: '4101',
          name: 'Ventas de Pastelería',
          accountType: 'ingreso',
          entryItems: [{ debit: 0, credit: 800000 }],
        },
        {
          id: 'acc-5101',
          code: '5101',
          name: 'Costo de Materias Primas',
          accountType: 'costo',
          entryItems: [{ debit: 300000, credit: 0 }],
        },
        {
          id: 'acc-6101',
          code: '6101',
          name: 'Gastos Operativos',
          accountType: 'gasto',
          entryItems: [{ debit: 200000, credit: 0 }],
        },
      ];

      const mockIngredients = [
        { id: 'ing-1', name: 'Harina Selecta', stock: 50, unit: 'kg', price: 1200 },
        { id: 'ing-2', name: 'Mantequilla Colún', stock: 20, unit: 'kg', price: 6500 },
      ];

      const mockProducts = [
        { id: 'prod-1', name: 'Torta Selva Negra', stock: 15, unit: 'un', costPrice: 8000, salePrice: 15000 },
      ];

      prisma.accountingAccount.findMany.mockResolvedValue(mockAccounts);
      prisma.ingredient.findMany.mockResolvedValue(mockIngredients);
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
      // Torta: 15 * 8000 = 120.000
      expect(balanceSheet.inventoryValuation.finishedProductsValue).toBe(120000);
      expect(balanceSheet.inventoryValuation.totalWarehouseValue).toBe(310000);
    });
  });
});

