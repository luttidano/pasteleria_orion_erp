-- =============================================================================
-- PASTELERÍA ORIÓN ERP — MIGRATION 0014: CONSOLIDACIÓN CUENTA MERCADO PAGO (1102)
-- =============================================================================
-- Objetivo:
-- 1. Consolidar los cobros digitales inmediatos (débito, crédito POS Mercado Pago
--    y transferencias) en la cuenta única `1102 Cuenta Mercado Pago / Banco`.
-- 2. Desactivar (`is_active = false`) las subcuentas `1103` y `1104` sin borrarlas,
--    preservando cualquier historial contable previo.
-- 3. Crear la cuenta de gasto `6105 Comisiones POS / Mercado Pago` para registrar
--    mensualmente la factura de comisiones (Opción A: 6105 + 1108 vs 1102).
-- =============================================================================

-- 1. Asegurar y renombrar cuenta 1102
INSERT INTO public.accounting_account (code, name, account_type, is_active)
VALUES ('1102', 'Cuenta Mercado Pago / Banco', 'activo', true)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  is_active = true;

-- 2. Desactivar subcuentas redundantes manteniendo trazabilidad histórica
UPDATE public.accounting_account
SET is_active = false
WHERE code IN ('1103', '1104');

-- 3. Crear cuenta de gasto para comisiones POS / Mercado Pago
INSERT INTO public.accounting_account (code, name, account_type, is_active)
VALUES ('6105', 'Comisiones POS / Mercado Pago', 'gasto', true)
ON CONFLICT (code) DO NOTHING;

