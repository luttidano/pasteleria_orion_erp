-- 1. Tabla de Períodos Contables Mensuales
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

-- 2. Ampliar accounting_entry para soportar cierre anual y anulaciones auditables
ALTER TABLE public.accounting_entry
  DROP CONSTRAINT IF EXISTS accounting_entry_origin_check;

ALTER TABLE public.accounting_entry
  ADD CONSTRAINT accounting_entry_origin_check
  CHECK (origin = ANY (ARRAY['manual'::text, 'pos'::text, 'closing'::text, 'reversal'::text]));

ALTER TABLE public.accounting_entry
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'::text
    CHECK (status = ANY (ARRAY['active'::text, 'voided'::text])),
  ADD COLUMN IF NOT EXISTS voided_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS voided_by uuid REFERENCES public.profile(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS void_reason text,
  ADD COLUMN IF NOT EXISTS reversed_entry_id uuid REFERENCES public.accounting_entry(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS closing_year integer;

-- Evita duplicar asientos de cierre anual para el mismo año fiscal
CREATE UNIQUE INDEX IF NOT EXISTS uq_accounting_entry_closing_year
  ON public.accounting_entry(closing_year)
  WHERE origin = 'closing' AND status = 'active' AND closing_year IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_accounting_period_year_month ON public.accounting_period(year DESC, month DESC);
CREATE INDEX IF NOT EXISTS idx_accounting_period_status ON public.accounting_period(status);
CREATE INDEX IF NOT EXISTS idx_accounting_period_closing_entry ON public.accounting_period(closing_entry_id);
CREATE INDEX IF NOT EXISTS idx_accounting_entry_reversed ON public.accounting_entry(reversed_entry_id);

-- 3. Asegurar cuenta patrimonial para Refundición
INSERT INTO public.accounting_account (code, name, account_type, is_active)
VALUES
  ('3101', 'Capital Social Inicial', 'patrimonio', true),
  ('3102', 'Resultado del Ejercicio', 'patrimonio', true)
ON CONFLICT (code) DO NOTHING;

-- 4. RLS estricta (solo authenticated / service_role)
ALTER TABLE public.accounting_period ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "accounting_period_all_authenticated" ON public.accounting_period;
CREATE POLICY "accounting_period_all_authenticated" ON public.accounting_period
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE public.accounting_period FROM anon;
GRANT ALL ON TABLE public.accounting_period TO authenticated, service_role;