import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const { sessionId } = await req.json();

        if (!sessionId) {
            return new Response(
                JSON.stringify({ error: 'Missing sessionId' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Get session data
        const { data: session, error: sessionError } = await supabaseClient
            .from('test_sessions')
            .select('*')
            .eq('id', sessionId)
            .single();

        if (sessionError || !session) {
            return new Response(
                JSON.stringify({ error: 'Session not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Get all card results for this session
        const { data: results, error: resultsError } = await supabaseClient
            .from('card_results')
            .select('*')
            .eq('session_id', sessionId)
            .order('processing_order', { ascending: true });

        if (resultsError) {
            console.error('Error fetching results:', resultsError);
            return new Response(
                JSON.stringify({ error: 'Failed to fetch results' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Format results for frontend
        const formattedResults = results.map(r => ({
            id: r.id,
            cardNumber: `${r.card_first4} •••• •••• ${r.card_last4}`,
            status: r.status,
            amount: r.amount,
            message: r.message,
            responseTimeMs: r.response_time_ms,
            createdAt: r.created_at,
        }));

        return new Response(
            JSON.stringify({
                session: {
                    id: session.id,
                    status: session.status,
                    totalCards: session.total_cards,
                    processedCards: session.processed_cards,
                    liveCount: session.live_count,
                    dieCount: session.die_count,
                    unknownCount: session.unknown_count,
                    avgResponseTimeMs: session.avg_response_time_ms,
                    createdAt: session.created_at,
                    startedAt: session.started_at,
                    completedAt: session.completed_at,
                },
                results: formattedResults,
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
