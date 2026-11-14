import type { InventoryValuationReport } from './inventory.js';

export type AccountingAccountType =
  | 'activo'
  | 'pasivo'
  | 'patrimonio'
  | 'ingreso'
  | 'costo'
  | 'gasto';

export interface AccountingAccount {
  id: string;
  code: string;
  name: string;
  accountType: AccountingAccountType | string;
  isActive: boolean;
}

export type AccountingPeriodStatus = 'abierto' | 'cerrado';
export type AccountingEntryOrigin =
  | 'manual'
  | 'pos'
  | 'inventory'
  | 'closing'
  | 'reversal';
export type AccountingEntryStatus = 'active' | 'voided';

export interface AccountingEntryItem {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType?: AccountingAccountType | string;
  debit: number;
  credit: number;
  description?: string | null;
}

export interface AccountingEntry {
  id: string;
  entryNumber: number;
  entryDate: string;
  concept: string;
  origin: AccountingEntryOrigin;
  status?: AccountingEntryStatus;
  voidedAt?: string | null;
  voidReason?: string | null;
  reversedEntryId?: string | null;
  closingYear?: number | null;
  isPeriodLocked?: boolean;
  ticketNumber?: string | null;
  totalAmount: number;
  isBalanced: boolean;
  createdAt?: string;
  items: AccountingEntryItem[];
}

export interface CreateAccountingEntryItemInput {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface CreateAccountingEntryData {
  entryDate: string;
  concept: string;
  items: CreateAccountingEntryItemInput[];
}

export interface BalanceRow {
  id: string;
  code: string;
  name: string;
  accountType: AccountingAccountType | string;
  totalDebit: number;
  totalCredit: number;
  debitBalance: number;
  creditBalance: number;
}

export interface LedgerMovement {
  id: string;
  entryId: string;
  entryNumber: number;
  entryDate: string;
  concept: string;
  origin?: AccountingEntryOrigin;
  entryStatus?: AccountingEntryStatus;
  description: string | null;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface AccountLedgerData {
  account: {
    id: string;
    code: string;
    name: string;
    accountType: AccountingAccountType | string;
    nature: 'deudora' | 'acreedora';
  };
  period: { startDate: string | null; endDate: string | null };
  initialBalance: number;
  movements: LedgerMovement[];
  totalDebit: number;
  totalCredit: number;
  finalBalance: number;
  finalBalanceType: 'deudor' | 'acreedor' | 'cero';
}

export interface AccountingPeriod {
  id: string | null;
  year: number;
  month: number;
  monthLabel: string;
  status: AccountingPeriodStatus;
  closedAt?: string | null;
  closedBy?: { id: string; name: string } | null;
  reopenedAt?: string | null;
  reopenedBy?: { id: string; name: string } | null;
  closingEntryId?: string | null;
  notes?: string | null;
  entriesCount: number;
  activeEntriesCount: number;
  pendingSalesCount: number;
  isPersisted: boolean;
  isBeforeAccountingStart?: boolean;
}

export interface AccountingSettings {
  accountingStartDate: string | null;
  updatedAt?: string | null;
  updatedBy?: { id: string; name: string } | null;
}

export interface AccountingYearOverview {
  year: number;
  accountingStartDate: string | null;
  isYearClosed: boolean;
  closingEntry: {
    id: string;
    entryNumber: number;
    entryDate: string;
    concept: string;
    createdAt: string;
  } | null;
  periods: AccountingPeriod[];
}

export interface AnnualClosingLinePreview {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: 'ingreso' | 'costo' | 'gasto' | 'patrimonio';
  currentBalance: number;
  debit: number;
  credit: number;
  description: string;
}

export interface AnnualClosingPreview {
  year: number;
  closingDate: string;
  alreadyClosed: boolean;
  existingClosingEntryId: string | null;
  hasLaterYearClosed: boolean;
  totalIngresos: number;
  totalCostos: number;
  totalGastos: number;
  resultadoEjercicio: number;
  equityAccount: {
    id: string;
    code: string;
    name: string;
  } | null;
  openMonthsCount: number;
  pendingSalesCount: number;
  canExecute: boolean;
  blockingReason: string | null;
  lines: AnnualClosingLinePreview[];
}

export interface PeriodCheckResult {
  date: string;
  year: number;
  month: number;
  monthLabel: string;
  status: AccountingPeriodStatus;
  isOpen: boolean;
  isYearClosed: boolean;
  isBeforeAccountingStart?: boolean;
  accountingStartDate?: string | null;
  reason?: string | null;
}

export interface AnnualClosingExecutionResult {
  success: boolean;
  year: number;
  closingDate: string;
  resultadoEjercicio: number;
  entry: {
    id: string;
    entryNumber: number;
    entryDate: string;
    concept: string;
    origin: string;
    itemsCount: number;
  };
}

export interface ReverseClosingResult {
  success: boolean;
  year: number;
  voidedEntryId: string;
  reversalEntryId: string;
  reversalEntryNumber: number;
  message: string;
}

export interface VoidEntryResult {
  success: boolean;
  voidedEntryId: string;
  voidedEntryNumber: number;
  reversalEntryId: string;
  reversalEntryNumber: number;
  message: string;
}

export interface ReportAccountLine {
  id: string;
  code: string;
  name: string;
  amount: number;
}

export interface IncomeStatementReport {
  period: {
    startDate: string | null;
    endDate: string | null;
  };
  ingresosOperacionales: {
    total: number;
    accounts: ReportAccountLine[];
  };
  costosMateriasPrimas: {
    total: number;
    accounts: ReportAccountLine[];
  };
  margenBruto: number;
  margenBrutoPercentage: number;
  gastosOperacionales: {
    total: number;
    accounts: ReportAccountLine[];
  };
  utilidadNeta: number;
  margenNetoPercentage: number;
}

export type IncomeStatementData = IncomeStatementReport;

export interface BalanceSheetReport {
  asOfDate: string;
  activos: {
    total: number;
    disponible: {
      total: number;
      accounts: ReportAccountLine[];
    };
    inventarios: {
      total: number;
      accounts: ReportAccountLine[];
    };
    otrosActivos: {
      total: number;
      accounts: ReportAccountLine[];
    };
  };
  pasivos: {
    total: number;
    obligaciones: {
      total: number;
      accounts: ReportAccountLine[];
    };
    impuestos: {
      total: number;
      accounts: ReportAccountLine[];
    };
    otrosPasivos: {
      total: number;
      accounts: ReportAccountLine[];
    };
  };
  patrimonio: {
    total: number;
    capital: {
      total: number;
      accounts: ReportAccountLine[];
    };
    resultadoEjercicio: number;
  };
  totalPasivoMasPatrimonio: number;
  isBalanced: boolean;
  difference: number;
  inventoryValuation: InventoryValuationReport;
}

export type BalanceSheetData = BalanceSheetReport;

export interface FinancialSummaryReport {
  period: {
    startDate: string | null;
    endDate: string | null;
  };
  asOfDate: string;
  kpis: {
    ingresosTotales: number;
    margenBruto: number;
    margenBrutoPercentage: number;
    gastosOperacionales: number;
    utilidadNeta: number;
    margenNetoPercentage: number;
    totalActivos: number;
    totalPasivos: number;
    totalPatrimonio: number;
    totalInventarioValorizado: number;
    deudaProveedores: number;
    isBalanceCuadrado: boolean;
  };
  incomeStatement: IncomeStatementReport;
  balanceSheet: BalanceSheetReport;
}

export type FinancialSummaryData = FinancialSummaryReport;
