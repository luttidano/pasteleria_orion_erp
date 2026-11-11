export enum Role {
  admin = 'admin',
  cashier = 'cashier',
  baker = 'baker',
}

export enum CategoryType {
  ingredient = 'ingredient',
  recipe = 'recipe',
  pos = 'pos',
}

export enum SupplierType {
  materia_prima = 'materia_prima',
  empaque = 'empaque',
  reventa = 'reventa',
  insumo_general = 'insumo_general',
}

export enum ProductType {
  manufactured = 'manufactured',
  resale = 'resale',
}

export enum AccountingPeriodStatus {
  abierto = 'abierto',
  cerrado = 'cerrado',
}

export enum AccountingEntryOrigin {
  manual = 'manual',
  pos = 'pos',
  closing = 'closing',
  reversal = 'reversal',
}
