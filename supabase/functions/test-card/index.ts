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
    gatewayUrl?: string; // Não mais usado diretamente como URL, mas mantido por compatibilidade
    processingOrder: number;
    amount?: number;
    proxyUrl?: string;
    token?: string;
    holder?: string;
    cpf?: string;
    method?: 'credit_card' | 'pix' | 'boleto'; // Novo campo
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
    method?: 'credit_card' | 'pix' | 'boleto';
}

// ========================================
// CONFIGURAÇÃO ZENTRIPAY
// ========================================
// Chave e URL devem ser configuradas nas variáveis de ambiente da Edge Function (Secrets)
const ZENTRIPAY_API_KEY = Deno.env.get('ZENTRIPAY_API_KEY') || '';
const ZENTRIPAY_API_URL = Deno.env.get('ZENTRIPAY_API_URL') || 'https://api.zentripay.com.br';

const DEFAULT_WEBHOOK_URL = Deno.env.get('WEBHOOK_URL') || 'https://seusite.com/webhook'; // Placeholder até ter o webhook real

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
        phone: `119${Math.floor(10000000 + Math.random() * 90000000)}`,
        document: generateCPF(),
        address: {
            street: 'Rua das Flores',
            number: (Math.floor(Math.random() * 999) + 1).toString(),
            neighborhood: 'Centro',
            city: 'São Paulo',
            state: 'SP',
            postalCode: '01001000',
            country: 'BR',
            complement: 'Apto 101'
        }
    };
}

// ========================================
// ZENTRIPAY API CLIENT
// ========================================

