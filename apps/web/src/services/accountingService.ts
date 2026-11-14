import { apiFetch } from '../lib/api';
import type {
  AccountLedgerData,
  AccountingAccount,
  AccountingEntry,
  BalanceRow,
  CreateAccountingEntryData,
} from '../types';

export const accountingService = {
  async getAccounts(): Promise<AccountingAccount[]> {
    return apiFetch<AccountingAccount[]>('/accounting/accounts');
  },

  async getEntries(): Promise<AccountingEntry[]> {
    return apiFetch<AccountingEntry[]>('/accounting/entries');
  },

  async getPendingSalesCount(): Promise<{ pendingCount: number }> {
    return apiFetch<{ pendingCount: number }>('/accounting/pending-sales-count');
  },

  async getBalance(): Promise<BalanceRow[]> {
    return apiFetch<BalanceRow[]>('/accounting/balance');
  },

  async getLedger(
    accountId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<AccountLedgerData> {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiFetch<AccountLedgerData>(`/accounting/ledger/${accountId}${query}`);
  },

  async syncPendingSales(
    idempotencyKey?: string,
  ): Promise<{ synced: number; failed: number }> {
    return apiFetch<{ synced: number; failed: number }>(
      '/accounting/sync-pending-sales',
      {
        method: 'POST',
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      },
    );
  },

  async createEntry(
    data: CreateAccountingEntryData,
    idempotencyKey?: string,
  ): Promise<AccountingEntry> {
    return apiFetch<AccountingEntry>('/accounting/entries', {
      method: 'POST',
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      body: JSON.stringify(data),
    });
  },
};

