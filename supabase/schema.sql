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
  rut varchar(20),
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

-- Catálogo de Cuentas Contables (Árbol Jerárquico)
CREATE TABLE IF NOT EXISTS public.accounting_account (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code character varying NOT NULL UNIQUE,
  name character varying NOT NULL,
  account_type text NOT NULL CHECK (account_type = ANY (ARRAY['activo'::text, 'ingreso'::text, 'costo'::text, 'gasto'::text, 'pasivo'::text, 'patrimonio'::text])),
  parent_id uuid REFERENCES public.accounting_account(id) ON DELETE RESTRICT,
  path character varying(100) NOT NULL DEFAULT '',
  level smallint NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 5),
  is_group boolean NOT NULL DEFAULT false,
  normal_balance character varying(10) NOT NULL DEFAULT 'debit' CHECK (normal_balance IN ('debit', 'credit')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accounting_account_parent ON public.accounting_account(parent_id);
CREATE INDEX IF NOT EXISTS idx_accounting_account_path ON public.accounting_account(path);
CREATE INDEX IF NOT EXISTS idx_accounting_account_level ON public.accounting_account(level);

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
-- Insumos Generales / Operativos (Guantes, limpieza, higiene, utensilios)
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
-- =============================================================================

-- =============================================================================
-- 4. PUNTO DE VENTA (POS)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.pos_shift (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_number bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  status text NOT NULL DEFAULT 'abierto'::text CHECK (status = ANY (ARRAY['abierto'::text, 'cerrado'::text])),
  opened_at timestamp with time zone NOT NULL DEFAULT now(),
  opened_by uuid REFERENCES public.profile(id) ON DELETE SET NULL,
  opening_cash numeric(12, 2) NOT NULL DEFAULT 0 CHECK (opening_cash >= 0::numeric),
  closed_at timestamp with time zone,
  closed_by uuid REFERENCES public.profile(id) ON DELETE SET NULL,
  total_sales numeric(12, 2) NOT NULL DEFAULT 0,
  transactions_count integer NOT NULL DEFAULT 0,
  cash_sales_total numeric(12, 2) NOT NULL DEFAULT 0,
  debit_total numeric(12, 2) NOT NULL DEFAULT 0,
  credit_total numeric(12, 2) NOT NULL DEFAULT 0,
  transfer_total numeric(12, 2) NOT NULL DEFAULT 0,
  card_pos_total numeric(12, 2) NOT NULL DEFAULT 0,
  expected_cash numeric(12, 2) NOT NULL DEFAULT 0,
  counted_cash numeric(12, 2),
  cash_difference numeric(12, 2),
  notes text,
  closing_entry_id uuid REFERENCES public.accounting_entry(id) ON DELETE SET NULL,
  accounting_status text NOT NULL DEFAULT 'none'::text CHECK (accounting_status = ANY (ARRAY['none'::text, 'posted'::text, 'pending'::text])),
  accounting_warning text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

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
  shift_id uuid REFERENCES public.pos_shift(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pos_sale_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.pos_sale(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.product(id) ON DELETE SET NULL,
  packaging_id uuid REFERENCES public.packaging(id) ON DELETE SET NULL,
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
  origin text NOT NULL DEFAULT 'manual'::text CHECK (origin = ANY (ARRAY['manual'::text, 'pos'::text, 'closing'::text, 'reversal'::text])),
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'voided'::text])),
  pos_sale_id uuid REFERENCES public.pos_sale(id) ON DELETE SET NULL,
  pos_shift_id uuid REFERENCES public.pos_shift(id) ON DELETE SET NULL,
  voided_at timestamp with time zone,
  voided_by uuid REFERENCES public.profile(id) ON DELETE SET NULL,
  void_reason text,
  reversed_entry_id uuid REFERENCES public.accounting_entry(id) ON DELETE SET NULL,
  closing_year integer,
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

CREATE TABLE IF NOT EXISTS public.accounting_period (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL CHECK (year >= 2000 AND year <= 2100),
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  status text NOT NULL DEFAULT 'abierto'::text CHECK (status = ANY (ARRAY['abierto'::text, 'cerrado'::text])),
  closed_at timestamp with time zone,
  closed_by uuid REFERENCES public.profile(id) ON DELETE SET NULL,
  reopened_at timestamp with time zone,
  reopened_by uuid REFERENCES public.profile(id) ON DELETE SET NULL,
  closing_entry_id uuid REFERENCES public.accounting_entry(id) ON DELETE SET NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT uq_accounting_period_year_month UNIQUE (year, month)
);

CREATE TABLE IF NOT EXISTS public.accounting_settings (
  id text PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  accounting_start_date date,
  updated_by uuid REFERENCES public.profile(id) ON DELETE SET NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- =============================================================================
-- 5B. IDEMPOTENCIA HTTP TRANSACCIONAL
-- =============================================================================

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

-- =============================================================================
-- 5C. CUENTAS POR PAGAR (CxP) Y FACTURAS DE PROVEEDORES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.supplier_invoice (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.supplier(id) ON DELETE RESTRICT,
  invoice_number varchar(100) NOT NULL,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  total_amount numeric(12, 2) NOT NULL CHECK (total_amount > 0),
  paid_amount numeric(12, 2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0 AND paid_amount <= total_amount),
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'voided')),
  has_invoice boolean NOT NULL DEFAULT true,
  notes text,
  created_by_id uuid REFERENCES public.profile(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT uq_supplier_invoice_number UNIQUE (supplier_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS public.supplier_payment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.supplier_invoice(id) ON DELETE RESTRICT,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  payment_method varchar(50) NOT NULL CHECK (payment_method IN ('transferencia', 'efectivo', 'banco')),
  reference varchar(150),
  notes text,
  accounting_entry_id uuid REFERENCES public.accounting_entry(id) ON DELETE SET NULL,
  created_by_id uuid REFERENCES public.profile(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
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
CREATE INDEX IF NOT EXISTS idx_general_supply_supplier ON public.general_supply(supplier_id);
CREATE INDEX IF NOT EXISTS idx_general_supply_category ON public.general_supply(category);
CREATE INDEX IF NOT EXISTS idx_pos_sale_items_sale ON public.pos_sale_item(sale_id);
CREATE INDEX IF NOT EXISTS idx_pos_sale_items_product ON public.pos_sale_item(product_id);
CREATE INDEX IF NOT EXISTS idx_pos_sale_item_packaging ON public.pos_sale_item(packaging_id);
CREATE INDEX IF NOT EXISTS idx_pos_sale_sold_at ON public.pos_sale(sold_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_sale_shift_id ON public.pos_sale(shift_id);
CREATE INDEX IF NOT EXISTS idx_pos_sale_unshifted_completed ON public.pos_sale(sold_at DESC) WHERE shift_id IS NULL AND status = 'completada';
CREATE UNIQUE INDEX IF NOT EXISTS uq_pos_shift_single_open ON public.pos_shift ((1)) WHERE status = 'abierto';
CREATE INDEX IF NOT EXISTS idx_pos_shift_status ON public.pos_shift(status);
CREATE INDEX IF NOT EXISTS idx_pos_shift_opened_at ON public.pos_shift(opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_shift_closed_at ON public.pos_shift(closed_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_shift_opened_by ON public.pos_shift(opened_by);
CREATE INDEX IF NOT EXISTS idx_pos_shift_closed_by ON public.pos_shift(closed_by);
CREATE INDEX IF NOT EXISTS idx_pos_shift_closing_entry ON public.pos_shift(closing_entry_id);
CREATE INDEX IF NOT EXISTS idx_accounting_entry_date ON public.accounting_entry(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_accounting_entry_pos_sale ON public.accounting_entry(pos_sale_id);
CREATE INDEX IF NOT EXISTS idx_accounting_entry_pos_shift ON public.accounting_entry(pos_shift_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_accounting_entry_pos_sale ON public.accounting_entry(pos_sale_id) WHERE pos_sale_id IS NOT NULL AND status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS uq_accounting_entry_pos_shift ON public.accounting_entry(pos_shift_id) WHERE pos_shift_id IS NOT NULL AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_accounting_entry_reversed ON public.accounting_entry(reversed_entry_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_accounting_entry_closing_year ON public.accounting_entry(closing_year) WHERE origin = 'closing' AND status = 'active' AND closing_year IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accounting_period_year_month ON public.accounting_period(year DESC, month DESC);
CREATE INDEX IF NOT EXISTS idx_accounting_period_status ON public.accounting_period(status);
CREATE INDEX IF NOT EXISTS idx_accounting_period_closing_entry ON public.accounting_period(closing_entry_id);
CREATE INDEX IF NOT EXISTS idx_accounting_entry_item_entry ON public.accounting_entry_item(entry_id);
CREATE INDEX IF NOT EXISTS idx_accounting_entry_item_account ON public.accounting_entry_item(account_id);
CREATE INDEX IF NOT EXISTS idx_idempotency_record_expires_at ON public.idempotency_record(expires_at);

-- =============================================================================
-- 7. TRIGGER AUTOMÁTICO PARA AUTH.USERS -> PUBLIC.PROFILE
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profile (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(pg_catalog.btrim(NEW.raw_user_meta_data->>'name'), ''),
      NULLIF(pg_catalog.split_part(COALESCE(NEW.email, ''), '@', 1), ''),
      'Usuario'
    ),
    NEW.email,
    'user'
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

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
  ('3101', 'Capital Social Inicial', 'patrimonio', true),
  ('3102', 'Resultado del Ejercicio', 'patrimonio', true),
  ('3103', 'Resultados Acumulados (Ejercicios Anteriores)', 'patrimonio', true),
  ('4101', 'Venta de Pastelería y Bollería', 'ingreso', true),
  ('4102', 'Sobrantes de Caja y Otros Ingresos', 'ingreso', true),
  ('5101', 'Costo de Materias Primas e Insumos', 'costo', true),
  ('6101', 'Gastos Operativos y Remuneraciones', 'gasto', true),
  ('6103', 'Faltantes y Diferencias de Caja', 'gasto', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.accounting_settings (id, accounting_start_date)
VALUES ('default', NULL)
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- 9. PERMISOS Y POLÍTICAS DE ACCESO (ROW LEVEL SECURITY - DEFAULT DENY CLIENTE)
-- =============================================================================

ALTER TABLE public.category ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_account ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredient ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_ingredient ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_ingredient ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packaging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.general_supply ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_shift ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_sale ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_sale_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_entry_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_period ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_record ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.category FROM anon, authenticated;
REVOKE ALL ON TABLE public.supplier FROM anon, authenticated;
REVOKE ALL ON TABLE public.accounting_account FROM anon, authenticated;
REVOKE ALL ON TABLE public.profile FROM anon, authenticated;
REVOKE ALL ON TABLE public.ingredient FROM anon, authenticated;
REVOKE ALL ON TABLE public.supplier_ingredient FROM anon, authenticated;
REVOKE ALL ON TABLE public.recipe FROM anon, authenticated;
REVOKE ALL ON TABLE public.recipe_ingredient FROM anon, authenticated;
REVOKE ALL ON TABLE public.product FROM anon, authenticated;
REVOKE ALL ON TABLE public.packaging FROM anon, authenticated;
REVOKE ALL ON TABLE public.general_supply FROM anon, authenticated;
REVOKE ALL ON TABLE public.pos_shift FROM anon, authenticated;
REVOKE ALL ON TABLE public.pos_sale FROM anon, authenticated;
REVOKE ALL ON TABLE public.pos_sale_item FROM anon, authenticated;
REVOKE ALL ON TABLE public.accounting_entry FROM anon, authenticated;
REVOKE ALL ON TABLE public.accounting_entry_item FROM anon, authenticated;
REVOKE ALL ON TABLE public.accounting_period FROM anon, authenticated;
REVOKE ALL ON TABLE public.accounting_settings FROM anon, authenticated;
REVOKE ALL ON TABLE public.idempotency_record FROM anon, authenticated;

GRANT ALL ON TABLE public.category TO service_role;
GRANT ALL ON TABLE public.supplier TO service_role;
GRANT ALL ON TABLE public.accounting_account TO service_role;
GRANT ALL ON TABLE public.profile TO service_role;
GRANT ALL ON TABLE public.ingredient TO service_role;
GRANT ALL ON TABLE public.supplier_ingredient TO service_role;
GRANT ALL ON TABLE public.recipe TO service_role;
GRANT ALL ON TABLE public.recipe_ingredient TO service_role;
GRANT ALL ON TABLE public.product TO service_role;
GRANT ALL ON TABLE public.packaging TO service_role;
GRANT ALL ON TABLE public.general_supply TO service_role;
GRANT ALL ON TABLE public.pos_shift TO service_role;
GRANT ALL ON TABLE public.pos_sale TO service_role;
GRANT ALL ON TABLE public.pos_sale_item TO service_role;
GRANT ALL ON TABLE public.accounting_entry TO service_role;
GRANT ALL ON TABLE public.accounting_entry_item TO service_role;
GRANT ALL ON TABLE public.accounting_period TO service_role;
GRANT ALL ON TABLE public.accounting_settings TO service_role;
GRANT ALL ON TABLE public.idempotency_record TO service_role;
