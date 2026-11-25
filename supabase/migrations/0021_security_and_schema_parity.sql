-- =============================================================================
-- PASTELERÍA ORIÓN ERP — MIGRACIÓN 0021: SEGURIDAD RLS, CONCURRENCIA POS Y PARIDAD
-- =============================================================================
-- Objetivo:
-- 1. Cerrar fuga de seguridad en cuentas por pagar:
--    - Eliminar políticas permisivas hacia clientes autenticados.
--    - Aplicar Default-Deny estricto (REVOKE de anon y authenticated, GRANT a service_role).
-- 2. Eliminar condición de carrera (race condition) en apertura de turnos POS:
--    - Reemplazar índice único uq_pos_shift_single_open de expresión ((1))
--      a columna directa (status) WHERE status = 'abierto', permitiendo
--      la cláusula ON CONFLICT (status) WHERE status = 'abierto' DO NOTHING.
-- 3. Paridad de esquema e integridad referencial:
--    - Permitir origen 'inventory' en constraint accounting_entry_origin_check.
--    - Asegurar ON DELETE RESTRICT en claves foráneas de pos_sale_item.
--    - Crear índice compuesto idx_accounting_entry_status_date para optimizar
--      filtros de asientos contables activos por fecha.
-- =============================================================================

-- 1. Seguridad RLS y Default-Deny en Cuentas por Pagar (Compras)
ALTER TABLE public.supplier_invoice ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supplier_invoice_all_authenticated" ON public.supplier_invoice;
DROP POLICY IF EXISTS "supplier_payment_all_authenticated" ON public.supplier_payment;

REVOKE ALL ON TABLE public.supplier_invoice FROM anon, authenticated;
REVOKE ALL ON TABLE public.supplier_payment FROM anon, authenticated;

GRANT ALL ON TABLE public.supplier_invoice TO service_role;
GRANT ALL ON TABLE public.supplier_payment TO service_role;

-- 2. Concurrencia de Turno POS: Índice único compatible con ON CONFLICT
DROP INDEX IF EXISTS public.uq_pos_shift_single_open;
CREATE UNIQUE INDEX IF NOT EXISTS uq_pos_shift_single_open
  ON public.pos_shift (status)
  WHERE status = 'abierto';

-- 3. Integridad Referencial y Paridad de Constraints
-- A. Extender check de origen en asientos contables para admitir inventario
ALTER TABLE public.accounting_entry
  DROP CONSTRAINT IF EXISTS accounting_entry_origin_check;

ALTER TABLE public.accounting_entry
  ADD CONSTRAINT accounting_entry_origin_check
  CHECK (origin = ANY (ARRAY['manual'::text, 'pos'::text, 'inventory'::text, 'closing'::text, 'reversal'::text]));

-- B. Proteger historial de ítems vendidos contra eliminación accidental de maestros
ALTER TABLE public.pos_sale_item
  DROP CONSTRAINT IF EXISTS pos_sale_items_product_id_fkey;

ALTER TABLE public.pos_sale_item
  ADD CONSTRAINT pos_sale_items_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.product(id) ON DELETE RESTRICT;

ALTER TABLE public.pos_sale_item
  DROP CONSTRAINT IF EXISTS pos_sale_items_packaging_id_fkey;

ALTER TABLE public.pos_sale_item
  ADD CONSTRAINT pos_sale_items_packaging_id_fkey
  FOREIGN KEY (packaging_id) REFERENCES public.packaging(id) ON DELETE RESTRICT;

-- 4. Índices de Rendimiento
CREATE INDEX IF NOT EXISTS idx_accounting_entry_status_date
  ON public.accounting_entry(status, entry_date DESC);
