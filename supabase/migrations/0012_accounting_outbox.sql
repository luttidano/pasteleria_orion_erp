-- =============================================================================
-- PASTELERÍA ORIÓN ERP — MIGRATION 0012: TRANSACTIONAL ACCOUNTING OUTBOX
-- =============================================================================
-- Objetivo:
-- 1. Desacoplar completamente AccountingModule de lecturas/bloqueos/mutaciones
--    directas sobre `public.pos_sale` y `public.pos_shift`.
-- 2. Garantizar consistencia ACID (sin Two-Phase Commit roto) encolando dentro
--    de la misma transacción de POS los eventos contables de ventas y
--    diferencias de arqueo de caja.
-- 3. Hacer backfill de cualquier venta o cierre de turno que ya estuviera con
--    `accounting_status = 'pending'` antes de esta migración.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.accounting_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type text NOT NULL CHECK (aggregate_type = ANY (ARRAY['pos_sale'::text, 'pos_shift'::text])),
  aggregate_id uuid NOT NULL,
  business_date timestamp with time zone NOT NULL,
  reference_code text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'processed'::text])),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone,
  CONSTRAINT uq_accounting_outbox_aggregate UNIQUE (aggregate_type, aggregate_id)
);

CREATE INDEX IF NOT EXISTS idx_accounting_outbox_pending_date
  ON public.accounting_outbox (status, business_date ASC)
  WHERE status = 'pending';

-- Normalizar ventas en $0 que hayan quedado marcadas como pending
UPDATE public.pos_sale
SET accounting_status = 'posted',
    accounting_error = NULL
WHERE accounting_status = 'pending'
  AND total <= 0;

-- Backfill de ventas POS pendientes hacia accounting_outbox
INSERT INTO public.accounting_outbox (
  aggregate_type,
  aggregate_id,
  business_date,
  reference_code,
  payload,
  status,
  last_error
)
SELECT
  'pos_sale',
  s.id,
  s.sold_at,
  s.ticket_number,
  jsonb_build_object(
    'ticketNumber', s.ticket_number,
    'soldAt', to_char(s.sold_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'total', s.total::float8,
    'paymentMethod', s.payment_method
  ),
  'pending',
  s.accounting_error
FROM public.pos_sale s
WHERE s.accounting_status = 'pending'
  AND s.total > 0
ON CONFLICT (aggregate_type, aggregate_id) DO NOTHING;

-- Backfill de diferencias de arqueo pendientes hacia accounting_outbox
INSERT INTO public.accounting_outbox (
  aggregate_type,
  aggregate_id,
  business_date,
  reference_code,
  payload,
  status,
  last_error
)
SELECT
  'pos_shift',
  sh.id,
  COALESCE(sh.closed_at, sh.opened_at),
  'Turno #' || sh.shift_number::text,
  jsonb_build_object(
    'shiftNumber', sh.shift_number::int,
    'closedAt', to_char(COALESCE(sh.closed_at, sh.opened_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'cashDifference', COALESCE(sh.cash_difference, 0)::float8
  ),
  'pending',
  sh.accounting_warning
FROM public.pos_shift sh
WHERE sh.accounting_status = 'pending'
  AND ABS(COALESCE(sh.cash_difference, 0)) >= 0.01
ON CONFLICT (aggregate_type, aggregate_id) DO NOTHING;

-- RLS estricta (default-deny para anon / authenticated; acceso exclusivo backend service_role)
ALTER TABLE public.accounting_outbox ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.accounting_outbox FROM anon, authenticated;
GRANT ALL ON TABLE public.accounting_outbox TO service_role;

