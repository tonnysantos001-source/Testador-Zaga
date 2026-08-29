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
    gateway?: 'mercadopago' | 'appmax' | 'cielo';
    processingOrder: number;
    amount?: number;
    proxyUrl?: string;
    token?: string;
    holder?: string;
    cpf?: string;
    method?: 'credit_card' | 'pix' | 'boleto';
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
    gateway?: 'mercadopago' | 'appmax' | 'cielo';
    proxyUrl?: string;
    method?: 'credit_card' | 'pix' | 'boleto';
}

// ========================================
// MERCADO PAGO PRODUÇÃO
// ========================================
const MERCADOPAGO_PUBLIC_KEY = Deno.env.get('MERCADOPAGO_PUBLIC_KEY') || 'APP_USR-ce68e22a-f349-4b30-b597-c06c7311d9f4';
const MERCADOPAGO_ACCESS_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') || 'APP_USR-8963380272153266-012620-b44f7e59d0d47b079c523ee25d19a968-1537908999';

// ========================================
// APPMAX PRODUÇÃO
// ========================================
const APPMAX_TOKEN = Deno.env.get('APPMAX_ACCESS_TOKEN') || Deno.env.get('APPMAX_TOKEN') || 'D2555D74-9B58764C-3F04CB59-14BF2F64';
const APPMAX_API_URL = Deno.env.get('APPMAX_API_URL') || 'https://admin.appmax.com.br/api/v3';

// ========================================
// GERAÇÃO E FORMATAÇÃO DE DADOS
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

function isValidCPF(cpf: string): boolean {
    const clean = cpf.replace(/\D/g, '');
    if (clean.length !== 11 || /^(\d)\1{10}$/.test(clean)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(clean.charAt(i), 10) * (10 - i);
    let rev = 11 - (sum % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(clean.charAt(9), 10)) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(clean.charAt(i), 10) * (11 - i);
    rev = 11 - (sum % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(clean.charAt(10), 10)) return false;
    return true;
}

function detectBrand(cardNumber: string): string {
    const clean = cardNumber.replace(/\D/g, '');
    if (/^4/.test(clean)) return 'visa';
    if (/^(5[1-5]|2[2-7])/.test(clean)) return 'master';
    if (/^(34|37)/.test(clean)) return 'amex';
    if (/^(6011|65|64[4-9]|622)/.test(clean)) return 'elo';
    if (/^(3841|60)/.test(clean)) return 'hipercard';
    return 'visa';
}

const firstNames = ['João', 'Maria', 'José', 'Ana', 'Pedro', 'Juliana', 'Carlos', 'Fernanda', 'Paulo', 'Mariana', 'Lucas', 'Beatriz', 'Rafael', 'Camila', 'Felipe', 'Amanda'];
const lastNames = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Costa', 'Ferreira', 'Rodrigues', 'Almeida', 'Nascimento', 'Pereira', 'Carvalho'];

function generateCustomerData() {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const randomNum = Math.floor(Math.random() * 9000) + 1000;

    return {
        name: `${firstName} ${lastName}`,
        firstName,
        lastName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randomNum}@gmail.com`,
        phone: `119${Math.floor(10000000 + Math.random() * 90000000)}`,
        document: generateCPF(),
    };
}

// ========================================
// 1. MERCADO PAGO VALIDAÇÃO / OAUTH CLIENT
// ========================================

async function processMercadoPagoTransaction(cardData: TestCardRequest) {
    console.log('💳 [Mercado Pago Validação/OAuth] Validando credenciais do cartão...');

    const customerData = generateCustomerData();
    const cleanCardNumber = cardData.cardNumber.replace(/\D/g, '');
    const cleanExpMonth = cardData.expMonth.replace(/\D/g, '').padStart(2, '0').substring(0, 2);
    const cleanExpYear = cardData.expYear.replace(/\D/g, '');
    const fullYear = cleanExpYear.length === 2 ? `20${cleanExpYear}` : cleanExpYear;
    const brand = detectBrand(cleanCardNumber);
    const holderName = cardData.holder ? cardData.holder.trim() : customerData.name;

    let cleanCvv = (cardData.cvv || '').replace(/\D/g, '');
    const maxCvvLength = brand === 'amex' ? 4 : 3;
    if (cleanCvv.length > maxCvvLength) cleanCvv = cleanCvv.substring(0, maxCvvLength);
    if (!cleanCvv) cleanCvv = '123';

    try {
        // Validação/Tokenização via API do Mercado Pago (Zero-Charge / Sem Transação Real)
        const tokenRes = await fetch(`https://api.mercadopago.com/v1/card_tokens?public_key=${MERCADOPAGO_PUBLIC_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                card_number: cleanCardNumber,
                expiration_month: parseInt(cleanExpMonth, 10),
                expiration_year: parseInt(fullYear, 10),
                security_code: cleanCvv,
                cardholder: { name: holderName.toUpperCase() }
            })
        });

        const tokenText = await tokenRes.text();
        if (!tokenText) {
            return { success: true, status: 'die', message: '❌ Resposta vazia na tokenização MP', raw: null };
        }

        let tokenData: any = {};
        try {
            tokenData = JSON.parse(tokenText);
        } catch (_) {
            return { success: true, status: 'die', message: '❌ Erro de formato na resposta MP', raw: tokenText };
        }

        // Se o token foi gerado com sucesso, o cartão é válido (Luhn, BIN, validade e CVV conferem)
        if (tokenRes.ok && tokenData.id && (tokenData.status === 'active' || !tokenData.status || tokenData.status === 'valid')) {
            return {
                success: true,
                status: 'live',
                message: `✅ MP LIVE - Validado via OAuth/Token (${tokenData.id.substring(0, 10)}...)`,
                raw: tokenData,
                transactionId: String(tokenData.id)
            };
        }

        // Se falhou na validação
        const errDetail = tokenData.message || (tokenData.cause && tokenData.cause[0] ? tokenData.cause[0].description : 'Dados de cartão inválidos');
        return {
            success: true,
            status: 'die',
            message: `❌ MP Recusado: ${errDetail}`,
            raw: tokenData,
            transactionId: null
        };
    } catch (err: any) {
        return { success: false, status: 'error', message: `Erro Token MP: ${err.message}`, raw: null };
    }
}

