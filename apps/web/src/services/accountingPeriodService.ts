import { apiFetch } from '../lib/api';
import type {
  AccountingPeriod,
  AccountingSettings,
  AccountingYearOverview,
  AnnualClosingExecutionResult,
  AnnualClosingPreview,
  PeriodCheckResult,
  ReverseClosingResult,
  VoidEntryResult,
} from '../types';

export type {
  AnnualClosingExecutionResult,
  ReverseClosingResult,
  VoidEntryResult,
};

export const accountingPeriodService = {
  async getYearOverview(year?: number): Promise<AccountingYearOverview> {
    const query = year ? `?year=${year}` : '';
    return apiFetch<AccountingYearOverview>(`/accounting/periods${query}`);
  },

  async checkDate(date: string): Promise<PeriodCheckResult> {
    return apiFetch<PeriodCheckResult>(
      `/accounting/periods/check?date=${encodeURIComponent(date)}`,
    );
  },

  async closePeriod(payload: {
    year: number;
    month: number;
    notes?: string;
  }): Promise<AccountingPeriod> {
    return apiFetch<AccountingPeriod>('/accounting/periods/close', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async reopenPeriod(payload: {
    year: number;
    month: number;
    notes?: string;
  }): Promise<AccountingPeriod> {
    return apiFetch<AccountingPeriod>('/accounting/periods/reopen', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async previewAnnualClosing(year?: number): Promise<AnnualClosingPreview> {
    const query = year ? `?year=${year}` : '';
    return apiFetch<AnnualClosingPreview>(
      `/accounting/periods/annual-closing/preview${query}`,
    );
  },

  async executeAnnualClosing(payload: {
    year: number;
    notes?: string;
  }): Promise<AnnualClosingExecutionResult> {
    return apiFetch<AnnualClosingExecutionResult>(
      '/accounting/periods/annual-closing',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  },

  async reverseAnnualClosing(payload: {
    year: number;
    reason: string;
  }): Promise<ReverseClosingResult> {
    return apiFetch<ReverseClosingResult>(
      '/accounting/periods/annual-closing/reverse',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  },

  async voidEntry(entryId: string, reason: string): Promise<VoidEntryResult> {
    return apiFetch<VoidEntryResult>(`/accounting/entries/${entryId}/void`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  async getSettings(): Promise<AccountingSettings> {
    return apiFetch<AccountingSettings>('/accounting/periods/settings');
  },

  async updateSettings(accountingStartDate: string | null): Promise<AccountingSettings> {
    return apiFetch<AccountingSettings>('/accounting/periods/settings', {
      method: 'PUT',
      body: JSON.stringify({ accountingStartDate }),
    });
  },
};

