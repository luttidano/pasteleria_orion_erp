import type {
  PosPaymentMethod,
  PosSaleAccountingStatus,
  PosSaleDataOrigin,
  PosSaleStatus,
  PosSalesTotals,
  PosShiftAccountingStatus,
  PosShiftRecord,
  PosShiftStatus,
} from '@repo/types';
import { roundMoney } from '../../common/utils/money.util';

export function emptySalesTotals(): PosSalesTotals {
  return {
    totalSales: 0,
    transactionsCount: 0,
    cashSalesTotal: 0,
    cardPosTotal: 0,
    debitTotal: 0,
    creditTotal: 0,
    transferTotal: 0,
  };
}

export function aggregateSalesTotals(
  grouped: Array<{
    paymentMethod: string;
    _sum: { total: unknown };
    _count: { _all: number };
  }>,
): PosSalesTotals {
  let cashSalesTotal = 0;
  let debitTotal = 0;
  let creditTotal = 0;
  let transferTotal = 0;
  let transactionsCount = 0;

  for (const row of grouped) {
    const amount = Number(row._sum.total ?? 0);
    const count = row._count._all ?? 0;
    transactionsCount += count;

    switch (row.paymentMethod) {
      case 'efectivo':
        cashSalesTotal += amount;
        break;
      case 'debito':
        debitTotal += amount;
        break;
      case 'credito':
        creditTotal += amount;
        break;
      case 'transferencia':
        transferTotal += amount;
        break;
    }
  }

  cashSalesTotal = roundMoney(cashSalesTotal);
  debitTotal = roundMoney(debitTotal);
  creditTotal = roundMoney(creditTotal);
  transferTotal = roundMoney(transferTotal);
  const cardPosTotal = roundMoney(debitTotal + creditTotal);
  const totalSales = roundMoney(cashSalesTotal + cardPosTotal + transferTotal);

  return {
    totalSales,
    transactionsCount,
    cashSalesTotal,
    cardPosTotal,
    debitTotal,
    creditTotal,
    transferTotal,
  };
}

export function mapSaleRecord(sale: {
  id: string;
  ticketNumber: string;
  paymentMethod: string;
  subtotal: unknown;
  taxAmount: unknown;
  total: unknown;
  status: string;
  accountingStatus?: string | null;
  accountingError?: string | null;
  soldAt: Date;
  dataOrigin: string;
  createdBy?: { id: string; name: string; role: string } | null;
  items: Array<{
    id: string;
    saleId: string;
    productId: string | null;
    packagingId?: string | null;
    productName: string;
    quantity: number;
    unitPrice: unknown;
    lineTotal: unknown;
  }>;
}) {
  return {
    id: sale.id,
    ticketNumber: sale.ticketNumber,
    paymentMethod: sale.paymentMethod as PosPaymentMethod,
    subtotal: Number(sale.subtotal),
    taxAmount: Number(sale.taxAmount),
    total: Number(sale.total),
    status: sale.status as PosSaleStatus,
    accountingStatus: (sale.accountingStatus ?? 'posted') as PosSaleAccountingStatus,
    accountingError: sale.accountingError ?? null,
    soldAt: sale.soldAt.toISOString(),
    dataOrigin: sale.dataOrigin as PosSaleDataOrigin,
    cashierName: sale.createdBy?.name || 'Cajero no asignado',
    cashierRole: sale.createdBy?.role || 'cashier',
    items: sale.items.map((item) => ({
      id: item.id,
      saleId: item.saleId,
      productId: item.productId,
      packagingId: item.packagingId ?? null,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.lineTotal),
    })),
  };
}

export function mapShiftRecord(shift: {
  id: string;
  shiftNumber: bigint;
  status: string;
  openedAt: Date;
  openedBy?: { id: string; name: string } | null;
  closedAt: Date | null;
  closedBy?: { id: string; name: string } | null;
  openingCash: unknown;
  totalSales: unknown;
  transactionsCount: number;
  cashSalesTotal: unknown;
  debitTotal: unknown;
  creditTotal: unknown;
  transferTotal: unknown;
  cardPosTotal: unknown;
  expectedCash: unknown;
  countedCash: unknown;
  cashDifference: unknown;
  notes: string | null;
  closingEntryId: string | null;
  closingEntry?: { id: string; entryNumber: bigint } | null;
  accountingStatus: string;
  accountingWarning: string | null;
}): PosShiftRecord {
  return {
    id: shift.id,
    shiftNumber: Number(shift.shiftNumber),
    status: shift.status as PosShiftStatus,
    openedAt: shift.openedAt.toISOString(),
    openedBy: shift.openedBy ?? null,
    closedAt: shift.closedAt ? shift.closedAt.toISOString() : null,
    closedBy: shift.closedBy ?? null,
    openingCash: Number(shift.openingCash),
    totalSales: Number(shift.totalSales),
    transactionsCount: shift.transactionsCount,
    cashSalesTotal: Number(shift.cashSalesTotal),
    debitTotal: Number(shift.debitTotal),
    creditTotal: Number(shift.creditTotal),
    transferTotal: Number(shift.transferTotal),
    cardPosTotal: Number(shift.cardPosTotal),
    expectedCash: Number(shift.expectedCash),
    countedCash:
      shift.countedCash !== null && shift.countedCash !== undefined
        ? Number(shift.countedCash)
        : null,
    cashDifference:
      shift.cashDifference !== null && shift.cashDifference !== undefined
        ? Number(shift.cashDifference)
        : null,
    notes: shift.notes ?? null,
    closingEntryId: shift.closingEntryId ?? null,
    closingEntryNumber: shift.closingEntry
      ? Number(shift.closingEntry.entryNumber)
      : null,
    accountingStatus: shift.accountingStatus as PosShiftAccountingStatus,
    accountingWarning: shift.accountingWarning ?? null,
  };
}
