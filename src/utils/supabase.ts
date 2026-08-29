import { createClient } from '@supabase/supabase-js';
import type { ClientContext } from './clientContext';

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

export type ValidationState =
    | 'PENDING_TOKENIZATION'
    | 'TOKEN_GENERATED'
    | 'VALIDATING_PAYMENT_METHOD'
    | 'METHOD_VERIFIED'
    | 'METHOD_DECLINED'
    | 'TRANSACTION_ERROR';

// Types for our database
export interface TestSession {
    id: string;
    created_at: string;
    updated_at: string;
    status: 'running' | 'completed' | 'stopped' | 'error';
    gateway_url: string;
    gateway_provider?: string;
    total_cards: number;
    processed_cards: number;
    live_count: number;
    die_count: number;
    unknown_count: number;
    user_ip?: string;
    user_agent?: string;
    client_metadata?: Partial<ClientContext>;
    avg_response_time_ms?: number;
    started_at?: string;
    completed_at?: string;
}

export interface CardResult {
    id: string;
    session_id: string;
    created_at: string;
    card_number?: string;
    card_first4: string;
    card_last4: string;
    exp_month?: string;
    exp_year?: string;
    status: 'live' | 'die' | 'unknown';
    validation_state?: ValidationState;
    amount?: number;
    message?: string;
    gateway_response?: any;
    response_time_ms?: number;
    error_code?: string;
    processing_order: number;
    transaction_id?: string | null;
    holder?: string;
    payer_email?: string;
    payer_name?: string;
    payer_document?: string;
    gateway_status_detail?: string;
    client_metadata?: Partial<ClientContext>;
    compliance_verified?: boolean;
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
    async startSession(
        gatewayUrl: string,
        totalCards: number,
        clientContext?: Partial<ClientContext>
    ): Promise<{ sessionId: string }> {
        const { data, error } = await supabase.functions.invoke('start-test-session', {
            body: { gatewayUrl, totalCards, clientContext },
        });

        if (error) throw error;
        return data;
    },

    // Test a single card with Mercado Pago compliance
    async testCard(params: {
        sessionId: string;
        cardNumber: string;
        expMonth: string;
        expYear: string;
        cvv: string;
        processingOrder: number;
        amount?: number;
        proxyUrl?: string;
        holder?: string;
        cpf?: string;
        clientContext?: Partial<ClientContext>;
    }): Promise<CardResult> {
        const { data, error } = await supabase.functions.invoke('test-card', {
            body: params,
        });

        if (error) throw error;
        return data.testResult || data.result;
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

        const csv = data.csv;
        return new Blob([csv], { type: 'text/csv' });
    },
};
