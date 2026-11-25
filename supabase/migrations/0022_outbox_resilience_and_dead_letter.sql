-- =============================================================================
-- PASTELERÍA ORIÓN ERP — MIGRACIÓN 0022: RESILIENCIA DEL OUTBOX Y DEAD-LETTER QUEUE
-- =============================================================================
-- Objetivo:
-- 1. Permitir estado 'failed' (Dead-Letter) en public.accounting_outbox para que
--    eventos con errores irrecuperables (máximo de reintentos alcanzado) no
--    bloqueen indefinidamente el cierre mensual contable.
-- 2. Incorporar 'supplier_payment' al aggregate_type CHECK de public.accounting_outbox
--    para soportar la sincronización asíncrona de pagos a proveedores.
-- 3. Crear índice optimizado para el worker en segundo plano (scheduler).
-- =============================================================================

-- 1. Ampliar CHECK de estado en accounting_outbox para admitir 'failed'
ALTER TABLE public.accounting_outbox
  DROP CONSTRAINT IF EXISTS accounting_outbox_status_check;

ALTER TABLE public.accounting_outbox
  ADD CONSTRAINT accounting_outbox_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'processed'::text, 'failed'::text]));

-- 2. Ampliar CHECK de aggregate_type para incluir 'supplier_payment'
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
        'pos_sale_cogs'::text,
        'supplier_payment'::text
      ]
    )
  );

-- 3. Índice para el worker de procesamiento de outbox
CREATE INDEX IF NOT EXISTS idx_accounting_outbox_worker
  ON public.accounting_outbox (status, attempts, business_date ASC)
  WHERE status = 'pending';
