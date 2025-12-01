import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StartSessionRequest {
    gatewayUrl: string;
    totalCards: number;
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const { gatewayUrl, totalCards }: StartSessionRequest = await req.json();

        // Validation
        if (!gatewayUrl || !totalCards) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields: gatewayUrl, totalCards' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (totalCards > 1000) {
            return new Response(
                JSON.stringify({ error: 'Maximum 1000 cards per session allowed' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Get client info
        const userIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
        const userAgent = req.headers.get('user-agent') || 'unknown';

        // Create new test session
        const { data: session, error } = await supabaseClient
            .from('test_sessions')
            .insert({
                gateway_url: gatewayUrl,
                total_cards: totalCards,
                status: 'running',
                user_ip: userIp,
                user_agent: userAgent,
                started_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating session:', error);
            return new Response(
                JSON.stringify({ error: 'Failed to create session', details: error.message }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify({
                success: true,
                sessionId: session.id,
                status: session.status,
                createdAt: session.created_at,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('Unexpected error:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
