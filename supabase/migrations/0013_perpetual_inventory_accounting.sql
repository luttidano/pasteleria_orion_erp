-- =============================================================================
-- PASTELERÍA ORIÓN ERP — MIGRATION 0013: CONTABILIDAD PERPETUA DE INVENTARIO
-- =============================================================================
-- Objetivo:
-- 1. Incorporar cuentas contables faltantes para el circuito perpetuo y futuro
--    submódulo tributario:
--      - 1108 IVA Crédito Fiscal (activo por recuperar en compras con factura)
--      - 4102 Sobrantes de Caja e Inventario (ingreso)
--      - 6104 Pérdidas por Merma y Ajustes (gasto)
-- 2. Crear tabla Kardex `public.stock_movement` con RLS estricta (`service_role`).
-- 3. Extender `public.accounting_entry` con origen `'inventory'` y `outbox_id`
--    con índice único parcial para idempotencia contable.
-- 4. Guardar `unit_cost` histórico en `public.pos_sale_item`.
-- 5. Extender `public.accounting_outbox` para encolar eventos de compra,
--    producción, ajuste/merma y costo de venta POS (`pos_sale_cogs`).
-- =============================================================================

-- 1. Cuentas contables complementarias (idempotente)
INSERT INTO public.accounting_account (code, name, account_type, is_active)
VALUES
  ('1108', 'IVA Crédito Fiscal', 'activo', true),
  ('4102', 'Sobrantes de Caja e Inventario', 'ingreso', true),
  ('6104', 'Pérdidas por Merma y Ajustes', 'gasto', true)
ON CONFLICT (code) DO NOTHING;

-- 2. Ampliar CHECK de origen e idempotencia por outbox_id en accounting_entry
ALTER TABLE public.accounting_entry
  DROP CONSTRAINT IF EXISTS accounting_entry_origin_check;

ALTER TABLE public.accounting_entry
  ADD CONSTRAINT accounting_entry_origin_check
  CHECK (origin = ANY (ARRAY['manual'::text, 'pos'::text, 'inventory'::text, 'closing'::text, 'reversal'::text]));

ALTER TABLE public.accounting_entry
  ADD COLUMN IF NOT EXISTS outbox_id uuid REFERENCES public.accounting_outbox(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_accounting_entry_outbox
  ON public.accounting_entry(outbox_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_accounting_entry_outbox_id
  ON public.accounting_entry(outbox_id)
  WHERE outbox_id IS NOT NULL AND status = 'active';

-- 3. Guardar costo unitario histórico por línea vendida en POS
ALTER TABLE public.pos_sale_item
  ADD COLUMN IF NOT EXISTS unit_cost numeric(12, 2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0::numeric);

-- 4. Ampliar CHECK de aggregate_type en accounting_outbox
ALTER TABLE public.accounting_outbox
  DROP CONSTRAINT IF EXISTS accounting_outbox_aggregate_type_check;

ALTER TABLE public.accounting_outbox
  ADD CONSTRAINT accounting_outbox_aggregate_type_check
  CHECK (
    aggregate_type = ANY (
      ARRAY[
        'pos_sale'::text,
        'pos_shift'::text,
        'inventory_purchase'::text,
        'inventory_production'::text,
        'inventory_adjustment'::text,
        'pos_sale_cogs'::text
      ]
    )
  );

-- 5. Tabla Kardex de trazabilidad física y valorizada de inventario
CREATE TABLE IF NOT EXISTS public.stock_movement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type text NOT NULL CHECK (
    item_type = ANY (ARRAY['ingredient'::text, 'product'::text, 'packaging'::text, 'general_supply'::text])
  ),
  item_id uuid NOT NULL,
  item_name text NOT NULL,
  movement_type text NOT NULL CHECK (
    movement_type = ANY (
      ARRAY[
        'purchase'::text,
        'production_in'::text,
        'production_out'::text,
        'sale'::text,
        'waste'::text,
        'internal_use'::text,
        'recount_surplus'::text,
        'recount_shortage'::text
      ]
    )
  ),
  quantity_delta numeric(12, 3) NOT NULL CHECK (quantity_delta <> 0::numeric),
  unit text NOT NULL,
  stock_before numeric(12, 3) NOT NULL CHECK (stock_before >= 0::numeric),
  stock_after numeric(12, 3) NOT NULL CHECK (stock_after >= 0::numeric),
  unit_cost numeric(12, 2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0::numeric),
  total_cost numeric(12, 2) NOT NULL DEFAULT 0 CHECK (total_cost >= 0::numeric),
  reference_type text,
  reference_id uuid,
  reason text,
  created_by uuid REFERENCES public.profile(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movement_item_date
  ON public.stock_movement (item_type, item_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_movement_type_date
  ON public.stock_movement (movement_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_movement_reference
  ON public.stock_movement (reference_type, reference_id);

ALTER TABLE public.stock_movement ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.stock_movement FROM anon, authenticated;
GRANT ALL ON TABLE public.stock_movement TO service_role;

