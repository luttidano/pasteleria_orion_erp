import {
  resolveSecondaryPackagingPrice,
  roundMoney,
  roundQuantity,
} from './money.util';
import { computeStockStatus } from './stock-status.util';

describe('money.util & stock-status.util', () => {
  it('debe redondear correctamente montos monetarios y cantidades', () => {
    expect(roundMoney(100.005)).toBe(100.01);
    expect(roundQuantity(1.23456)).toBe(1.235);
  });

  it('debe aplicar la regla de cobro de bolsas ($100) vs otros empaques ($0)', () => {
    expect(resolveSecondaryPackagingPrice('Bolsa Kraft Grande')).toBe(100);
    expect(resolveSecondaryPackagingPrice('Caja Torta Kraft 26cm')).toBe(0);
  });

  it('debe calcular correctamente el estado de stock', () => {
    expect(computeStockStatus(0, 5)).toBe('agotado');
    expect(computeStockStatus(5, 5)).toBe('bajo');
    expect(computeStockStatus(6, 5)).toBe('suficiente');
  });
});
