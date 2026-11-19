-- =============================================================================
-- Migración 0017: Incorporar Cuenta Patrimonial 3103 Resultados Acumulados
-- Permite distinguir los resultados de ejercicios anteriores respecto al
-- resultado del ejercicio vigente en el Balance General y Cierres Anuales.
-- =============================================================================

INSERT INTO public.accounting_account (code, name, account_type, is_active)
VALUES ('3103', 'Resultados Acumulados (Ejercicios Anteriores)', 'patrimonio', true)
ON CONFLICT (code) DO NOTHING;
