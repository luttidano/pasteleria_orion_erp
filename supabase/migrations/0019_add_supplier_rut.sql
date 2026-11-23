-- =============================================================================
-- Migración 0019: Agregar campo RUT a Proveedores (supplier)
-- Permite el control tributario formal en el Libro de Compras (SII) y pagos en CxP.
-- =============================================================================

ALTER TABLE public.supplier ADD COLUMN IF NOT EXISTS rut VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_supplier_rut ON public.supplier(rut);
