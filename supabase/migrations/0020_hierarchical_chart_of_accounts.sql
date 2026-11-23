-- =============================================================================
-- PASTELERÍA ORIÓN ERP — MIGRATION 0020: ÁRBOL CONTABLE JERÁRQUICO
-- =============================================================================
-- 1. Amplía public.accounting_account con estructura jerárquica multinivel:
--    - parent_id: autorreferencia al nodo padre (Niveles 1 a 3)
--    - path: camino materializado indexado (ej. '1/1.1/1.1.01/1.1.01.01')
--    - level: nivel de profundidad (1=Clase, 2=Grupo, 3=Subgrupo, 4=Detalle imputable)
--    - is_group: true para cuentas totalizadoras (no imputables), false para detalle
--    - normal_balance: 'debit' (Activos, Costos, Gastos) o 'credit' (Pasivos, Patrimonio, Ingresos)
-- 2. Restricción preventiva: trigger para impedir registrar asientos en cuentas totalizadoras
-- 3. Carga limpia del catálogo oficial completo del Plan de Cuentas Chileno (IFRS / SII)
-- =============================================================================

-- 1. Alterar tabla public.accounting_account
ALTER TABLE public.accounting_account
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.accounting_account(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS path varchar(100) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS level smallint NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS is_group boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS normal_balance varchar(10) NOT NULL DEFAULT 'debit' CHECK (normal_balance IN ('debit', 'credit'));

CREATE INDEX IF NOT EXISTS idx_accounting_account_parent
  ON public.accounting_account (parent_id);

CREATE INDEX IF NOT EXISTS idx_accounting_account_path
  ON public.accounting_account (path);

CREATE INDEX IF NOT EXISTS idx_accounting_account_level
  ON public.accounting_account (level);

-- 2. Trigger para bloquear asientos en cuentas totalizadoras (is_group = true)
CREATE OR REPLACE FUNCTION public.check_accounting_entry_item_not_group()
RETURNS TRIGGER AS $$
DECLARE
  v_is_group boolean;
BEGIN
  SELECT is_group INTO v_is_group
  FROM public.accounting_account
  WHERE id = NEW.account_id;

  IF v_is_group IS TRUE THEN
    RAISE EXCEPTION 'No se pueden imputar asientos contables en cuentas totalizadoras / agrupadoras (is_group = true). Debe seleccionar una subcuenta de detalle imputable.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_entry_item_on_group_account ON public.accounting_entry_item;
CREATE TRIGGER trg_prevent_entry_item_on_group_account
  BEFORE INSERT OR UPDATE ON public.accounting_entry_item
  FOR EACH ROW
  EXECUTE FUNCTION public.check_accounting_entry_item_not_group();

-- 3. Limpieza y carga estructurada del Plan de Cuentas Jerárquico Oficial
-- Como la base de datos se reinició, podemos vaciar las cuentas planas obsoletas de forma segura
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.accounting_entry_item LIMIT 1) THEN
    DELETE FROM public.accounting_account;
  END IF;
END $$;

-- 3.1 NIVEL 1: CLASES TOTALIZADORAS
INSERT INTO public.accounting_account (code, name, account_type, level, is_group, normal_balance, path, is_active)
VALUES
  ('1', 'ACTIVOS', 'activo', 1, true, 'debit', '1', true),
  ('2', 'PASIVOS', 'pasivo', 1, true, 'credit', '2', true),
  ('3', 'PATRIMONIO', 'patrimonio', 1, true, 'credit', '3', true),
  ('4', 'INGRESOS', 'ingreso', 1, true, 'credit', '4', true),
  ('5', 'COSTOS DE EXPLOTACIÓN', 'costo', 1, true, 'debit', '5', true),
  ('6', 'GASTOS OPERACIONALES', 'gasto', 1, true, 'debit', '6', true)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    account_type = EXCLUDED.account_type,
    level = EXCLUDED.level,
    is_group = EXCLUDED.is_group,
    normal_balance = EXCLUDED.normal_balance,
    path = EXCLUDED.path,
    is_active = true;

