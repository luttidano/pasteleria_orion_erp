-- =============================================================================
-- PASTELERÍA ORIÓN ERP — MIGRATION 0002: PACKAGING & SUPPLIER TYPES ARRAY
-- =============================================================================

-- 1. Crear la nueva columna supplier_types si aún no existe
ALTER TABLE public.supplier 
  ADD COLUMN IF NOT EXISTS supplier_types text[] DEFAULT ARRAY['materia_prima'::text];

-- 2. Si la columna vieja 'supplier_type' todavía existe, migrar datos y eliminarla limpiamente
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'supplier' AND column_name = 'supplier_type'
  ) THEN
    -- Migrar valores existentes a la nueva columna de arreglo
    UPDATE public.supplier 
    SET supplier_types = CASE 
      WHEN supplier_type::text = 'ambos' THEN ARRAY['materia_prima'::text, 'reventa'::text]
      WHEN supplier_type::text IS NOT NULL AND supplier_type::text != '' THEN ARRAY[supplier_type::text]
      ELSE ARRAY['materia_prima'::text]
    END;

    -- Eliminar la columna vieja y sus restricciones (evita conflictos de CHECK)
    ALTER TABLE public.supplier DROP COLUMN supplier_type CASCADE;
  END IF;
END $$;

-- 3. Asegurar NOT NULL y DEFAULT de arreglo
ALTER TABLE public.supplier ALTER COLUMN supplier_types SET NOT NULL;
ALTER TABLE public.supplier ALTER COLUMN supplier_types SET DEFAULT ARRAY['materia_prima'::text];

-- 4. Crear tabla de empaques (aislada de las recetas culinarias)
CREATE TABLE IF NOT EXISTS public.packaging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  package_type text NOT NULL CHECK (package_type = ANY (ARRAY['primario'::text, 'secundario'::text])),
  category text NOT NULL,           -- 'Cajas', 'Bolsas', 'Domos', 'Bases', 'Vasos', 'Otros'
  stock numeric NOT NULL DEFAULT 0 CHECK (stock >= 0::numeric),
  min_stock numeric NOT NULL DEFAULT 0 CHECK (min_stock >= 0::numeric),
  unit text NOT NULL DEFAULT 'un'::text,
  cost_price numeric DEFAULT 0,
  supplier_id uuid REFERENCES public.supplier(id) ON DELETE SET NULL,
  icon text DEFAULT '📦'::text,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 5. Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_packaging_supplier ON public.packaging(supplier_id);
CREATE INDEX IF NOT EXISTS idx_packaging_package_type ON public.packaging(package_type);
CREATE INDEX IF NOT EXISTS idx_packaging_category ON public.packaging(category);