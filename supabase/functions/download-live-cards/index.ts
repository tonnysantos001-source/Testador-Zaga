import { serve } from 'https://deno.land/std@0. 168.0/http/server.ts';
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

        // Get only live cards
        const { data: liveCards, error } = await supabaseClient
            .from('card_results')
            .select('card_first4, card_last4, amount, message, created_at')
            .eq('session_id', sessionId)
            .eq('status', 'live')
            .order('processing_order', { ascending: true });

        if (error) {
            console.error('Error fetching live cards:', error);
            return new Response(
                JSON.stringify({ error: 'Failed to fetch live cards' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (liveCards.length === 0) {
            return new Response(
                JSON.stringify({ error: 'No live cards found for this session' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Generate CSV content
        const csvHeader = 'Card Number,Amount,Message,Tested At\n';
        const csvRows = liveCards.map(card => {
            const cardNumber = `${card.card_first4}********${card.card_last4}`;
            const amount = card.amount ? card.amount.toFixed(2) : '0.00';
            const message = (card.message || '').replace(/"/g, '""'); // Escape quotes
            const testedAt = new Date(card.created_at).toISOString();

            return `"${cardNumber}","$${amount}","${message}","${testedAt}"`;
        }).join('\n');

        const csv = csvHeader + csvRows;
        const fileName = `approved_cards_${sessionId}_${new Date().toISOString().split('T')[0]}.csv`;

        return new Response(
            JSON.stringify({ csv, fileName }),
            {
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json',
                }
            }
        );
    } catch (error) {
        console.error('Unexpected error:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
