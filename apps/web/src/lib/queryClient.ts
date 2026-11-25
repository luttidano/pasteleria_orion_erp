import { QueryClient } from '@tanstack/react-query';
import type { CategoryType } from '../types';
import type { QuerySupplierInvoicesParams } from '../services/purchaseService';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
});

export const queryKeys = {
  inventory: ['inventory'] as const,
  ingredients: () => ['inventory', 'ingredients'] as const,
  stockAlerts: () => ['inventory', 'stock-alerts'] as const,
  categories: (type?: CategoryType) =>
    type ? (['categories', type] as const) : (['categories'] as const),
  purchases: ['purchases'] as const,
  purchasesSummary: () => ['purchases', 'summary'] as const,
  purchasesInvoices: (params?: QuerySupplierInvoicesParams) =>
    ['purchases', 'invoices', params ?? {}] as const,
};
