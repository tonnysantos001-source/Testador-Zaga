import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables!');
    console.error('Please check your .env file or Vercel project settings.');
}

// Create client with fallbacks to prevent crash on load
export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder',
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
        },
    }
);

export const isSupabaseConfigured = supabaseUrl && supabaseUrl !== 'https://placeholder.supabase.co';

// Types for our database
export interface TestSession {
    id: string;
    created_at: string;
    updated_at: string;
    status: 'running' | 'completed' | 'stopped' | 'error';
    gateway_url: string;
    total_cards: number;
    processed_cards: number;
    live_count: number;
    die_count: number;
    unknown_count: number;
    user_ip?: string;
    user_agent?: string;
    avg_response_time_ms?: number;
    started_at?: string;
    completed_at?: string;
}

export interface CardResult {
    id: string;
    session_id: string;
    created_at: string;
    card_number?: string; // Full number if available
    card_first4: string;
    card_last4: string;
    exp_month?: string;
    exp_year?: string;
    status: 'live' | 'die' | 'unknown';
    amount?: number;
    message?: string;
    gateway_response?: any;
    response_time_ms?: number;
    error_code?: string;
    processing_order: number;
    // BIN Details
    card_brand?: string;
    card_type?: string;
    card_bank?: string;
    card_country?: string;
    card_level?: string;
}

export interface GatewayConfig {
    id: string;
    created_at: string;
    updated_at: string;
    name: string;
    url: string;
    is_active: boolean;
    config?: any;
    success_rate?: number;
    avg_response_time_ms?: number;
    total_tests: number;
    last_used_at?: string;
}

// API Functions
export const api = {
    // Start a new test session
    async startSession(gatewayUrl: string, totalCards: number): Promise<{ sessionId: string }> {
        const { data, error } = await supabase.functions.invoke('start-test-session', {
            body: { gatewayUrl, totalCards },
        });

        if (error) throw error;
        return data;
    },

    // Test a single card
    async testCard(params: {
        sessionId: string;
        cardNumber: string;
        expMonth: string;
        expYear: string;
        cvv: string;
        gatewayUrl: string;
        processingOrder: number;
        amount?: number;
        proxyUrl?: string;
    }): Promise<CardResult> {
        const { data, error } = await supabase.functions.invoke('test-card', {
            body: params,
        });

        if (error) throw error;
        return data.testResult || data.result; // Fallback for safety
    },

    // Get session results
    async getSessionResults(sessionId: string): Promise<{
        session: TestSession;
        results: CardResult[];
    }> {
        const { data, error } = await supabase.functions.invoke('get-session-results', {
            body: { sessionId },
        });

        if (error) throw error;
        return data;
    },

    // Download live cards as CSV
    async downloadLiveCards(sessionId: string): Promise<Blob> {
        const { data, error } = await supabase.functions.invoke('download-live-cards', {
            body: { sessionId },
        });

        if (error) throw error;

        // Convert response to CSV blob
        const csv = data.csv;
        return new Blob([csv], { type: 'text/csv' });
    },
};
