import { apiFetch } from '../lib/api';
import type { PosActiveShiftOverview, PosShiftRecord } from '../types';

export const posShiftService = {
  async getActiveOverview(
    from?: string,
    to?: string,
  ): Promise<PosActiveShiftOverview> {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const query = params.toString();
    return apiFetch<PosActiveShiftOverview>(
      `/pos/shifts/active${query ? `?${query}` : ''}`,
    );
  },

  async updateOpeningCash(payload: {
    openingCash: number;
    from?: string;
    to?: string;
  }): Promise<PosActiveShiftOverview> {
    return apiFetch<PosActiveShiftOverview>('/pos/shifts/active/opening-cash', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async closeShift(payload: {
    countedCash: number;
    openingCash?: number;
    notes?: string;
    from?: string;
    to?: string;
    localDate?: string;
  }): Promise<PosShiftRecord> {
    return apiFetch<PosShiftRecord>('/pos/shifts/close', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getShifts(): Promise<PosShiftRecord[]> {
    return apiFetch<PosShiftRecord[]>('/pos/shifts');
  },
};