-- 3.2 NIVEL 2: GRUPOS TOTALIZADORES
INSERT INTO public.accounting_account (code, name, account_type, level, is_group, normal_balance, path, parent_id, is_active)
VALUES
  ('1.1', 'Activo Corriente', 'activo', 2, true, 'debit', '1/1.1', (SELECT id FROM public.accounting_account WHERE code = '1'), true),
  ('1.2', 'Activo No Corriente', 'activo', 2, true, 'debit', '1/1.2', (SELECT id FROM public.accounting_account WHERE code = '1'), true),
  ('2.1', 'Pasivo Corriente', 'pasivo', 2, true, 'credit', '2/2.1', (SELECT id FROM public.accounting_account WHERE code = '2'), true),
  ('2.2', 'Pasivo No Corriente', 'pasivo', 2, true, 'credit', '2/2.2', (SELECT id FROM public.accounting_account WHERE code = '2'), true),
  ('3.1', 'Capital y Reservas', 'patrimonio', 2, true, 'credit', '3/3.1', (SELECT id FROM public.accounting_account WHERE code = '3'), true),
  ('4.1', 'Ingresos Operacionales', 'ingreso', 2, true, 'credit', '4/4.1', (SELECT id FROM public.accounting_account WHERE code = '4'), true),
  ('5.1', 'Costos de Producción y Venta', 'costo', 2, true, 'debit', '5/5.1', (SELECT id FROM public.accounting_account WHERE code = '5'), true),
  ('6.1', 'Gastos de Administración y Ventas', 'gasto', 2, true, 'debit', '6/6.1', (SELECT id FROM public.accounting_account WHERE code = '6'), true)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    account_type = EXCLUDED.account_type,
    level = EXCLUDED.level,
    is_group = EXCLUDED.is_group,
    normal_balance = EXCLUDED.normal_balance,
    path = EXCLUDED.path,
    parent_id = EXCLUDED.parent_id,
    is_active = true;

-- 3.3 NIVEL 3: SUBGRUPOS / CUENTAS DE MAYOR
INSERT INTO public.accounting_account (code, name, account_type, level, is_group, normal_balance, path, parent_id, is_active)
VALUES
  ('1.1.01', 'Efectivo y Equivalentes de Efectivo', 'activo', 3, true, 'debit', '1/1.1/1.1.01', (SELECT id FROM public.accounting_account WHERE code = '1.1'), true),
  ('1.1.02', 'Inventarios y Existencias', 'activo', 3, true, 'debit', '1/1.1/1.1.02', (SELECT id FROM public.accounting_account WHERE code = '1.1'), true),
  ('1.1.03', 'Impuestos por Recuperar', 'activo', 3, true, 'debit', '1/1.1/1.1.03', (SELECT id FROM public.accounting_account WHERE code = '1.1'), true),
  ('1.2.01', 'Maquinarias y Equipos de Panadería', 'activo', 3, true, 'debit', '1/1.2/1.2.01', (SELECT id FROM public.accounting_account WHERE code = '1.2'), true),
  ('2.1.01', 'Cuentas Comerciales por Pagar', 'pasivo', 3, true, 'credit', '2/2.1/2.1.01', (SELECT id FROM public.accounting_account WHERE code = '2.1'), true),
  ('2.1.02', 'Obligaciones Fiscales e Impuestos', 'pasivo', 3, true, 'credit', '2/2.1/2.1.02', (SELECT id FROM public.accounting_account WHERE code = '2.1'), true),
  ('3.1.01', 'Capital Aportado', 'patrimonio', 3, true, 'credit', '3/3.1/3.1.01', (SELECT id FROM public.accounting_account WHERE code = '3.1'), true),
  ('3.1.02', 'Resultados Acumulados y del Ejercicio', 'patrimonio', 3, true, 'credit', '3/3.1/3.1.02', (SELECT id FROM public.accounting_account WHERE code = '3.1'), true),
  ('4.1.01', 'Venta de Productos de Panadería y Pastelería', 'ingreso', 3, true, 'credit', '4/4.1/4.1.01', (SELECT id FROM public.accounting_account WHERE code = '4.1'), true),
  ('4.1.02', 'Otros Ingresos Operacionales', 'ingreso', 3, true, 'credit', '4/4.1/4.1.02', (SELECT id FROM public.accounting_account WHERE code = '4.1'), true),
  ('5.1.01', 'Costo de Mercaderías y Producción', 'costo', 3, true, 'debit', '5/5.1/5.1.01', (SELECT id FROM public.accounting_account WHERE code = '5.1'), true),
  ('6.1.01', 'Gastos en Personal y Operaciones', 'gasto', 3, true, 'debit', '6/6.1/6.1.01', (SELECT id FROM public.accounting_account WHERE code = '6.1'), true),
  ('6.1.02', 'Faltantes y Pérdidas Operativas', 'gasto', 3, true, 'debit', '6/6.1/6.1.02', (SELECT id FROM public.accounting_account WHERE code = '6.1'), true)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    account_type = EXCLUDED.account_type,
    level = EXCLUDED.level,
    is_group = EXCLUDED.is_group,
    normal_balance = EXCLUDED.normal_balance,
    path = EXCLUDED.path,
    parent_id = EXCLUDED.parent_id,
    is_active = true;

