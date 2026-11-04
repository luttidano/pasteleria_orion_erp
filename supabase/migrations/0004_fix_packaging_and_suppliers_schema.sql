-- =============================================================================
-- PASTELERÍA ORIÓN ERP — MIGRATION 0004: PACKAGING & SUPPLIERS SCHEMA & RLS
-- =============================================================================

-- 1. EXTENSIÓN UUID (Requerida para gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABLA: PROVEEDORES (public.supplier)
CREATE TABLE IF NOT EXISTS public.supplier (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL DEFAULT 'Sin registrar',
  delivery_schedule text NOT NULL DEFAULT 'A coordinar',
  category text NOT NULL DEFAULT 'General',
  approximate_prices text NOT NULL DEFAULT 'A consultar',
  contact_person text,
  icon text DEFAULT '🚚',
  email text,
  address text,
  notes text,
  supplier_types text[] NOT NULL DEFAULT ARRAY['materia_prima'::text],
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Asegurar columnas si la tabla ya existía previamente
ALTER TABLE public.supplier 
  ADD COLUMN IF NOT EXISTS supplier_types text[] DEFAULT ARRAY['materia_prima'::text];
ALTER TABLE public.supplier 
  ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.supplier 
  ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.supplier 
  ADD COLUMN IF NOT EXISTS icon text DEFAULT '🚚';

-- Migrar columna legacy 'supplier_type' si existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'supplier' AND column_name = 'supplier_type'
  ) THEN
    UPDATE public.supplier 
    SET supplier_types = CASE 
      WHEN supplier_type::text = 'ambos' THEN ARRAY['materia_prima'::text, 'reventa'::text]
      WHEN supplier_type::text IS NOT NULL AND supplier_type::text != '' THEN ARRAY[supplier_type::text]
      ELSE ARRAY['materia_prima'::text]
    END
    WHERE supplier_types IS NULL OR cardinality(supplier_types) = 0;

    ALTER TABLE public.supplier DROP COLUMN supplier_type CASCADE;
  END IF;
END $$;

-- 3. TABLA: EMPAQUES & ENVASES DE DESPACHO (public.packaging)
CREATE TABLE IF NOT EXISTS public.packaging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  package_type text NOT NULL CHECK (package_type = ANY (ARRAY['primario'::text, 'secundario'::text])),
  category text NOT NULL DEFAULT 'Cajas',
  stock numeric NOT NULL DEFAULT 0 CHECK (stock >= 0::numeric),
  min_stock numeric NOT NULL DEFAULT 0 CHECK (min_stock >= 0::numeric),
  unit text NOT NULL DEFAULT 'un'::text,
  cost_price numeric DEFAULT 0,
  supplier_id uuid REFERENCES public.supplier(id) ON DELETE SET NULL,
  icon text DEFAULT '📦',
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Asegurar columnas si la tabla packaging ya existía
ALTER TABLE public.packaging 
  ADD COLUMN IF NOT EXISTS package_type text NOT NULL DEFAULT 'primario';
ALTER TABLE public.packaging 
  ADD COLUMN IF NOT EXISTS icon text DEFAULT '📦';
ALTER TABLE public.packaging 
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.supplier(id) ON DELETE SET NULL;

-- 4. TABLA INTERMEDIA: PROVEEDOR - INGREDIENTE (public.supplier_ingredient)
CREATE TABLE IF NOT EXISTS public.supplier_ingredient (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.supplier(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES public.ingredient(id) ON DELETE CASCADE,
  cost_price numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT uq_supplier_ingredient UNIQUE (supplier_id, ingredient_id)
);

-- 5. ÍNDICES DE RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_supplier_types ON public.supplier USING GIN (supplier_types);
CREATE INDEX IF NOT EXISTS idx_packaging_supplier ON public.packaging(supplier_id);
CREATE INDEX IF NOT EXISTS idx_packaging_package_type ON public.packaging(package_type);
CREATE INDEX IF NOT EXISTS idx_packaging_category ON public.packaging(category);
CREATE INDEX IF NOT EXISTS idx_supplier_ingredient_supplier ON public.supplier_ingredient(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_ingredient_ingredient ON public.supplier_ingredient(ingredient_id);

-- 6. POLÍTICAS DE ACCESO Y SEGURIDAD ROW LEVEL SECURITY (RLS)
ALTER TABLE public.supplier ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packaging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_ingredient ENABLE ROW LEVEL SECURITY;

-- Políticas para proveedores (supplier)
DROP POLICY IF EXISTS "supplier_all_authenticated" ON public.supplier;
CREATE POLICY "supplier_all_authenticated" ON public.supplier
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "supplier_select_anon" ON public.supplier;
CREATE POLICY "supplier_select_anon" ON public.supplier
  FOR SELECT
  TO anon
  USING (true);

-- Políticas para empaques (packaging)
DROP POLICY IF EXISTS "packaging_all_authenticated" ON public.packaging;
CREATE POLICY "packaging_all_authenticated" ON public.packaging
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "packaging_select_anon" ON public.packaging;
CREATE POLICY "packaging_select_anon" ON public.packaging
  FOR SELECT
  TO anon
  USING (true);

-- Políticas para supplier_ingredient
DROP POLICY IF EXISTS "supplier_ingredient_all_authenticated" ON public.supplier_ingredient;
CREATE POLICY "supplier_ingredient_all_authenticated" ON public.supplier_ingredient
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "supplier_ingredient_select_anon" ON public.supplier_ingredient;
CREATE POLICY "supplier_ingredient_select_anon" ON public.supplier_ingredient
  FOR SELECT
  TO anon
  USING (true);

-- 7. PERMISOS DE TABLA PARA ROLES DE SUPABASE
GRANT ALL ON TABLE public.supplier TO authenticated, service_role;
GRANT SELECT ON TABLE public.supplier TO anon;

GRANT ALL ON TABLE public.packaging TO authenticated, service_role;
GRANT SELECT ON TABLE public.packaging TO anon;

GRANT ALL ON TABLE public.supplier_ingredient TO authenticated, service_role;
GRANT SELECT ON TABLE public.supplier_ingredient TO anon;

-- 8. DATOS INICIALES SEMILLA (Solo si las tablas están vacías)
INSERT INTO public.supplier (id, name, phone, delivery_schedule, category, approximate_prices, contact_person, icon, supplier_types, notes)
SELECT 
  'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d'::uuid,
  'Envases & Empaques del Maule',
  '+56987654321',
  'Lunes y Miércoles 09:00 - 13:00',
  'Cajas, Bolsas y Blondas',
  'Cajas torta: $450 - Bolsas kraft: $120',
  'Rodrigo Morales',
  '📦',
  ARRAY['empaque'::text],
  'Proveedor principal de cajas automontables y bolsas'
WHERE NOT EXISTS (SELECT 1 FROM public.supplier WHERE supplier_types @> ARRAY['empaque'::text]);

INSERT INTO public.packaging (name, package_type, category, stock, min_stock, unit, cost_price, supplier_id, icon, description)
SELECT 'Caja Torta 26x26 (Grande)', 'primario', 'Cajas', 120, 30, 'un', 520, 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d'::uuid, '📦', 'Caja de cartón microcorrugado blanco con ventana transparente'
WHERE NOT EXISTS (SELECT 1 FROM public.packaging WHERE name = 'Caja Torta 26x26 (Grande)');

INSERT INTO public.packaging (name, package_type, category, stock, min_stock, unit, cost_price, supplier_id, icon, description)
SELECT 'Bolsa Kraft con Fuelle N°4', 'secundario', 'Bolsas', 250, 50, 'un', 140, 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d'::uuid, '🛍️', 'Bolsa de papel kraft para despacho en mostrador'
WHERE NOT EXISTS (SELECT 1 FROM public.packaging WHERE name = 'Bolsa Kraft con Fuelle N°4');

INSERT INTO public.packaging (name, package_type, category, stock, min_stock, unit, cost_price, supplier_id, icon, description)
SELECT 'Domo Plástico Pet Individual', 'primario', 'Domos', 80, 25, 'un', 180, 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d'::uuid, '🧁', 'Envase plástico individual para porciones y cupcakes'
WHERE NOT EXISTS (SELECT 1 FROM public.packaging WHERE name = 'Domo Plástico Pet Individual');

