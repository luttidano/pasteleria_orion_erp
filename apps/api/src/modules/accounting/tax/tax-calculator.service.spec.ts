import { TaxCalculatorService, DEFAULT_VAT_RATE } from './tax-calculator.service';

describe('TaxCalculatorService', () => {
  let calculator: TaxCalculatorService;

  beforeEach(() => {
    calculator = new TaxCalculatorService();
  });

  it('debe desglosar correctamente monto bruto afecto con IVA estándar (19%)', () => {
    const result = calculator.breakdownFromGross(11900);

    expect(result).toEqual({
      netAmount: 10000,
      vatAmount: 1900,
      totalAmount: 11900,
      rate: DEFAULT_VAT_RATE,
      isExempt: false,
    });
  });

  it('debe mantener neto + IVA exactamente igual al total bruto ante redondeos', () => {
    const result = calculator.breakdownFromGross(1500);

    expect(result.netAmount + result.vatAmount).toBe(1500);
    expect(result.netAmount).toBe(1260.5);
    expect(result.vatAmount).toBe(239.5);
  });

  it('debe respetar documentos exentos sin calcular IVA', () => {
    const result = calculator.breakdownFromGross(15000, { isExempt: true });

    expect(result).toEqual({
      netAmount: 15000,
      vatAmount: 0,
      totalAmount: 15000,
      rate: 0,
      isExempt: true,
    });
  });

  it('debe calcular monto bruto desde base neta y tasa personalizada', () => {
    const result = calculator.grossFromNet(10000, { rate: 0.1 });

    expect(result).toEqual({
      netAmount: 10000,
      vatAmount: 1000,
      totalAmount: 11000,
      rate: 0.1,
      isExempt: false,
    });
  });

  it('debe inferir correctamente el monto neto a partir del IVA', () => {
    expect(calculator.netFromVat(19000)).toBe(100000);
    expect(calculator.netFromVat(0)).toBe(0);
  });
});
