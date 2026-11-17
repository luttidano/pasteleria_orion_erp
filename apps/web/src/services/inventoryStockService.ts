import { apiFetch } from '../lib/api';
import type { InventoryStockAlertsSummary } from '../types';

export const inventoryStockService = {
  /**
   * Obtiene los contadores consolidados de quiebre y alerta crítica de inventario
   * para las insignias del Sidebar y vistas de gestión.
   */
  async getAlertCounts(): Promise<InventoryStockAlertsSummary> {
    return await apiFetch<InventoryStockAlertsSummary>('/inventory/stock/alerts');
  },
};