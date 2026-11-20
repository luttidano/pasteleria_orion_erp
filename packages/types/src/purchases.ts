export type SupplierInvoiceStatus = 'pending' | 'partial' | 'paid' | 'voided';

export type SupplierPaymentMethod = 'transferencia' | 'efectivo' | 'banco';

export interface SupplierPayment {
  id: string;
  invoiceId: string;
  paymentDate: string;
  amount: number;
  paymentMethod: SupplierPaymentMethod;
  reference?: string | null;
  notes?: string | null;
  accountingEntryId?: string | null;
  createdById?: string | null;
  createdAt: string;
}

export interface SupplierInvoice {
  id: string;
  supplierId: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: SupplierInvoiceStatus;
  hasInvoice: boolean;
  notes?: string | null;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
  supplier?: {
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    contactPerson?: string | null;
  };
  payments?: SupplierPayment[];
}

export interface AccountsPayableSummary {
  totalDebt: number;
  overdueDebt: number;
  upcomingDebt: number; // Vence en próximos 7 días
  currentDebt: number; // Al día (> 7 días)
  pendingInvoicesCount: number;
  overdueInvoicesCount: number;
}

export interface CreateSupplierInvoicePayload {
  supplierId: string;
  invoiceNumber: string;
  issueDate?: string;
  dueDate: string;
  totalAmount: number;
  hasInvoice?: boolean;
  notes?: string;
}

export interface RecordSupplierPaymentPayload {
  amount: number;
  paymentMethod: SupplierPaymentMethod;
  paymentDate?: string;
  reference?: string;
  notes?: string;
}
