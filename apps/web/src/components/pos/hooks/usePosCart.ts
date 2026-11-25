import { useCallback, useState } from 'react';
import type {
  CatalogProduct,
  Packaging,
  PosPaymentMethod,
  ToastMessage,
} from '../../../types';
import {
  buildCartKey,
  resolveSecondaryPackagingPrice,
  type CartItem,
} from '../posPrint';

interface UsePosCartOptions {
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
}

/**
 * Gestiona el carrito de mostrador POS, método de pago y validaciones de stock disponible.
 */
export function usePosCart({ addToast }: UsePosCartOptions) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] =
    useState<PosPaymentMethod>('debito');

  const addToCart = useCallback(
    (product: CatalogProduct) => {
      if (product.stock <= 0) {
        addToast({
          type: 'warning',
          title: 'Producto agotado',
          message: `"${product.name}" no cuenta con unidades disponibles en este momento.`,
        });
        return;
      }

      const cartKey = buildCartKey(product.id, false);
      setCart((prev) => {
        const existing = prev.find((item) => item.cartKey === cartKey);
        if (existing) {
          if (existing.quantity >= product.stock) {
            addToast({
              type: 'warning',
              title: 'Límite de stock alcanzado',
              message: `Solo hay ${product.stock} ${product.unit} disponibles en inventario de "${product.name}".`,
            });
            return prev;
          }
          return prev.map((item) =>
            item.cartKey === cartKey
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          );
        }

        return [
          ...prev,
          {
            cartKey,
            id: product.id,
            name: product.name,
            price: product.salePrice,
            quantity: 1,
            stock: product.stock,
            unit: product.unit,
            category: product.categoryName || 'General',
            icon: product.icon || '🧁',
            isPackaging: false,
          },
        ];
      });
    },
    [addToast],
  );

  const addPackagingToCart = useCallback(
    (pack: Packaging) => {
      if (pack.stock <= 0) {
        addToast({
          type: 'warning',
          title: 'Empaque agotado',
          message: `No quedan unidades disponibles de "${pack.name}".`,
        });
        return;
      }

      const salePrice = resolveSecondaryPackagingPrice(
        pack.name,
        pack.salePrice,
      );
      const cartKey = buildCartKey(pack.id, true);

      setCart((prev) => {
        const existing = prev.find((item) => item.cartKey === cartKey);
        if (existing) {
          if (existing.quantity >= pack.stock) {
            addToast({
              type: 'warning',
              title: 'Límite de empaques alcanzado',
              message: `Solo hay ${pack.stock} ${pack.unit} disponibles en inventario de "${pack.name}".`,
            });
            return prev;
          }
          return prev.map((item) =>
            item.cartKey === cartKey
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          );
        }

        return [
          ...prev,
          {
            cartKey,
            id: pack.id,
            name: pack.name,
            price: salePrice,
            quantity: 1,
            stock: pack.stock,
            unit: pack.unit,
            category: 'Empaque / Servicio',
            icon: pack.icon || '🛍️',
            isPackaging: true,
          },
        ];
      });
    },
    [addToast],
  );

  const updateQuantity = useCallback(
    (cartKey: string, delta: number) => {
      setCart((prev) => {
        const target = prev.find((item) => item.cartKey === cartKey);
        if (!target) return prev;

        if (delta > 0 && target.quantity >= target.stock) {
          addToast({
            type: 'warning',
            title: 'Stock máximo alcanzado',
            message: `Solo hay ${target.stock} ${target.unit} disponibles de "${target.name}".`,
          });
          return prev;
        }

        return prev
          .map((item) => {
            if (item.cartKey === cartKey) {
              const next = item.quantity + delta;
              return next > 0 ? { ...item, quantity: next } : null;
            }
            return item;
          })
          .filter((item): item is CartItem => item !== null);
      });
    },
    [addToast],
  );

  const clearCart = useCallback(() => setCart([]), []);

  return {
    cart,
    paymentMethod,
    setPaymentMethod,
    addToCart,
    addPackagingToCart,
    updateQuantity,
    clearCart,
  };
}
