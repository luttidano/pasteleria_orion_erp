-- =============================================================================
-- Migración 0018: Módulo de Compras y Cuentas por Pagar (CxP)
-- Permite el seguimiento riguroso de facturas a crédito de proveedores,
-- control de vencimientos, abonos parciales y liquidación contable (ACID / Outbox).
-- =============================================================================

-- 1. Tabla de Facturas de Proveedores (Cuentas por Pagar)
CREATE TABLE IF NOT EXISTS public.supplier_invoice (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.supplier(id) ON DELETE RESTRICT,
  invoice_number VARCHAR(100) NOT NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount > 0),
  paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0 AND paid_amount <= total_amount),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'voided')),
  has_invoice BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by_id UUID REFERENCES public.profile(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT uq_supplier_invoice_number UNIQUE (supplier_id, invoice_number)
);

-- 2. Tabla de Pagos / Abonos a Proveedores
CREATE TABLE IF NOT EXISTS public.supplier_payment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.supplier_invoice(id) ON DELETE RESTRICT,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('transferencia', 'efectivo', 'banco')),
  reference VARCHAR(150),
  notes TEXT,
  accounting_entry_id UUID REFERENCES public.accounting_entry(id) ON DELETE SET NULL,
  created_by_id UUID REFERENCES public.profile(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

-- 3. Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_supplier_invoice_supplier ON public.supplier_invoice(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoice_status ON public.supplier_invoice(status);
CREATE INDEX IF NOT EXISTS idx_supplier_invoice_due_date ON public.supplier_invoice(due_date);
CREATE INDEX IF NOT EXISTS idx_supplier_invoice_created_at ON public.supplier_invoice(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_supplier_payment_invoice ON public.supplier_payment(invoice_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payment_date ON public.supplier_payment(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_supplier_payment_accounting_entry ON public.supplier_payment(accounting_entry_id);

-- 4. Seguridad RLS (Row Level Security)
ALTER TABLE public.supplier_invoice ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supplier_invoice_all_authenticated" ON public.supplier_invoice;
CREATE POLICY "supplier_invoice_all_authenticated" ON public.supplier_invoice
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "supplier_payment_all_authenticated" ON public.supplier_payment;
CREATE POLICY "supplier_payment_all_authenticated" ON public.supplier_payment
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE public.supplier_invoice FROM anon;
GRANT ALL ON TABLE public.supplier_invoice TO authenticated, service_role;

REVOKE ALL ON TABLE public.supplier_payment FROM anon;
GRANT ALL ON TABLE public.supplier_payment TO authenticated, service_role;
