-- =============================================================================
-- PASTELERÍA ORIÓN ERP — MIGRATION 0015: BAJA LÓGICA, INTEGRIDAD Y PRECIOS DRY
-- =============================================================================
-- Objetivo:
-- 1. Añadir columna `is_active` para soportar baja lógica (soft delete) en:
--    - `public.product`
--    - `public.recipe`
--    - `public.packaging`
-- 2. Añadir columna `sale_price` en `public.packaging` con backfill de $100 para bolsas.
-- 3. Añadir columna `supply_modality` en `public.supplier` con backfill según heurística histórica.
-- 4. Modificar claves foráneas de `ON DELETE SET NULL` a `ON DELETE RESTRICT` para
--    proteger la integridad histórica de ventas (pos_sale_item) y productos con receta.
-- =============================================================================

-- 1. Columnas is_active para baja lógica
ALTER TABLE public.product
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.recipe
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.packaging
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Índices para optimizar consultas de registros activos
CREATE INDEX IF NOT EXISTS idx_product_is_active ON public.product(is_active);
CREATE INDEX IF NOT EXISTS idx_recipe_is_active ON public.recipe(is_active);
CREATE INDEX IF NOT EXISTS idx_packaging_is_active ON public.packaging(is_active);

-- 2. Columna sale_price en packaging (DRY para empaques secundarios / bolsas)
ALTER TABLE public.packaging
  ADD COLUMN IF NOT EXISTS sale_price numeric(12, 2) NOT NULL DEFAULT 0 CHECK (sale_price >= 0::numeric);

-- Backfill automático: bolsas a $100 CLP según la regla de negocio
UPDATE public.packaging
SET sale_price = 100
WHERE lower(name) LIKE '%bolsa%' AND sale_price = 0;

-- 3. Columna supply_modality en supplier
ALTER TABLE public.supplier
  ADD COLUMN IF NOT EXISTS supply_modality text NOT NULL DEFAULT 'despacho'
  CHECK (supply_modality IN ('despacho', 'presencial', 'mixto'));

-- Backfill histórico de modalidades según registros actuales
UPDATE public.supplier
SET supply_modality = 'presencial'
WHERE supply_modality = 'despacho' AND (
  lower(delivery_schedule) LIKE '%presencial%' OR
  lower(delivery_schedule) LIKE '%retiro%' OR
  lower(delivery_schedule) LIKE '%local%' OR
  lower(delivery_schedule) LIKE '%mayorista%' OR
  lower(notes) LIKE '%presencial%' OR
  lower(notes) LIKE '%local%' OR
  lower(notes) LIKE '%mayorista%' OR
  lower(name) LIKE '%mayorista%' OR
  lower(name) LIKE '%vega%' OR
  icon IN ('🏬', '🏪', '🛒')
);

-- 4. Modificar Foreign Keys a ON DELETE RESTRICT

-- A. Producto -> Receta (evitar que una receta en uso se borre dejando productos huérfanos)
ALTER TABLE public.product
  DROP CONSTRAINT IF EXISTS product_recipe_id_fkey;

ALTER TABLE public.product
  ADD CONSTRAINT product_recipe_id_fkey
  FOREIGN KEY (recipe_id) REFERENCES public.recipe(id) ON DELETE RESTRICT;

-- B. Ítem de Venta POS -> Producto (proteger historial contable y comercial de ventas)
ALTER TABLE public.pos_sale_item
  DROP CONSTRAINT IF EXISTS pos_sale_items_product_id_fkey;

ALTER TABLE public.pos_sale_item
  ADD CONSTRAINT pos_sale_items_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.product(id) ON DELETE RESTRICT;

-- C. Ítem de Venta POS -> Empaque (proteger ventas con empaques secundarios cobrados)
ALTER TABLE public.pos_sale_item
  DROP CONSTRAINT IF EXISTS pos_sale_items_packaging_id_fkey;

ALTER TABLE public.pos_sale_item
  ADD CONSTRAINT pos_sale_items_packaging_id_fkey
  FOREIGN KEY (packaging_id) REFERENCES public.packaging(id) ON DELETE RESTRICT;

