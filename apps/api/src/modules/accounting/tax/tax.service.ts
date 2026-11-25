import { Injectable, Optional } from '@nestjs/common';
import type {
  PurchasesBookEntry,
  PurchasesBookResponse,
  SalesBookEntry,
  SalesBookResponse,
  VatSummaryResponse,
} from '@repo/types';
import { SYSTEM_ACCOUNT_CODES } from '../accounting.constants';
import { PrismaService } from '../../../database/prisma.service';
import {
  getChileMonthDateRangeUtc,
  getMonthDateRangeUtc,
  getZonedDateString,
  STORE_TIMEZONE,
} from '../../../common/utils/chile-time.util';
import { roundMoney } from '../../../common/utils/money.util';
import { TaxPeriodQueryDto } from './dto/tax-query.dto';
import { TaxCalculatorService } from './tax-calculator.service';
import { PosSalesReaderService } from '../../pos/pos-sales-reader.service';

const MONTH_NAMES = [
  '',
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

@Injectable()
export class TaxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posSalesReader: PosSalesReaderService,
    @Optional() private readonly taxCalculator?: TaxCalculatorService,
  ) {}

  private getCalculator(): TaxCalculatorService {
    return this.taxCalculator ?? new TaxCalculatorService();
  }

  /**
   * Genera el Libro de Ventas para el período mensual (Chile / SII).
   * Consulta las ventas completadas del POS a través de PosSalesReaderService,
   * calculando base neta e IVA Débito Fiscal (19%).
   */
  async getSalesBook(dto: TaxPeriodQueryDto): Promise<SalesBookResponse> {
    const { start, end } = getChileMonthDateRangeUtc(
      dto.year,
      dto.month,
      STORE_TIMEZONE,
    );

    const sales = await this.posSalesReader.findCompletedSalesInRange(
      start,
      end,
    );

    const calculator = this.getCalculator();
    const entries: SalesBookEntry[] = sales.map((sale) => {
      const breakdown = calculator.breakdownFromGross(Number(sale.total));
      const dateStr = getZonedDateString(sale.soldAt, STORE_TIMEZONE);

      return {
        id: sale.id,
        date: dateStr,
        documentType: 'Boleta Electrónica',
        documentNumber: sale.ticketNumber,
        paymentMethod: sale.paymentMethod,
        netAmount: breakdown.netAmount,
        vatAmount: breakdown.vatAmount,
        totalAmount: breakdown.totalAmount,
        customerName: 'Consumidor Final',
      };
    });

    const totalNet = roundMoney(
      entries.reduce((acc, item) => acc + item.netAmount, 0),
    );
    const totalVat = roundMoney(
      entries.reduce((acc, item) => acc + item.vatAmount, 0),
    );
    const totalAmount = roundMoney(
      entries.reduce((acc, item) => acc + item.totalAmount, 0),
    );

    return {
      period: {
        year: dto.year,
        month: dto.month,
        label: `${MONTH_NAMES[dto.month]} ${dto.year}`,
      },
      totals: {
        documentCount: entries.length,
        netAmount: totalNet,
        vatAmount: totalVat,
        totalAmount,
      },
      entries,
    };
  }

  /**
   * Genera el Libro de Compras para el período mensual (Chile / SII).
   * Consulta las facturas de proveedores activas y asientos de compras con factura.
   */
  async getPurchasesBook(dto: TaxPeriodQueryDto): Promise<PurchasesBookResponse> {
    const { start: utcMonthStart, end: utcMonthEnd } = getMonthDateRangeUtc(
      dto.year,
      dto.month,
    );

    const invoices = await this.prisma.supplierInvoice.findMany({
      where: {
        issueDate: { gte: utcMonthStart, lte: utcMonthEnd },
        status: { not: 'voided' },
        hasInvoice: true,
      },
      include: {
        supplier: { select: { id: true, name: true, rut: true } },
      },
      orderBy: { issueDate: 'asc' },
    });

    const calculator = this.getCalculator();
    const entries: PurchasesBookEntry[] = invoices.map((inv) => {
      const breakdown = calculator.breakdownFromGross(Number(inv.totalAmount));

      return {
        id: inv.id,
        date: inv.issueDate.toISOString().slice(0, 10),
        documentType: 'Factura Proveedor',
        documentNumber: inv.invoiceNumber,
        supplierName: inv.supplier.name,
        supplierRut: inv.supplier.rut || null,
        netAmount: breakdown.netAmount,
        vatAmount: breakdown.vatAmount,
        totalAmount: breakdown.totalAmount,
        source: 'supplier_invoice',
      };
    });

    // Detectar compras directas registradas contablemente en 1.1.03.01 (IVA Crédito Fiscal) sin registro previo en CxP
    const existingDocNumbers = new Set(
      entries.map((e) => e.documentNumber.toLowerCase().trim()),
    );

    const purchaseEntries = await this.prisma.accountingEntry.findMany({
      where: {
        status: 'active',
        entryDate: { gte: utcMonthStart, lte: utcMonthEnd },
        items: {
          some: {
            account: { code: SYSTEM_ACCOUNT_CODES.VAT_CREDIT },
            debit: { gt: 0 },
          },
        },
      },
      include: {
        outbox: { select: { referenceCode: true } },
        items: {
          include: { account: true },
        },
      },
      orderBy: { entryDate: 'asc' },
    });

    for (const entry of purchaseEntries) {
      const refCode =
        entry.outbox?.referenceCode?.trim() || `AS-#${Number(entry.entryNumber)}`;
      const isAlreadyTracked =
        existingDocNumbers.has(refCode.toLowerCase()) ||
        Array.from(existingDocNumbers).some((docNum) =>
          entry.concept.toLowerCase().includes(docNum),
        );

      if (!isAlreadyTracked) {
        const vatItem = entry.items.find(
          (i) =>
            i.account.code === SYSTEM_ACCOUNT_CODES.VAT_CREDIT &&
            Number(i.debit) > 0,
        );
        const vatAmount = roundMoney(Number(vatItem?.debit ?? 0));
        const netItem = entry.items.find(
          (i) =>
            (i.account.code === SYSTEM_ACCOUNT_CODES.RAW_MATERIALS_INVENTORY ||
              i.account.code === SYSTEM_ACCOUNT_CODES.OPERATING_EXPENSES) &&
            Number(i.debit) > 0,
        );
        const netAmount = roundMoney(
          Number(netItem?.debit ?? calculator.netFromVat(vatAmount)),
        );
        const totalAmount = roundMoney(netAmount + vatAmount);

        entries.push({
          id: entry.id,
          date: entry.entryDate.toISOString().slice(0, 10),
          documentType: 'Factura Compra Insumos',
          documentNumber: refCode,
          supplierName: 'Proveedor Insumos',
          supplierRut: null,
          netAmount,
          vatAmount,
          totalAmount,
          source: 'inventory_purchase',
        });
      }
    }

    const totalNet = roundMoney(
      entries.reduce((acc, item) => acc + item.netAmount, 0),
    );
    const totalVat = roundMoney(
      entries.reduce((acc, item) => acc + item.vatAmount, 0),
    );
    const totalAmount = roundMoney(
      entries.reduce((acc, item) => acc + item.totalAmount, 0),
    );

    return {
      period: {
        year: dto.year,
        month: dto.month,
        label: `${MONTH_NAMES[dto.month]} ${dto.year}`,
      },
      totals: {
        documentCount: entries.length,
        netAmount: totalNet,
        vatAmount: totalVat,
        totalAmount,
      },
      entries,
    };
  }

  /**
   * Calcula el Balance Mensual de IVA y genera el borrador para el Formulario 29 (F29).
   * Determina: IVA Débito - (IVA Crédito + Remanente) => IVA a Pagar o Nuevo Remanente a Favor.
   * Realiza además la cuadratura contable contra las cuentas 2.1.02.01 y 1.1.03.01 del Libro Mayor.
   */
  async getVatSummary(dto: TaxPeriodQueryDto): Promise<VatSummaryResponse> {
    const salesBook = await this.getSalesBook(dto);
    const purchasesBook = await this.getPurchasesBook(dto);

    const previousRemanent = roundMoney(Math.max(0, dto.previousRemanent ?? 0));
    const ppmRate = Math.max(0, dto.ppmRate ?? 0.25); // 0.25% tasa estándar ProPyme en Chile

    const salesVat = salesBook.totals.vatAmount;
    const purchasesVat = purchasesBook.totals.vatAmount;

    const grossVatPayable = roundMoney(salesVat - purchasesVat);
    const taxDifference = roundMoney(
      salesVat - (purchasesVat + previousRemanent),
    );

    const netVatPayable = taxDifference > 0 ? taxDifference : 0;
    const newRemanent =
      taxDifference < 0 ? roundMoney(Math.abs(taxDifference)) : 0;

    const ppmAmount = roundMoney(
      salesBook.totals.netAmount * (ppmRate / 100),
    );
    const totalTaxToPay = roundMoney(netVatPayable + ppmAmount);

    // Conciliación con las cuentas del Libro Mayor 2.1.02.01 y 1.1.01.04
    const { start: utcMonthStart, end: utcMonthEnd } = getMonthDateRangeUtc(
      dto.year,
      dto.month,
    );

    const vatDebitItems = await this.prisma.accountingEntryItem.findMany({
      where: {
        account: {
          code: SYSTEM_ACCOUNT_CODES.VAT_DEBIT,
        },
        entry: {
          status: 'active',
          entryDate: { gte: utcMonthStart, lte: utcMonthEnd },
        },
      },
      select: { debit: true, credit: true },
    });

    const vatCreditItems = await this.prisma.accountingEntryItem.findMany({
      where: {
        account: {
          code: SYSTEM_ACCOUNT_CODES.VAT_CREDIT,
        },
        entry: {
          status: 'active',
          entryDate: { gte: utcMonthStart, lte: utcMonthEnd },
        },
      },
      select: { debit: true, credit: true },
    });

    const accountVatDebitBalance = roundMoney(
      vatDebitItems.reduce(
        (acc, item) => acc + Number(item.credit) - Number(item.debit),
        0,
      ),
    );

    const accountVatCreditBalance = roundMoney(
      vatCreditItems.reduce(
        (acc, item) => acc + Number(item.debit) - Number(item.credit),
        0,
      ),
    );

    const isSalesVatReconciled =
      Math.abs(salesVat - accountVatDebitBalance) <= 1;
    const isPurchasesVatReconciled =
      Math.abs(purchasesVat - accountVatCreditBalance) <= 1;
    const isReconciled = isSalesVatReconciled && isPurchasesVatReconciled;

    return {
      f29: {
        period: {
          year: dto.year,
          month: dto.month,
          label: `${MONTH_NAMES[dto.month]} ${dto.year}`,
        },
        sales: salesBook.totals,
        purchases: purchasesBook.totals,
        previousRemanent,
        grossVatPayable,
        netVatPayable,
        newRemanent,
        ppmRate,
        ppmAmount,
        totalTaxToPay,
      },
      accountingReconciliation: {
        accountVatDebitBalance,
        accountVatCreditBalance,
        isReconciled,
        notes: isReconciled
          ? 'Cuadratura perfecta: Los auxiliares de compras y ventas coinciden con el Libro Mayor.'
          : 'Aviso: Existen leves diferencias entre los registros auxiliares y los asientos del Libro Mayor (revisar asientos manuales o pendientes de sincronización).',
      },
    };
  }
}
