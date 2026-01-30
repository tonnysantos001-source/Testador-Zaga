-- Migration: 003_add_zentripay_support
-- Purpose: Add support for Zentripay gateway fields
-- =====================================================
-- Update table: test_sessions
-- Add payment method support
-- =====================================================
ALTER TABLE test_sessions
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'credit_card';
-- Check constraint for payment modes
ALTER TABLE test_sessions DROP CONSTRAINT IF EXISTS test_sessions_payment_method_check;
ALTER TABLE test_sessions
ADD CONSTRAINT test_sessions_payment_method_check CHECK (
        payment_method IN ('credit_card', 'pix', 'boleto')
    );
-- =====================================================
-- Update table: card_results
-- Add fields for PIX and Boleto support + Transaction IDs
-- =====================================================
ALTER TABLE card_results
ADD COLUMN IF NOT EXISTS transaction_id TEXT,
    ADD COLUMN IF NOT EXISTS external_reference TEXT,
    ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'credit_card',
    ADD COLUMN IF NOT EXISTS qrcode_content TEXT,
    -- For PIX
ADD COLUMN IF NOT EXISTS qrcode_image TEXT,
    -- For PIX
ADD COLUMN IF NOT EXISTS barcode TEXT,
    -- For Boleto
ADD COLUMN IF NOT EXISTS digitable_line TEXT;
-- For Boleto
-- Drop existing status check to allow more flexible statuses if needed
ALTER TABLE card_results DROP CONSTRAINT IF EXISTS card_results_status_check;
-- Re-add status check with expanded statuses if needed, 
-- but for now keeping live/die/unknown is safest for frontend compatibility
-- We will map Zentripay statuses to these 3 core statuses in the Edge Function
ALTER TABLE card_results
ADD CONSTRAINT card_results_status_check CHECK (
        status IN ('live', 'die', 'unknown', 'waiting_payment')
    );
-- =====================================================
-- Update table: gateway_configs
-- Add Zentripay config
-- =====================================================
INSERT INTO gateway_configs (name, url, is_active, config)
VALUES (
        'Zentripay',
        'https://api.zentripay.com.br',
        true,
        '{"provider": "v2", "version": "v1"}'::jsonb
    ) ON CONFLICT (name) DO
UPDATE
SET url = EXCLUDED.url,
    is_active = true,
    updated_at = NOW();
-- Deactivate Appmax/Cielo if they exist (optional, keeping active primarily for history)
-- UPDATE gateway_configs SET is_active = false WHERE name IN ('Appmax', 'Cielo');