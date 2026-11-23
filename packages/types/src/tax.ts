export interface TaxPeriodQuery {
  year: number;
  month: number;
  previousRemanent?: number;
  ppmRate?: number;
}

export interface VatTotals {
  documentCount: number;
  netAmount: number;
  vatAmount: number;
  totalAmount: number;
}

export interface F29Draft {
  period: {
    year: number;
    month: number;
    label: string;
  };
  sales: VatTotals;
  purchases: VatTotals;
  previousRemanent: number;
  grossVatPayable: number;
  netVatPayable: number;
  newRemanent: number;
  ppmRate: number;
  ppmAmount: number;
  totalTaxToPay: number;
}

export interface SalesBookEntry {
  id: string;
  date: string;
  documentType: string;
  documentNumber: string;
  paymentMethod: string;
  netAmount: number;
  vatAmount: number;
  totalAmount: number;
  customerName?: string | null;
}

export interface PurchasesBookEntry {
  id: string;
  date: string;
  documentType: string;
  documentNumber: string;
  supplierName: string;
  supplierRut?: string | null;
  netAmount: number;
  vatAmount: number;
  totalAmount: number;
  source: 'supplier_invoice' | 'inventory_purchase';
}

export interface SalesBookResponse {
  period: {
    year: number;
    month: number;
    label: string;
  };
  totals: VatTotals;
  entries: SalesBookEntry[];
}

export interface PurchasesBookResponse {
  period: {
    year: number;
    month: number;
    label: string;
  };
  totals: VatTotals;
  entries: PurchasesBookEntry[];
}

export interface VatSummaryResponse {
  f29: F29Draft;
  accountingReconciliation: {
    accountVatDebitBalance: number; // Saldo cuenta 2102 IVA Débito Fiscal
    accountVatCreditBalance: number; // Saldo cuenta 1108 IVA Crédito Fiscal
    isReconciled: boolean;
    notes?: string;
  };
}
