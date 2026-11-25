import { useMemo } from 'react';
import { calculateGrossTaxBreakdown } from '../../../utils/tax';
import type { CartItem } from '../posPrint';

/**
 * Calcula totales del carrito POS (los precios de catálogo incluyen IVA 19%)
 * delegando el desglose tributario al helper centralizado de impuestos.
 */
export function usePosTotals(cart: CartItem[]) {
  return useMemo(() => {
    const subtotal = cart.reduce(
      (acc, item) => acc + item.price * item.quantity,
      0,
    );
    const { vatAmount, totalAmount } = calculateGrossTaxBreakdown(subtotal);
    return {
      subtotal: totalAmount,
      iva: vatAmount,
      total: totalAmount,
    };
  }, [cart]);
}
