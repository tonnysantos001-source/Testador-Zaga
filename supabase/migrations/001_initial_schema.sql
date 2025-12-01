-- Checker Zaga - Initial Database Schema
-- Migration: 001_initial_schema
-- Created: 2025-11-30
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- =====================================================
-- Table: test_sessions
-- Purpose: Store information about each test session
-- =====================================================
CREATE TABLE IF NOT EXISTS test_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Session status
    status TEXT NOT NULL CHECK (
        status IN ('running', 'completed', 'stopped', 'error')
    ) DEFAULT 'running',
    -- Configuration
    gateway_url TEXT NOT NULL,
    total_cards INTEGER NOT NULL DEFAULT 0,
    processed_cards INTEGER NOT NULL DEFAULT 0,
    -- Results summary
    live_count INTEGER NOT NULL DEFAULT 0,
    die_count INTEGER NOT NULL DEFAULT 0,
    unknown_count INTEGER NOT NULL DEFAULT 0,
    -- Metadata
    user_ip TEXT,
    user_agent TEXT,
    -- Performance metrics
    avg_response_time_ms INTEGER,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);
-- Indexes for test_sessions
CREATE INDEX idx_test_sessions_status ON test_sessions(status);
CREATE INDEX idx_test_sessions_created ON test_sessions(created_at DESC);
CREATE INDEX idx_test_sessions_updated ON test_sessions(updated_at DESC);
-- =====================================================
-- Table: card_results
-- Purpose: Store individual card test results
-- =====================================================
CREATE TABLE IF NOT EXISTS card_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES test_sessions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Card data (partially masked for security)
    -- Only store first 4 and last 4 digits
    card_first4 TEXT NOT NULL,
    card_last4 TEXT NOT NULL,
    exp_month TEXT,
    exp_year TEXT,
    -- Test result
    status TEXT NOT NULL CHECK (status IN ('live', 'die', 'unknown')),
    amount DECIMAL(10, 2),
    message TEXT,
    -- Gateway response
    gateway_response JSONB,
    response_time_ms INTEGER,
    error_code TEXT,
    -- Processing order
    processing_order INTEGER NOT NULL
);
-- Indexes for card_results
CREATE INDEX idx_card_results_session ON card_results(session_id);
CREATE INDEX idx_card_results_status ON card_results(status);
CREATE INDEX idx_card_results_created ON card_results(created_at DESC);
CREATE INDEX idx_card_results_session_status ON card_results(session_id, status);
-- =====================================================
-- Table: gateway_configs
-- Purpose: Store gateway configurations
-- =====================================================
CREATE TABLE IF NOT EXISTS gateway_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    name TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    -- Gateway-specific configuration
    config JSONB DEFAULT '{}'::jsonb,
    -- Statistics
    success_rate DECIMAL(5, 2),
    avg_response_time_ms INTEGER,
    total_tests INTEGER NOT NULL DEFAULT 0,
    last_used_at TIMESTAMPTZ
);
-- Index for gateway_configs
CREATE INDEX idx_gateway_configs_active ON gateway_configs(is_active);
CREATE INDEX idx_gateway_configs_name ON gateway_configs(name);
-- =====================================================
-- Row Level Security (RLS)
-- Enable RLS on all tables
-- =====================================================
ALTER TABLE test_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE gateway_configs ENABLE ROW LEVEL SECURITY;
-- Note: Edge Functions will use service_role to bypass RLS
-- For now, we'll create a basic policy that denies everything
-- This ensures data can only be accessed via Edge Functions
CREATE POLICY "Deny all access to test_sessions" ON test_sessions FOR ALL USING (false);
CREATE POLICY "Deny all access to card_results" ON card_results FOR ALL USING (false);
CREATE POLICY "Deny all access to gateway_configs" ON gateway_configs FOR ALL USING (false);
-- =====================================================
-- Function: Update updated_at timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Trigger for test_sessions
CREATE TRIGGER update_test_sessions_updated_at BEFORE
UPDATE ON test_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- Trigger for gateway_configs
CREATE TRIGGER update_gateway_configs_updated_at BEFORE
UPDATE ON gateway_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- =====================================================
-- Function: Calculate session statistics
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_session_stats(session_uuid UUID) RETURNS TABLE (
        live_count BIGINT,
        die_count BIGINT,
        unknown_count BIGINT,
        avg_response_time NUMERIC
    ) AS $$ BEGIN RETURN QUERY
SELECT COUNT(*) FILTER (
        WHERE status = 'live'
    ) as live_count,
    COUNT(*) FILTER (
        WHERE status = 'die'
    ) as die_count,
    COUNT(*) FILTER (
        WHERE status = 'unknown'
    ) as unknown_count,
    AVG(response_time_ms) as avg_response_time
FROM card_results
WHERE session_id = session_uuid;
END;
$$ LANGUAGE plpgsql;
-- =====================================================
-- Initial Data: Default Gateway Config (Optional)
-- =====================================================
-- INSERT INTO gateway_configs (name, url, is_active)
-- VALUES ('Default Gateway', 'https://api.gateway.com/check', true)
-- ON CONFLICT (name) DO NOTHING;
-- =====================================================
-- Comments for documentation
-- =====================================================
COMMENT ON TABLE test_sessions IS 'Stores test session information and summary statistics';
COMMENT ON TABLE card_results IS 'Stores individual card test results with masked card numbers';
COMMENT ON TABLE gateway_configs IS 'Stores gateway configurations and performance metrics';
COMMENT ON COLUMN card_results.card_first4 IS 'First 4 digits of card number (for display only)';
COMMENT ON COLUMN card_results.card_last4 IS 'Last 4 digits of card number (for display only)';
COMMENT ON COLUMN card_results.gateway_response IS 'Full gateway response stored as JSONB for debugging';