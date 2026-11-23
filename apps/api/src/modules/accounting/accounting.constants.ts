export const SYSTEM_ACCOUNT_CODES = {
  // 1.1.01 Efectivo y Bancos
  CASH: '1.1.01.01',
  BANK_TRANSFER: '1.1.01.02',
  BANK_CARD: '1.1.01.03',
  DIGITAL_WALLET: '1.1.01.04',

  // 1.1.02 Inventarios y Existencias
  RAW_MATERIALS_INVENTORY: '1.1.02.01',
  FINISHED_GOODS_INVENTORY: '1.1.02.02',
  PACKAGING_INVENTORY: '1.1.02.03',

  // 1.1.03 Impuestos por Recuperar
  VAT_CREDIT: '1.1.03.01',

  // 2.1.01 Proveedores y Pasivos Comerciales
  SUPPLIERS_PAYABLE: '2.1.01.01',

  // 2.1.02 Obligaciones Tributarias
  VAT_DEBIT: '2.1.02.01',
  PPM_PAYABLE: '2.1.02.02',

  // 3.1 Patrimonio y Resultados
  CAPITAL: '3.1.01.01',
  CURRENT_YEAR_EARNINGS: '3.1.02.01',
  RETAINED_EARNINGS: '3.1.02.02',

  // 4.1 Ingresos Operacionales
  SALES_REVENUE: '4.1.01.01',
  OTHER_INCOME_SURPLUS: '4.1.02.01',

  // 5.1 Costos de Explotación
  COGS_FOOD: '5.1.01.01',
  COGS_PACKAGING: '5.1.01.02',

  // 6.1 Gastos Operacionales
  OPERATING_EXPENSES: '6.1.01.01',
  CASH_SHORTAGE: '6.1.02.01',
  WASTE_SHORTAGE: '6.1.02.02',
} as const;

export type SystemAccountCode =
  (typeof SYSTEM_ACCOUNT_CODES)[keyof typeof SYSTEM_ACCOUNT_CODES];