-- 3.4 NIVEL 4: SUBCUENTAS DE DETALLE (IMPUTABLES / CON SALDO)
INSERT INTO public.accounting_account (code, name, account_type, level, is_group, normal_balance, path, parent_id, is_active)
VALUES
  -- 1.1.01 Efectivo y Equivalentes
  ('1.1.01.01', 'Caja General Efectivo', 'activo', 4, false, 'debit', '1/1.1/1.1.01/1.1.01.01', (SELECT id FROM public.accounting_account WHERE code = '1.1.01'), true),
  ('1.1.01.02', 'Banco Estado / Transferencias', 'activo', 4, false, 'debit', '1/1.1/1.1.01/1.1.01.02', (SELECT id FROM public.accounting_account WHERE code = '1.1.01'), true),
  ('1.1.01.03', 'Tarjetas Transbank / Débito y Crédito', 'activo', 4, false, 'debit', '1/1.1/1.1.01/1.1.01.03', (SELECT id FROM public.accounting_account WHERE code = '1.1.01'), true),
  ('1.1.01.04', 'MercadoPago / Pasarelas Digitales', 'activo', 4, false, 'debit', '1/1.1/1.1.01/1.1.01.04', (SELECT id FROM public.accounting_account WHERE code = '1.1.01'), true),
  
  -- 1.1.02 Inventarios y Existencias
  ('1.1.02.01', 'Inventario Materias Primas e Ingredientes', 'activo', 4, false, 'debit', '1/1.1/1.1.02/1.1.02.01', (SELECT id FROM public.accounting_account WHERE code = '1.1.02'), true),
  ('1.1.02.02', 'Inventario Productos Terminados', 'activo', 4, false, 'debit', '1/1.1/1.1.02/1.1.02.02', (SELECT id FROM public.accounting_account WHERE code = '1.1.02'), true),
  ('1.1.02.03', 'Inventario Empaques y Embalajes', 'activo', 4, false, 'debit', '1/1.1/1.1.02/1.1.02.03', (SELECT id FROM public.accounting_account WHERE code = '1.1.02'), true),

  -- 1.1.03 Impuestos por Recuperar
  ('1.1.03.01', 'IVA Crédito Fiscal (19%)', 'activo', 4, false, 'debit', '1/1.1/1.1.03/1.1.03.01', (SELECT id FROM public.accounting_account WHERE code = '1.1.03'), true),

  -- 2.1.01 Proveedores
  ('2.1.01.01', 'Proveedores por Pagar Nacionales', 'pasivo', 4, false, 'credit', '2/2.1/2.1.01/2.1.01.01', (SELECT id FROM public.accounting_account WHERE code = '2.1.01'), true),

  -- 2.1.02 Obligaciones Fiscales
  ('2.1.02.01', 'IVA Débito Fiscal (19%)', 'pasivo', 4, false, 'credit', '2/2.1/2.1.02/2.1.02.01', (SELECT id FROM public.accounting_account WHERE code = '2.1.02'), true),
  ('2.1.02.02', 'Retenciones PPM por Pagar', 'pasivo', 4, false, 'credit', '2/2.1/2.1.02/2.1.02.02', (SELECT id FROM public.accounting_account WHERE code = '2.1.02'), true),

  -- 3.1.01 / 3.1.02 Patrimonio
  ('3.1.01.01', 'Capital Social Inicial Aportado', 'patrimonio', 4, false, 'credit', '3/3.1/3.1.01/3.1.01.01', (SELECT id FROM public.accounting_account WHERE code = '3.1.01'), true),
  ('3.1.02.01', 'Resultado del Ejercicio Actual', 'patrimonio', 4, false, 'credit', '3/3.1/3.1.02/3.1.02.01', (SELECT id FROM public.accounting_account WHERE code = '3.1.02'), true),
  ('3.1.02.02', 'Resultados Acumulados (Ejercicios Anteriores)', 'patrimonio', 4, false, 'credit', '3/3.1/3.1.02/3.1.02.02', (SELECT id FROM public.accounting_account WHERE code = '3.1.02'), true),

  -- 4.1.01 / 4.1.02 Ingresos
  ('4.1.01.01', 'Venta de Pastelería y Bollería', 'ingreso', 4, false, 'credit', '4/4.1/4.1.01/4.1.01.01', (SELECT id FROM public.accounting_account WHERE code = '4.1.01'), true),
  ('4.1.02.01', 'Sobrantes de Caja e Inventario', 'ingreso', 4, false, 'credit', '4/4.1/4.1.02/4.1.02.01', (SELECT id FROM public.accounting_account WHERE code = '4.1.02'), true),

  -- 5.1.01 Costos de Venta
  ('5.1.01.01', 'Costo de Materias Primas e Insumos', 'costo', 4, false, 'debit', '5/5.1/5.1.01/5.1.01.01', (SELECT id FROM public.accounting_account WHERE code = '5.1.01'), true),
  ('5.1.01.02', 'Costo de Empaques y Despacho', 'costo', 4, false, 'debit', '5/5.1/5.1.01/5.1.01.02', (SELECT id FROM public.accounting_account WHERE code = '5.1.01'), true),

  -- 6.1.01 / 6.1.02 Gastos Operacionales
  ('6.1.01.01', 'Gastos Operativos y Remuneraciones', 'gasto', 4, false, 'debit', '6/6.1/6.1.01/6.1.01.01', (SELECT id FROM public.accounting_account WHERE code = '6.1.01'), true),
  ('6.1.02.01', 'Faltantes y Diferencias de Caja', 'gasto', 4, false, 'debit', '6/6.1/6.1.02/6.1.02.01', (SELECT id FROM public.accounting_account WHERE code = '6.1.02'), true),
  ('6.1.02.02', 'Pérdidas por Merma y Ajustes', 'gasto', 4, false, 'debit', '6/6.1/6.1.02/6.1.02.02', (SELECT id FROM public.accounting_account WHERE code = '6.1.02'), true)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    account_type = EXCLUDED.account_type,
    level = EXCLUDED.level,
    is_group = EXCLUDED.is_group,
    normal_balance = EXCLUDED.normal_balance,
    path = EXCLUDED.path,
    parent_id = EXCLUDED.parent_id,
    is_active = true;