// ========================================
// 2. APPMAX VALIDAÇÃO / OAUTH CLIENT
// ========================================

async function processAppmaxTransaction(cardData: TestCardRequest) {
    console.log('💳 [Appmax Validação/OAuth] Validando credenciais do cartão...');

    const customerData = generateCustomerData();
    const cleanCardNumber = cardData.cardNumber.replace(/\D/g, '');
    const cleanExpMonth = cardData.expMonth.replace(/\D/g, '').padStart(2, '0').substring(0, 2);
    const cleanExpYear = cardData.expYear.replace(/\D/g, '');
    const fullYear = cleanExpYear.length === 2 ? `20${cleanExpYear}` : cleanExpYear;
    const brand = detectBrand(cleanCardNumber);
    const holderName = cardData.holder ? cardData.holder.trim() : customerData.name;

    let cleanCvv = (cardData.cvv || '').replace(/\D/g, '');
    const maxCvvLength = brand === 'amex' ? 4 : 3;
    if (cleanCvv.length > maxCvvLength) cleanCvv = cleanCvv.substring(0, maxCvvLength);
    if (!cleanCvv) cleanCvv = '123';

    try {
        // Validação/Tokenização via API da Appmax (Zero-Charge / Sem criação de pedido ou transação)
        const tRes = await fetch(`${APPMAX_API_URL}/tokenize/card`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                'access-token': APPMAX_TOKEN,
                card: {
                    name: holderName.toUpperCase(),
                    number: cleanCardNumber,
                    cvv: cleanCvv,
                    month: parseInt(cleanExpMonth, 10),
                    year: parseInt(fullYear.slice(-2), 10)
                }
            })
        });

        const tText = await tRes.text();
        let tData: any = {};
        try {
            tData = JSON.parse(tText);
        } catch (_) {
            return { success: true, status: 'die', message: `❌ Resposta inválida Appmax [${tRes.status}]`, raw: tText };
        }

        console.log(`📥 Appmax Tokenize Response [${tRes.status}]:`, tText);

        const token = tData?.data?.token || tData?.data?.card_token || (typeof tData?.data === 'string' ? tData.data : null);

        if (tRes.ok && tData.success && token) {
            return {
                success: true,
                status: 'live',
                message: `✅ APPMAX LIVE - Validado via OAuth/Token (${String(token).substring(0, 10)}...)`,
                raw: tData,
                transactionId: String(token)
            };
        }

        const errMsg = tData.text || tData.message || (tData.data && tData.data.message) || 'Cartão inválido ou não autorizado';
        return {
            success: true,
            status: 'die',
            message: `❌ Appmax Recusado: ${errMsg}`,
            raw: tData,
            transactionId: null
        };
    } catch (err: any) {
        return { success: false, status: 'error', message: `Erro Appmax: ${err.message}`, raw: null };
    }
}

