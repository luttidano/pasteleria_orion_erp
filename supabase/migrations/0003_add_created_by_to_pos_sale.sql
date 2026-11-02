-- Agregar columna created_by vinculada a profile
ALTER TABLE public.pos_sale
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profile(id) ON DELETE SET NULL;

-- Índice para consultas rápidas por cajero
CREATE INDEX IF NOT EXISTS idx_pos_sale_created_by ON public.pos_sale(created_by);