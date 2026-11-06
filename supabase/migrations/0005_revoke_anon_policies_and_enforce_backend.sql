-- =============================================================================
-- PASTELERÍA ORIÓN ERP — MIGRATION 0005: REVOKE ANON POLICIES & ENFORCE BACKEND
-- =============================================================================

-- 1. Eliminar políticas que permitían lectura anónima sin autenticación
DROP POLICY IF EXISTS "supplier_select_anon" ON public.supplier;
DROP POLICY IF EXISTS "packaging_select_anon" ON public.packaging;
DROP POLICY IF EXISTS "supplier_ingredient_select_anon" ON public.supplier_ingredient;

-- 2. Revocar permisos directos concedidos al rol anon
REVOKE ALL ON TABLE public.supplier FROM anon;
REVOKE ALL ON TABLE public.packaging FROM anon;
REVOKE ALL ON TABLE public.supplier_ingredient FROM anon;

-- 3. Asegurar que solo usuarios autenticados y service_role (backend NestJS) tengan acceso
GRANT ALL ON TABLE public.supplier TO authenticated, service_role;
GRANT ALL ON TABLE public.packaging TO authenticated, service_role;
GRANT ALL ON TABLE public.supplier_ingredient TO authenticated, service_role;

