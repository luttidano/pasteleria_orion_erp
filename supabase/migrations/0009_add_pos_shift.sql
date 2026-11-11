-- 1. Tabla de Turnos y Arqueos de Caja POS
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

-- 2. Vincular cada venta POS al turno activo
ALTER TABLE public.pos_sale
  ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES public.pos_shift(id) ON DELETE SET NULL;

-- 3. Garantizar a lo sumo un turno abierto simultáneamente
CREATE UNIQUE INDEX IF NOT EXISTS uq_pos_shift_single_open
  ON public.pos_shift ((1))
  WHERE status = 'abierto';

-- 4. Índices de rendimiento y llaves foráneas
CREATE INDEX IF NOT EXISTS idx_pos_shift_status ON public.pos_shift(status);
CREATE INDEX IF NOT EXISTS idx_pos_shift_opened_at ON public.pos_shift(opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_shift_closed_at ON public.pos_shift(closed_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_shift_opened_by ON public.pos_shift(opened_by);
CREATE INDEX IF NOT EXISTS idx_pos_shift_closed_by ON public.pos_shift(closed_by);
CREATE INDEX IF NOT EXISTS idx_pos_shift_closing_entry ON public.pos_shift(closing_entry_id);
CREATE INDEX IF NOT EXISTS idx_pos_sale_shift_id ON public.pos_sale(shift_id);
CREATE INDEX IF NOT EXISTS idx_pos_sale_unshifted_completed
  ON public.pos_sale(sold_at DESC)
  WHERE shift_id IS NULL AND status = 'completada';

-- 5. Cuentas contables para diferencias de arqueo de caja
INSERT INTO public.accounting_account (code, name, account_type, is_active)
VALUES
  ('4102', 'Sobrantes de Caja y Otros Ingresos', 'ingreso', true),
  ('6103', 'Faltantes y Diferencias de Caja', 'gasto', true)
ON CONFLICT (code) DO NOTHING;

-- 6. RLS estricta (solo authenticated / service_role)
ALTER TABLE public.pos_shift ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pos_shift_all_authenticated" ON public.pos_shift;
CREATE POLICY "pos_shift_all_authenticated" ON public.pos_shift
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE public.pos_shift FROM anon;
GRANT ALL ON TABLE public.pos_shift TO authenticated, service_role;

