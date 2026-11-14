export type PosPaymentMethod =
  | 'efectivo'
  | 'debito'
  | 'credito'
  | 'transferencia';

export type PosSaleStatus = 'completada' | 'anulada';
export type PosSaleAccountingStatus = 'posted' | 'pending';
export type PosSaleDataOrigin = 'demo' | 'real';

export interface PosSaleItem {
  id: string;
  saleId: string;
  productId: string | null;
  packagingId: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PosSaleRecord {
  id: string;
  ticketNumber: string;
  paymentMethod: PosPaymentMethod;
  subtotal: number;
  taxAmount: number;
  total: number;
  status: PosSaleStatus;
  accountingStatus: PosSaleAccountingStatus;
  accountingError?: string | null;
  accountingWarning?: string | null;
  accountingEntryCreated?: boolean;
  soldAt: string;
  dataOrigin: PosSaleDataOrigin;
  cashierName: string;
  cashierRole: string;
  items: PosSaleItem[];
}

export interface CreatePosSaleItemInput {
  productId?: string;
  packagingId?: string;
  quantity: number;
}

export interface CreatePosSaleData {
  paymentMethod: PosPaymentMethod;
  items: CreatePosSaleItemInput[];
}

export interface PosSalesTotals {
  totalSales: number;
  transactionsCount: number;
  cashSalesTotal: number;
  cardPosTotal: number;
  debitTotal: number;
  creditTotal: number;
  transferTotal: number;
}

export interface PosSalesSummary extends PosSalesTotals {
  from: string;
  to: string;
}

export type PosShiftStatus = 'abierto' | 'cerrado';
export type PosShiftAccountingStatus = 'none' | 'posted' | 'pending';

export interface PosShiftRecord {
  id: string;
  shiftNumber: number;
  status: PosShiftStatus;
  openedAt: string;
  openedBy: { id: string; name: string } | null;
  closedAt: string | null;
  closedBy: { id: string; name: string } | null;
  openingCash: number;
  totalSales: number;
  transactionsCount: number;
  cashSalesTotal: number;
  debitTotal: number;
  creditTotal: number;
  transferTotal: number;
  cardPosTotal: number;
  expectedCash: number;
  countedCash: number | null;
  cashDifference: number | null;
  notes: string | null;
  closingEntryId: string | null;
  closingEntryNumber: number | null;
  accountingStatus: PosShiftAccountingStatus;
  accountingWarning: string | null;
}

export interface PosActiveShiftOverview extends PosSalesTotals {
  businessDate?: string;
  hasOpenShift: boolean;
  activeShiftId: string | null;
  shiftNumber: number | null;
  openedAt: string | null;
  openedByName: string | null;
  openingCash: number;
  expectedCash: number;
  lastClosedShift: {
    id: string;
    shiftNumber: number;
    closedAt: string;
    closedByName: string;
    totalSales: number;
    expectedCash: number;
    countedCash: number;
    cashDifference: number;
  } | null;
}
