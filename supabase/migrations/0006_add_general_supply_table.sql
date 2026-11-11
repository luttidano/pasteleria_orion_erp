-- =============================================================================
-- PASTELERÍA ORIÓN ERP — MIGRATION 0006: GENERAL SUPPLIES (INSUMOS GENERALES)
-- =============================================================================
-- Tabla para elementos operativos, de seguridad e higiene (guantes de cocina,
-- cofias, paños, detergente, utensilios) aislados de recetas y catálogo POS.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.general_supply (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  stock numeric(12, 3) NOT NULL DEFAULT 0 CHECK (stock >= 0::numeric),
  min_stock numeric(12, 3) NOT NULL DEFAULT 0 CHECK (min_stock >= 0::numeric),
  unit text NOT NULL DEFAULT 'un'::text,
  cost_price numeric(12, 2) DEFAULT 0 CHECK (cost_price >= 0::numeric),
  supplier_id uuid REFERENCES public.supplier(id) ON DELETE SET NULL,
  icon text DEFAULT '🧤'::text,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Índices de rendimiento (FK e indexado por categoría)
CREATE INDEX IF NOT EXISTS idx_general_supply_supplier ON public.general_supply(supplier_id);
CREATE INDEX IF NOT EXISTS idx_general_supply_category ON public.general_supply(category);

-- Seguridad RLS (solo usuarios autenticados y backend service_role)
ALTER TABLE public.general_supply ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "general_supply_all_authenticated" ON public.general_supply;
CREATE POLICY "general_supply_all_authenticated" ON public.general_supply
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.general_supply FROM anon;
GRANT ALL ON TABLE public.general_supply TO authenticated, service_role;