async function processZentripayTransaction(cardData: TestCardRequest) {
    console.log('💳 Processing Zentripay Payment...');

    if (!ZENTRIPAY_API_KEY) {
        throw new Error('CONFIGURAÇÃO: ZENTRIPAY_API_KEY não encontrada nos secrets.');
    }

    const customerData = generateCustomerData();
    // Zentripay aceita float (ex: 10.50)
    const amount = cardData.amount || 1.00;

    // Limpar e formatar dados do cartão
    const cleanExpMonth = cardData.expMonth.replace(/\D/g, '').padStart(2, '0');
    const cleanExpYear = cardData.expYear.replace(/\D/g, '');
    const cleanCardNumber = cardData.cardNumber.replace(/\D/g, '');
    const cleanCvv = cardData.cvv?.replace(/\D/g, '') || '123';

    // Formatar ano completo (YYYY)
    const fullYear = cleanExpYear.length === 2 ? `20${cleanExpYear}` : cleanExpYear;
    // Formatar ano curto (YY)
    const shortYear = fullYear.substring(2);

    // Usar dados reais do titular se fornecidos, senão gerar aleatórios
    const holderName = cardData.holder ? cardData.holder.trim() : customerData.name;

    // Método padrão é credit_card, mas suporta outros se passado
    const method = cardData.method || 'credit_card';

    // Construção do Payload
    const payload: any = {
        amount: amount,
        provider: "v2",
        method: method,
        installments: 1,
        customer: {
            name: customerData.name,
            document: customerData.document,
            phone: customerData.phone,
            email: customerData.email,
            address: customerData.address
        },
        utm: {
            source: "checker_zaga",
            medium: "api",
            campaign: "test_session",
            term: "card_validation",
            content: "v1"
        },
        productName: "Teste Validação",
        postBackUrl: DEFAULT_WEBHOOK_URL
    };

    if (method === 'credit_card') {
        payload.card = {
            number: cleanCardNumber,
            holderName: holderName.toUpperCase(),
            expirationMonth: cleanExpMonth,
            expirationYear: shortYear, // Zentripay geralmente espera 2 dígitos para ano, checar docs se falhar
            cvv: cleanCvv
        };
    }

    // TODO: Adicionar suporte para PIX se method === 'pix'

    console.log('📤 Zentripay Payload:', JSON.stringify(payload, null, 2));

    try {
        const response = await fetch(`${ZENTRIPAY_API_URL}/v2/transactions/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ZENTRIPAY_API_KEY}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log(`📥 Zentripay Response [${response.status}]:`, JSON.stringify(data));

        let status = 'die';
        let message = 'Transaction failed';
        let transactionId = null;

        // Mapeamento de resposta
        if (response.ok && data.status === 'success') {
            transactionId = data.idTransaction;
            // Para cartão de crédito, o sucesso na criação geralmente indica que passou por validações iniciais.
            // O status real pode ser 'waiting_for_approval', 'paid', etc.
            // Como é um checker, consideramos 'success' na criação como um bom sinal, 
            // mas idealmente verificaríamos o status detalhado se retornado.

            // Supondo que sucesso na criação = live para fins de teste simples,
            // ou se houver campo de status detalhado, usar ele.
            // A doc diz: { "status": "success", "message": "ok", "idTransaction": "..." }

            status = 'live';
            message = `✅ Aprovado (ID: ${transactionId})`;

        } else {
            // Tratamento de erros
            const errorMessage = data.message || 'Erro desconhecido';
            status = 'die';

            if (errorMessage.toLowerCase().includes('não autorizado') || errorMessage.toLowerCase().includes('unauthorized')) {
                message = '❌ Erro de Autenticação (Chave Inválida)';
            } else if (errorMessage.toLowerCase().includes('recusada') || errorMessage.toLowerCase().includes('refused')) {
                message = '❌ Transação Recusada';
            } else {
                message = `❌ Erro: ${errorMessage}`;
            }
        }

        return {
            success: true,
            status: status,
            message: message,
            raw: data,
            transactionId: transactionId
        };

    } catch (error: any) {
        console.error('❌ Zentripay Request Error:', error.message);
        return {
            success: false,
            status: 'error',
            message: error.message,
            raw: null
        };
    }
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
                proxyUrl,
                method: batchRequest.method || 'credit_card'
            };

            const result = await processZentripayTransaction(cardRequest);

            const finalResult = {
                cardNumber: card.cardNumber,
                status: result.status,
                message: result.message,
                amount: card.amount || 0,
                response_time_ms: Date.now() - startTime,
                processingOrder: card.processingOrder
            };

            // Salva resultado individual
            await supabaseClient.from('card_results').insert([{
                session_id: sessionId,
                card_first4: card.cardNumber.substring(0, 4),
                card_last4: card.cardNumber.substring(card.cardNumber.length - 4),
                exp_month: card.expMonth,
                exp_year: card.expYear,
                // cvv: NÃO SALVAR CVV REAL
                // status: finalResult.status, // Usar mapeamento de enum
                status: finalResult.status === 'live' ? 'live' : (finalResult.status === 'die' ? 'die' : 'unknown'),
                message: finalResult.message,
                amount: finalResult.amount,
                response_time_ms: finalResult.response_time_ms,
                processing_order: card.processingOrder,
                gateway_response: result.raw,
                transaction_id: result.transactionId, // Novo campo
                payment_method: batchRequest.method || 'credit_card' // Novo campo
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
        const requestData: TestCardRequest | BatchTestCardRequest = await req.json();
        const isBatchRequest = 'cards' in requestData;

        if (isBatchRequest) {
            return await processBatchCards(requestData as BatchTestCardRequest, supabaseClient);
        }

        // Single card processing
        const { sessionId, cardNumber, expMonth, expYear, cvv, processingOrder, amount, method } = requestData as TestCardRequest;

        if (!sessionId || !cardNumber || !expMonth || !expYear || !cvv) {
            return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400, headers: corsHeaders });
        }

        const startTime = Date.now();

        const result = await processZentripayTransaction(requestData);

        // Normalize response for frontend
        const finalResult = {
            id: crypto.randomUUID(),
            session_id: sessionId,
            created_at: new Date().toISOString(),
            card_number: cardNumber, // O frontend espera card_number completo na resposta, embora no banco só salve mascarado
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
