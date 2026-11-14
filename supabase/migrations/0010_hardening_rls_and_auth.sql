-- =============================================================================
-- PASTELERÍA ORIÓN ERP — MIGRATION 0010: HARDENING RLS, PRIVILEGES & AUTH TRIGGER
-- =============================================================================
-- Objetivo:
-- 1. Eliminar políticas RLS permisivas (`USING (true)` / `WITH CHECK (true)`) que
--    permitían bypass directo vía PostgREST usando `anon` o `authenticated`.
-- 2. Habilitar RLS por defecto (default-deny) en TODAS las tablas de `public` y
--    revocar privilegios directos de `anon` y `authenticated`. El acceso de
--    datos opera exclusivamente vía API NestJS (`service_role` / `DATABASE_URL`).
-- 3. Endurecer `public.handle_new_user()` fijando `search_path = ''` e impidiendo
--    lectura o escalamiento de roles desde `raw_user_meta_data->>'role'`.
-- =============================================================================

-- 1. Endurecer función trigger de alta de usuarios
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

-- 2. Eliminar eventual RPC administrativa expuesta al cliente si existiera
DROP FUNCTION IF EXISTS public.delete_user_by_admin(uuid);

-- 3. Habilitar RLS en TODAS las tablas del esquema public
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

-- 4. Eliminar TODAS las políticas permisivas previas en `public` (default-deny PostgREST)
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      pol.policyname,
      pol.schemaname,
      pol.tablename
    );
  END LOOP;
END
$$;

-- 5. Revocar acceso directo PostgREST/SQL a roles de navegador y conservar service_role
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

REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

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

GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

