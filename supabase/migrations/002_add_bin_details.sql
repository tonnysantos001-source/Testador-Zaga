-- Checker Zaga - Update Schema
-- Migration: 002_add_bin_details
-- Created: 2025-11-30
-- Purpose: 
-- 1. Store full card number (as requested by user)
-- 2. Add columns for BIN/Bank details
ALTER TABLE card_results
ADD COLUMN IF NOT EXISTS card_number TEXT,
    -- Storing full number as requested
ADD COLUMN IF NOT EXISTS card_brand TEXT,
    ADD COLUMN IF NOT EXISTS card_type TEXT,
    ADD COLUMN IF NOT EXISTS card_bank TEXT,
    ADD COLUMN IF NOT EXISTS card_country TEXT,
    ADD COLUMN IF NOT EXISTS card_level TEXT;
-- e.g., CLASSIC, GOLD, PLATINUM
-- Update comment to reflect change
COMMENT ON COLUMN card_results.card_number IS 'Full card number (stored in plain text as requested)';