// Roteador de Gateways
async function processTransaction(cardData: TestCardRequest) {
    const gw = (cardData.gateway || cardData.gatewayUrl || '').toLowerCase();
    
    if (gw.includes('appmax')) {
        return await processAppmaxTransaction(cardData);
    }
    
    // Padrão de Produção Real: Mercado Pago (ou Appmax se Mercado Pago falhar)
    const mpResult = await processMercadoPagoTransaction(cardData);
    if (mpResult.success && mpResult.status !== 'error') return mpResult;

    // Fallback para Appmax se MP der erro estrutural
    return await processAppmaxTransaction(cardData);
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
                proxyUrl,
                method: batchRequest.method || 'credit_card'
            };

            const result = await processTransaction(cardRequest);

            const finalResult = {
                cardNumber: card.cardNumber,
                status: result.status,
                message: result.message,
                amount: card.amount || 0,
                response_time_ms: Date.now() - startTime,
                processingOrder: card.processingOrder
            };

            await supabaseClient.from('card_results').insert([{
                session_id: sessionId,
                card_first4: card.cardNumber.substring(0, 4),
                card_last4: card.cardNumber.substring(card.cardNumber.length - 4),
                exp_month: card.expMonth,
                exp_year: card.expYear,
                status: finalResult.status === 'live' ? 'live' : (finalResult.status === 'die' ? 'die' : 'unknown'),
                message: finalResult.message,
                amount: finalResult.amount,
                response_time_ms: finalResult.response_time_ms,
                processing_order: card.processingOrder,
                gateway_response: result.raw,
                transaction_id: result.transactionId,
                payment_method: batchRequest.method || 'credit_card'
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
// SUPABASE CLIENT
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
        const requestData: TestCardRequest | BatchTestCardRequest = await req.json();
        const isBatchRequest = 'cards' in requestData;

        if (isBatchRequest) {
            return await processBatchCards(requestData as BatchTestCardRequest, supabaseClient);
        }

        const { sessionId, cardNumber, expMonth, expYear, cvv, processingOrder, amount, method } = requestData as TestCardRequest;

        if (!sessionId || !cardNumber || !expMonth || !expYear || !cvv) {
            return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400, headers: corsHeaders });
        }

        const startTime = Date.now();

        const result = await processTransaction(requestData);

        const finalResult = {
            id: crypto.randomUUID(),
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

        // Tentar salvar resultado no banco
        try {
            await supabaseClient.from('card_results').insert([{
                session_id: sessionId,
                card_first4: cardNumber.substring(0, 4),
                card_last4: cardNumber.substring(cardNumber.length - 4),
                exp_month: expMonth,
                exp_year: expYear,
                status: finalResult.status === 'live' ? 'live' : (finalResult.status === 'die' ? 'die' : 'unknown'),
                message: finalResult.message,
                amount: finalResult.amount,
                response_time_ms: finalResult.response_time_ms,
                processing_order: processingOrder,
                gateway_response: result.raw,
                transaction_id: result.transactionId,
                payment_method: method || 'credit_card'
            }]);
        } catch (dbError) {
            console.error('⚠️ DB Insert Warning:', dbError);
        }

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
