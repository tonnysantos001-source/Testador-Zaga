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
    token?: string;
}

interface BatchTestCardRequest {
    sessionId: string;
    cards: Array<{
        cardNumber: string;
        expMonth: string;
        expYear: string;
        cvv: string;
        processingOrder: number;
        amount?: number;
    }>;
    gatewayUrl?: string;
    proxyUrl?: string;
}

// ========================================
// CONFIGURAÇÃO CIELO (API E-commerce)
// ========================================
const CIELO_MERCHANT_ID = Deno.env.get('CIELO_MERCHANT_ID') || 'c8bb2f93-34b2-4bc8-a382-be44300aa20e';
const CIELO_MERCHANT_KEY = Deno.env.get('CIELO_MERCHANT_KEY') || 'QwjkObfkerFPwgsnHDhc2v5atcCWU4QdUuZGoSWE';
const CIELO_API_URL = 'https://apisandbox.cieloecommerce.cielo.com.br/1/sales'; // Sandbox para testes
// Produção: https://api.cieloecommerce.cielo.com.br/1/sales

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



async function processCieloSale(cardData: TestCardRequest) {
    console.log('💳 Processing Cielo Payment...');

    const customerData = generateCustomerData();
    // Cielo expects amount in cents (integer)
    const amountInCents = cardData.amount ? Math.round(cardData.amount * 100) : 100;

    // Formatar ano completo (Cielo espera YYYY)
    const fullYear = cardData.expYear.length === 2 ? `20${cardData.expYear}` : cardData.expYear;

    const payload = {
        MerchantOrderId: `TEST-${Date.now()}`,
        Customer: {
            Name: customerData.name,
            Email: customerData.email,
            Identity: customerData.documentNumber,
            IdentityType: 'CPF',
            Address: {
                Street: customerData.address.street,
                Number: customerData.address.number.toString(),
                Complement: '',
                ZipCode: customerData.address.zipCode,
                City: customerData.address.city,
                State: customerData.address.state,
                Country: 'BRA'
            }
        },
        Payment: {
            Type: 'CreditCard',
            Amount: amountInCents,
            Installments: 1,
            Capture: true, // Captura automática
            SoftDescriptor: 'TestadorZaga',
            CreditCard: {
                CardNumber: cardData.cardNumber.replace(/\D/g, ''),
                Holder: customerData.name.toUpperCase(),
                ExpirationDate: `${cardData.expMonth}/${fullYear}`,
                SecurityCode: cardData.cvv,
                Brand: detectCardBrand(cardData.cardNumber)
            }
        }
    };

    console.log('📤 Cielo Payload:', JSON.stringify(payload, null, 2));

    try {
        const response = await fetch(CIELO_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'MerchantId': CIELO_MERCHANT_ID,
                'MerchantKey': CIELO_MERCHANT_KEY
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log(`📥 Cielo Response [${response.status}]:`, JSON.stringify(data));

        let status = 'die';
        let message = 'Transaction failed';

        // Mapeamento de status Cielo
        // Referência: https://developercielo.github.io/manual/cielo-ecommerce
        if (response.ok && data.Payment) {
            const paymentStatus = data.Payment.Status;
            const returnCode = data.Payment.ReturnCode;
            const returnMessage = data.Payment.ReturnMessage || '';

            switch (paymentStatus) {
                case 0: // NotFinished
                    status = 'unknown';
                    message = 'Transação não finalizada';
                    break;
                case 1: // Authorized
                    status = 'live';
                    message = `Aprovado: ${returnMessage}`;
                    break;
                case 2: // PaymentConfirmed - Capturado
                    status = 'live';
                    message = `Capturado: ${returnMessage}`;
                    break;
                case 3: // Denied
                    status = 'die';
                    message = `Negado: ${returnMessage} (${returnCode})`;
                    break;
                case 10: // Voided
                    status = 'die';
                    message = 'Cancelado';
                    break;
                case 11: // Refunded
                    status = 'die';
                    message = 'Estornado';
                    break;
                case 12: // Pending
                    status = 'unknown';
                    message = 'Aguardando retorno';
                    break;
                case 13: // Aborted
                    status = 'die';
                    message = 'Cancelado por falha';
                    break;
                case 20: // Scheduled
                    status = 'unknown';
                    message = 'Agendado';
                    break;
                default:
                    status = 'unknown';
                    message = `Status desconhecido: ${paymentStatus}`;
            }
        } else {
            // Erro na requisição
            const errorMessage = data[0]?.Message || data.Message || 'Erro na comunicação com Cielo';
            status = 'die';
            message = errorMessage;
        }

        return {
            success: true,
            status: status,
            message: message,
            raw: data
        };

    } catch (error: any) {
        console.error('❌ Cielo Request Error:', error.message);
        return {
            success: false,
            status: 'error',
            message: error.message,
            raw: null
        };
    }
}

// Helper function para detectar bandeira do cartão
function detectCardBrand(cardNumber: string): string {
    const cleanNumber = cardNumber.replace(/\D/g, '');
    const firstDigit = cleanNumber[0];
    const firstTwo = cleanNumber.substring(0, 2);
    const firstFour = cleanNumber.substring(0, 4);

    if (firstDigit === '4') return 'Visa';
    if (firstTwo >= '51' && firstTwo <= '55') return 'Master';
    if (firstTwo === '34' || firstTwo === '37') return 'Amex';
    if (firstFour === '6011' || firstTwo === '65') return 'Discover';
    if (firstFour >= '3528' && firstFour <= '3589') return 'JCB';
    if (firstTwo === '36' || firstTwo === '38') return 'Diners';
    if (firstFour === '6062') return 'Hipercard';
    if (firstTwo === '60' || firstFour === '6363') return 'Elo';

    return 'Visa'; // Default
}

// ========================================
// BATCH PROCESSING
// ========================================

async function processBatchCards(batchRequest: BatchTestCardRequest, supabaseClient: any) {
    const { sessionId, cards, gatewayUrl, proxyUrl } = batchRequest;

    if (!sessionId || !cards || cards.length === 0) {
        return new Response(JSON.stringify({ error: 'Missing sessionId or cards' }), { status: 400, headers: corsHeaders });
    }

    console.log(`📦 Processando lote de ${cards.length} cartões...`);

    // Processar em paralelo com Promise.all (mais rápido)
    const promises = cards.map(async (card, index) => {
        const startTime = Date.now();

        try {
            const cardRequest: TestCardRequest = {
                sessionId,
                cardNumber: card.cardNumber,
                expMonth: card.expMonth,
                expYear: card.expYear,
                cvv: card.cvv,
                gatewayUrl,
                processingOrder: card.processingOrder,
                amount: card.amount,
                proxyUrl
            };

            const result = await processCieloSale(cardRequest);

            const finalResult = {
                cardNumber: card.cardNumber,
                status: result.status,
                message: result.message,
                amount: card.amount || 0,
                response_time_ms: Date.now() - startTime,
                processingOrder: card.processingOrder
            };

            // Salva resultado individual
            await supabaseClient.from('card_test_results').insert([{
                session_id: sessionId,
                card_number: card.cardNumber,
                exp_month: card.expMonth,
                exp_year: card.expYear,
                cvv: card.cvv,
                gateway_url: 'CIELO',
                processing_order: card.processingOrder,
                status: finalResult.status,
                message: finalResult.message,
                amount: finalResult.amount,
                response_time_ms: finalResult.response_time_ms
            }]);

            return { success: true, result: finalResult };
        } catch (error: any) {
            console.error(`Erro no cartão ${index + 1}:`, error.message);
            return {
                success: false,
                result: {
                    cardNumber: card.cardNumber,
                    status: 'error',
                    message: error.message,
                    processingOrder: card.processingOrder
                }
            };
        }
    });

    const batchResults = await Promise.all(promises);

    // Separar sucessos e erros
    const successful = batchResults.filter(r => r.success).map(r => r.result);
    const failed = batchResults.filter(r => !r.success).map(r => r.result);

    console.log(`✅ Lote processado: ${successful.length} sucessos, ${failed.length} erros`);

    return new Response(
        JSON.stringify({
            success: true,
            totalCards: cards.length,
            successful: successful.length,
            failed: failed.length,
            results: batchResults.map(r => r.result)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
}

// ========================================
// SUPABASE CLIENT - Inicializado uma vez, reutilizado
// ========================================
const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// ========================================
// MAIN HANDLER
// ========================================

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        // Reutiliza o cliente Supabase já inicializado

        const requestData: TestCardRequest | BatchTestCardRequest = await req.json();

        // Detecta se é batch ou single request
        const isBatchRequest = 'cards' in requestData;

        if (isBatchRequest) {
            return await processBatchCards(requestData as BatchTestCardRequest, supabaseClient);
        }

        // Single card processing (mantém compatibilidade)
        const { sessionId, cardNumber, expMonth, expYear, cvv, processingOrder, amount } = requestData as TestCardRequest;

        if (!sessionId || !cardNumber || !expMonth || !expYear || !cvv) {
            return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400, headers: corsHeaders });
        }

        const startTime = Date.now();

        // Using Cielo E-commerce API
        const gatewayUsed = 'CIELO';
        const result = await processCieloSale(requestData);

        // Normalize response for frontend with ALL required CardResult fields
        const finalResult = {
            id: crypto.randomUUID(), // Generate unique ID
            session_id: sessionId,
            created_at: new Date().toISOString(),
            card_number: cardNumber,
            card_first4: cardNumber.substring(0, 4),
            card_last4: cardNumber.substring(cardNumber.length - 4),
            exp_month: expMonth,
            exp_year: expYear,
            status: result.status,
            message: result.message,
            amount: amount || 0,
            response_time_ms: Date.now() - startTime,
            processing_order: processingOrder,
            gateway_response: result.raw
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
            response_time_ms: finalResult.response_time_ms
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
