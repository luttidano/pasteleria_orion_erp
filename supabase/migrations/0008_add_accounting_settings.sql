-- Configuración global del módulo de contabilidad (fila única 'default')
CREATE TABLE IF NOT EXISTS public.accounting_settings (
  id text PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  accounting_start_date date,
  updated_by uuid REFERENCES public.profile(id) ON DELETE SET NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Registro inicial sin bloqueo retroactivo hasta que el contador defina la fecha de apertura
INSERT INTO public.accounting_settings (id, accounting_start_date)
VALUES ('default', NULL)
ON CONFLICT (id) DO NOTHING;

-- RLS estricta (solo authenticated / service_role)
ALTER TABLE public.accounting_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "accounting_settings_all_authenticated" ON public.accounting_settings;
CREATE POLICY "accounting_settings_all_authenticated" ON public.accounting_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE public.accounting_settings FROM anon;
GRANT ALL ON TABLE public.accounting_settings TO authenticated, service_role;

