-- =============================================================================
-- PASTELERÍA ORIÓN ERP — ESQUEMA CONSOLIDADO (POSTGRESQL / SUPABASE)
-- =============================================================================
-- Ejecuta este script en el SQL Editor de tu proyecto en Supabase
-- (https://supabase.com/dashboard/project/_/sql) para inicializar desde cero.
-- Tablas normalizadas en singular, control de inventario, empaques, recetas,
-- punto de venta (POS) y contabilidad de partida doble (Libro Diario).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. TABLAS MAESTRAS INDEPENDIENTES
-- =============================================================================

-- Categorías (ingredientes, recetas, POS)
CREATE TABLE IF NOT EXISTS public.category (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  type character varying NOT NULL CHECK (type::text = ANY (ARRAY['ingredient'::character varying, 'recipe'::character varying, 'pos'::character varying]::text[])),
  icon character varying,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Proveedores (Materia prima, Empaques, Reventa o Ambos)
CREATE TABLE IF NOT EXISTS public.supplier (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  delivery_schedule text NOT NULL,
  category text NOT NULL,
  approximate_prices text NOT NULL,
  contact_person text,
  icon text DEFAULT '🚚'::text,
  email text,
  address text,
  notes text,
  supplier_types text[] NOT NULL DEFAULT ARRAY['materia_prima'::text],
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Catálogo de Cuentas Contables
CREATE TABLE IF NOT EXISTS public.accounting_account (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code character varying NOT NULL UNIQUE,
  name character varying NOT NULL,
  account_type text NOT NULL CHECK (account_type = ANY (ARRAY['activo'::text, 'ingreso'::text, 'costo'::text, 'gasto'::text, 'pasivo'::text, 'patrimonio'::text])),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- =============================================================================
-- 2. USUARIOS & PERFILES (Vinculado a Supabase Auth)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.profile (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  role text NOT NULL DEFAULT 'user'::text CHECK (role = ANY (ARRAY['admin'::text, 'cashier'::text, 'baker'::text, 'user'::text])),
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- =============================================================================
-- 3. INVENTARIO, RECETARIO ARTESANAL & EMPAQUES
-- =============================================================================

-- Materias Primas / Ingredientes (100% Culinarios)
CREATE TABLE IF NOT EXISTS public.ingredient (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.category(id) ON DELETE SET NULL,
  name text NOT NULL,
  stock numeric NOT NULL DEFAULT 0 CHECK (stock >= 0::numeric),
  min_stock numeric NOT NULL DEFAULT 0 CHECK (min_stock >= 0::numeric),
  unit text NOT NULL DEFAULT 'kg'::text,
  price numeric DEFAULT 0,
  icon text,
  image_url text,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Relación Proveedor - Ingrediente (Costos de compra)
CREATE TABLE IF NOT EXISTS public.supplier_ingredient (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.supplier(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES public.ingredient(id) ON DELETE CASCADE,
  cost_price numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- Recetas (100% Culinarias, aisladas de empaques)
CREATE TABLE IF NOT EXISTS public.recipe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.category(id) ON DELETE SET NULL,
  name character varying NOT NULL,
  description text,
  yield_servings integer NOT NULL DEFAULT 1,
  image_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Insumos por Receta (Solo materias primas comestibles)
CREATE TABLE IF NOT EXISTS public.recipe_ingredient (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES public.recipe(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES public.ingredient(id) ON DELETE RESTRICT,
  quantity numeric NOT NULL CHECK (quantity > 0::numeric),
  unit character varying NOT NULL DEFAULT 'g'::character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Catálogo de Productos Terminados / Reventa
CREATE TABLE IF NOT EXISTS public.product (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.category(id) ON DELETE SET NULL,
  recipe_id uuid REFERENCES public.recipe(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.supplier(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  product_type text NOT NULL CHECK (product_type = ANY (ARRAY['manufactured'::text, 'resale'::text])),
  stock numeric NOT NULL DEFAULT 0 CHECK (stock >= 0::numeric),
  min_stock numeric NOT NULL DEFAULT 0 CHECK (min_stock >= 0::numeric),
  unit text NOT NULL DEFAULT 'un'::text,
  sale_price numeric NOT NULL DEFAULT 0,
  cost_price numeric DEFAULT 0,
  image_url text,
  icon text DEFAULT '🧁'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Material de Empaque & Despacho (Cajas, bolsas, domos, blondas, vasos)
CREATE TABLE IF NOT EXISTS public.packaging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  package_type text NOT NULL CHECK (package_type = ANY (ARRAY['primario'::text, 'secundario'::text])),
  category text NOT NULL,
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

-- =============================================================================
-- 4. PUNTO DE VENTA (POS)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.pos_sale (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text NOT NULL UNIQUE,
  payment_method text NOT NULL CHECK (payment_method = ANY (ARRAY['efectivo'::text, 'debito'::text, 'credito'::text, 'transferencia'::text])),
  subtotal numeric NOT NULL CHECK (subtotal >= 0::numeric),
  tax_amount numeric NOT NULL DEFAULT 0 CHECK (tax_amount >= 0::numeric),
  total numeric NOT NULL CHECK (total >= 0::numeric),
  status text NOT NULL DEFAULT 'completada'::text CHECK (status = ANY (ARRAY['completada'::text, 'anulada'::text])),
  sold_at timestamp with time zone NOT NULL DEFAULT now(),
  data_origin text NOT NULL DEFAULT 'demo'::text CHECK (data_origin = ANY (ARRAY['demo'::text, 'real'::text])),
  accounting_status text NOT NULL DEFAULT 'posted'::text CHECK (accounting_status = ANY (ARRAY['posted'::text, 'pending'::text, 'failed'::text])),
  accounting_error text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pos_sale_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.pos_sale(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.product(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric NOT NULL CHECK (unit_price >= 0::numeric),
  line_total numeric NOT NULL CHECK (line_total >= 0::numeric)
);

-- =============================================================================
-- 5. CONTABILIDAD (PARTIDA DOBLE - LIBRO DIARIO)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.accounting_entry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  concept character varying NOT NULL CHECK (length(TRIM(BOTH FROM concept)) > 0),
  origin text NOT NULL DEFAULT 'manual'::text CHECK (origin = ANY (ARRAY['manual'::text, 'pos'::text])),
  pos_sale_id uuid REFERENCES public.pos_sale(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.accounting_entry_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.accounting_entry(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounting_account(id) ON DELETE RESTRICT,
  debit numeric NOT NULL DEFAULT 0 CHECK (debit >= 0::numeric),
  credit numeric NOT NULL DEFAULT 0 CHECK (credit >= 0::numeric),
  description text
);

-- =============================================================================
-- 6. ÍNDICES DE RENDIMIENTO
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_ingredient_category ON public.ingredient(category_id);
CREATE INDEX IF NOT EXISTS idx_recipe_category ON public.recipe(category_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredient_recipe ON public.recipe_ingredient(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredient_ingredient ON public.recipe_ingredient(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_product_category ON public.product(category_id);
CREATE INDEX IF NOT EXISTS idx_product_recipe ON public.product(recipe_id);
CREATE INDEX IF NOT EXISTS idx_product_supplier ON public.product(supplier_id);
CREATE INDEX IF NOT EXISTS idx_packaging_supplier ON public.packaging(supplier_id);
CREATE INDEX IF NOT EXISTS idx_packaging_package_type ON public.packaging(package_type);
CREATE INDEX IF NOT EXISTS idx_pos_sale_items_sale ON public.pos_sale_item(sale_id);
CREATE INDEX IF NOT EXISTS idx_pos_sale_items_product ON public.pos_sale_item(product_id);
CREATE INDEX IF NOT EXISTS idx_pos_sale_sold_at ON public.pos_sale(sold_at DESC);
CREATE INDEX IF NOT EXISTS idx_accounting_entry_date ON public.accounting_entry(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_accounting_entry_pos_sale ON public.accounting_entry(pos_sale_id);
CREATE INDEX IF NOT EXISTS idx_accounting_entry_item_entry ON public.accounting_entry_item(entry_id);
CREATE INDEX IF NOT EXISTS idx_accounting_entry_item_account ON public.accounting_entry_item(account_id);

-- =============================================================================
-- 7. TRIGGER AUTOMÁTICO PARA AUTH.USERS -> PUBLIC.PROFILE
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profile (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- =============================================================================
-- 8. PLAN DE CUENTAS BÁSICO INICIAL (SEED)
-- =============================================================================

INSERT INTO public.accounting_account (code, name, account_type, is_active)
VALUES
  ('1101', 'Caja General Efectivo', 'activo', true),
  ('1102', 'Banco / Transbank Débito', 'activo', true),
  ('1103', 'Banco / Tarjeta Crédito', 'activo', true),
  ('1104', 'Banco / Transferencias', 'activo', true),
  ('1105', 'Inventario Materias Primas', 'activo', true),
  ('1106', 'Inventario Productos Terminados', 'activo', true),
  ('2101', 'Proveedores por Pagar', 'pasivo', true),
  ('2102', 'IVA Débito Fiscal', 'pasivo', true),
  ('4101', 'Venta de Pastelería y Bollería', 'ingreso', true),
  ('5101', 'Costo de Materias Primas e Insumos', 'costo', true),
  ('6101', 'Gastos Operativos y Remuneraciones', 'gasto', true)
ON CONFLICT (code) DO NOTHING;


-- =============================================================================
-- 9. PERMISOS Y POLÍTICAS DE ACCESO (ROW LEVEL SECURITY)
-- =============================================================================

ALTER TABLE public.supplier ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packaging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_ingredient ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supplier_all_authenticated" ON public.supplier;
CREATE POLICY "supplier_all_authenticated" ON public.supplier
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "packaging_all_authenticated" ON public.packaging;
CREATE POLICY "packaging_all_authenticated" ON public.packaging
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "supplier_ingredient_all_authenticated" ON public.supplier_ingredient;
CREATE POLICY "supplier_ingredient_all_authenticated" ON public.supplier_ingredient
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public.supplier TO authenticated, service_role;
GRANT ALL ON TABLE public.packaging TO authenticated, service_role;
GRANT ALL ON TABLE public.supplier_ingredient TO authenticated, service_role;
