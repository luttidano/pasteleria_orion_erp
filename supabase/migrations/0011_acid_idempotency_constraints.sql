-- =============================================================================
-- PASTELERÍA ORIÓN ERP — MIGRATION 0011: ACID, IDEMPOTENCIA Y CONSTRAINTS
-- =============================================================================
-- Objetivo:
-- 1. Crear tabla `public.idempotency_record` con llave única compuesta por
--    `(actor_key, method, route, idempotency_key)` y acceso restringido solo a
--    `service_role` (default-deny para `anon` / `authenticated`).
-- 2. Agregar `pos_sale_item.packaging_id` (con índice FK) para trazabilidad real
--    de empaques vendidos en POS sin perder integridad referencial.
-- 3. Agregar `accounting_entry.pos_shift_id` (con índice FK) e índices únicos
--    parciales `uq_accounting_entry_pos_sale` y `uq_accounting_entry_pos_shift`
--    para garantizar unicidad contable de ventas y diferencias de arqueo activas.
-- =============================================================================

-- 1. Tabla de registro de idempotencia HTTP
CREATE TABLE IF NOT EXISTS public.idempotency_record (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL CHECK (length(btrim(idempotency_key)) > 0 AND length(idempotency_key) <= 128),
  actor_key text NOT NULL,
  method text NOT NULL CHECK (method = ANY (ARRAY['POST'::text, 'PUT'::text, 'PATCH'::text, 'DELETE'::text])),
  route text NOT NULL,
  request_hash text NOT NULL,
  status text NOT NULL DEFAULT 'processing'::text CHECK (status = ANY (ARRAY['processing'::text, 'completed'::text])),
  status_code integer,
  response_body jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '24 hours'),
  CONSTRAINT uq_idempotency_scope UNIQUE (actor_key, method, route, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_record_expires_at
  ON public.idempotency_record(expires_at);

-- 2. Trazabilidad de empaques vendidos en ítems de POS
ALTER TABLE public.pos_sale_item
  ADD COLUMN IF NOT EXISTS packaging_id uuid REFERENCES public.packaging(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pos_sale_item_packaging
  ON public.pos_sale_item(packaging_id);

-- 3. Vinculación e idempotencia contable para ventas y diferencias de arqueo
ALTER TABLE public.accounting_entry
  ADD COLUMN IF NOT EXISTS pos_shift_id uuid REFERENCES public.pos_shift(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_accounting_entry_pos_shift
  ON public.accounting_entry(pos_shift_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_accounting_entry_pos_sale
  ON public.accounting_entry(pos_sale_id)
  WHERE pos_sale_id IS NOT NULL AND status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS uq_accounting_entry_pos_shift
  ON public.accounting_entry(pos_shift_id)
  WHERE pos_shift_id IS NOT NULL AND status = 'active';

-- 4. RLS estricta (default-deny en PostgREST para idempotency_record)
ALTER TABLE public.idempotency_record ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.idempotency_record FROM anon, authenticated;
GRANT ALL ON TABLE public.idempotency_record TO service_role;

