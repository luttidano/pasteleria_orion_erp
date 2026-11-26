-- =============================================================================
-- PASTELERÍA ORIÓN ERP — MIGRACIÓN 0023: PRECISIÓN DECIMAL EN INVENTARIO Y RECETAS
-- =============================================================================
-- Objetivo:
--   Limpiar residuos de punto flotante IEEE-754 almacenados en columnas numeric
--   sin escala fija (ej. 8.600000000000001) y fijar la escala numeric(12, 3)
--   alineada con Prisma (@db.Decimal(12, 3)).
-- =============================================================================

ALTER TABLE public.ingredient
  ALTER COLUMN stock TYPE numeric(12, 3) USING ROUND(stock, 3),
  ALTER COLUMN min_stock TYPE numeric(12, 3) USING ROUND(min_stock, 3);

ALTER TABLE public.recipe_ingredient
  ALTER COLUMN quantity TYPE numeric(12, 3) USING GREATEST(0.001, ROUND(quantity, 3));

ALTER TABLE public.product
  ALTER COLUMN stock TYPE numeric(12, 3) USING ROUND(stock, 3),
  ALTER COLUMN min_stock TYPE numeric(12, 3) USING ROUND(min_stock, 3);

ALTER TABLE public.packaging
  ALTER COLUMN stock TYPE numeric(12, 3) USING ROUND(stock, 3),
  ALTER COLUMN min_stock TYPE numeric(12, 3) USING ROUND(min_stock, 3);
