import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryClient';
import { categoryService } from '../../services/categoryService';
import { ingredientService } from '../../services/ingredientService';
import { inventoryStockService } from '../../services/inventoryStockService';
import type { CategoryType } from '../../types';

export function useIngredientsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.ingredients(),
    queryFn: () => ingredientService.getIngredients(),
    enabled,
  });
}

export function useCategoriesQuery(type: CategoryType, enabled = true) {
  return useQuery({
    queryKey: queryKeys.categories(type),
    queryFn: () => categoryService.getAll(type),
    enabled,
  });
}

export function useStockAlertsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.stockAlerts(),
    queryFn: () => inventoryStockService.getAlertCounts(),
    enabled,
  });
}

export function useInvalidateInventory() {
  const client = useQueryClient();

  return useCallback(async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.inventory }),
      client.invalidateQueries({ queryKey: queryKeys.categories() }),
    ]);
  }, [client]);
}
