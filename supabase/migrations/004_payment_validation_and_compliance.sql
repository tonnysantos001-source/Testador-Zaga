-- Checker Zaga - Payment Validation & Compliance Architecture
-- Migration: 004_payment_validation_and_compliance
-- Created: 2026-08-29
-- Purpose: 
-- 1. Suporte à nova máquina de estados de validação de pagamento Mercado Pago
-- 2. Registro de Client Context e metadados de compliance antifraude
-- 3. Auditoria técnica de latência, códigos de erro e detalhes de gateway

-- =====================================================
-- Update table: card_results
-- Add validation states, compliance fields and client context
-- =====================================================
ALTER TABLE card_results
ADD COLUMN IF NOT EXISTS validation_state TEXT DEFAULT 'METHOD_VERIFIED',
ADD COLUMN IF NOT EXISTS client_metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS payer_email TEXT,
ADD COLUMN IF NOT EXISTS payer_name TEXT,
ADD COLUMN IF NOT EXISTS payer_document TEXT,
ADD COLUMN IF NOT EXISTS gateway_status_detail TEXT,
ADD COLUMN IF NOT EXISTS compliance_verified BOOLEAN DEFAULT true;

-- Update validation_state constraint with the new 6-stage lifecycle
ALTER TABLE card_results DROP CONSTRAINT IF EXISTS card_results_validation_state_check;
ALTER TABLE card_results
ADD CONSTRAINT card_results_validation_state_check CHECK (
    validation_state IN (
        'PENDING_TOKENIZATION',
        'TOKEN_GENERATED',
        'VALIDATING_PAYMENT_METHOD',
        'METHOD_VERIFIED',
        'METHOD_DECLINED',
        'TRANSACTION_ERROR'
    )
);

-- Update status check constraint to keep backwards compatibility while supporting enriched states
ALTER TABLE card_results DROP CONSTRAINT IF EXISTS card_results_status_check;
ALTER TABLE card_results
ADD CONSTRAINT card_results_status_check CHECK (
    status IN ('live', 'die', 'unknown', 'waiting_payment')
);

-- Indexes for efficient queries and analytics
CREATE INDEX IF NOT EXISTS idx_card_results_validation_state ON card_results(validation_state);
CREATE INDEX IF NOT EXISTS idx_card_results_compliance ON card_results(compliance_verified);
CREATE INDEX IF NOT EXISTS idx_card_results_payer_doc ON card_results(payer_document);

-- =====================================================
-- Update table: test_sessions
-- =====================================================
ALTER TABLE test_sessions
ADD COLUMN IF NOT EXISTS client_metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS gateway_provider TEXT DEFAULT 'mercadopago';

-- =====================================================
-- Update table: gateway_configs
-- Ensure Mercado Pago is the primary and only active gateway
-- =====================================================
INSERT INTO gateway_configs (name, url, is_active, config)
VALUES (
    'MercadoPago',
    'https://api.mercadopago.com',
    true,
    '{"provider": "mercadopago", "mode": "compliance_pre_authorization", "version": "v1"}'::jsonb
) ON CONFLICT (name) DO UPDATE
SET url = EXCLUDED.url,
    is_active = true,
    config = EXCLUDED.config,
    updated_at = NOW();

-- Deactivate any legacy gateway configurations (Appmax, Cielo)
UPDATE gateway_configs SET is_active = false WHERE name IN ('Appmax', 'Cielo', 'Zentripay');

COMMENT ON COLUMN card_results.validation_state IS 'Ciclo de vida do pagamento: PENDING_TOKENIZATION, TOKEN_GENERATED, VALIDATING_PAYMENT_METHOD, METHOD_VERIFIED, METHOD_DECLINED, TRANSACTION_ERROR';
COMMENT ON COLUMN card_results.client_metadata IS 'Metadados de sessão do cliente (User-Agent, Timezone, Language, Resolution) para antifraude e compliance';
COMMENT ON COLUMN card_results.compliance_verified IS 'Indica se os dados obrigatórios de conformidade (Payer, Identification, Context) foram validados';
