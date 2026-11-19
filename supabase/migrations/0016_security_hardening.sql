-- ==============================================================================
-- Migración 0016: Endurecimiento de Seguridad RPC e Índices Duplicados (Auditoría #3)
-- ==============================================================================

-- 1. Revocar permisos públicos en funciones RPC de seguridad e internas
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user') THEN
    REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.create_pos_sale_transaction(text, text, numeric, numeric, numeric, jsonb);

-- 2. Eliminar índices duplicados o redundantes en pos_sale y pos_sale_item
DROP INDEX IF EXISTS public.idx_pos_sales_payment_method;
DROP INDEX IF EXISTS public.idx_pos_sales_sold_at;
DROP INDEX IF EXISTS public.idx_pos_sales_status;
DROP INDEX IF EXISTS public.idx_pos_sale_items_product_id;
DROP INDEX IF EXISTS public.idx_pos_sale_items_sale_id;
