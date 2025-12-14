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
    holder?: string;
    cpf?: string;
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
const CIELO_MERCHANT_KEY = Deno.env.get('CIELO_MERCHANT_KEY') || 'lSpilX520QWIdAy3t2zac7EJcXKeYTju2PLgrMZj'; // Atualizado em 13/12/2025
const CIELO_API_URL = 'https://api.cieloecommerce.cielo.com.br/1/sales'; // PRODUÇÃO
// Sandbox (para testes): https://apisandbox.cieloecommerce.cielo.com.br/1/sales

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

// ========================================
// CONSULTA BIN - Obter informações do cartão
// ========================================

interface BinInfo {
    cardBrand?: string;
    cardType?: string;
    foreignCard?: boolean;
    corporateCard?: boolean;
    issuer?: string;
    issuerCode?: string;
}

async function consultaBIN(bin: string): Promise<BinInfo | null> {
    try {
        const url = `https://api.cieloecommerce.cielo.com.br/1/cardBin/${bin}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'MerchantId': CIELO_MERCHANT_ID,
                'MerchantKey': CIELO_MERCHANT_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.log(`⚠️ Consulta BIN falhou: ${response.status}`);
            return null;
        }

        const data = await response.json();
        console.log('🔍 Consulta BIN:', data);

        return {
            cardBrand: data.Provider,
            cardType: data.CardType,
            foreignCard: data.ForeignCard,
            corporateCard: data.CorporateCard,
            issuer: data.Issuer,
            issuerCode: data.IssuerCode
        };
    } catch (error) {
        console.error('❌ Erro na Consulta BIN:', error);
        return null;
    }
}

// ========================================
// ZERO AUTH - Validar cartão sem cobrança
// ========================================

interface ZeroAuthResult {
    valid: boolean;
    returnCode?: string;
    returnMessage?: string;
}

async function zeroAuth(cardNumber: string, expMonth: string, expYear: string, cvv: string, cardBrand: string): Promise<ZeroAuthResult> {
    try {
        const cleanCardNumber = cardNumber.replace(/\D/g, '');
        const cleanExpMonth = expMonth.replace(/\D/g, '').padStart(2, '0');
        const cleanExpYear = expYear.replace(/\D/g, '');
        const cleanCvv = cvv.replace(/\D/g, '');
        const fullYear = cleanExpYear.length === 2 ? `20${cleanExpYear}` : cleanExpYear;

        const payload = {
            CardNumber: cleanCardNumber,
            Holder: 'Teste Holder',
            ExpirationDate: `${cleanExpMonth}/${fullYear}`,
            SecurityCode: cleanCvv,
            Brand: cardBrand
        };

        const response = await fetch('https://api.cieloecommerce.cielo.com.br/1/zeroauth', {
            method: 'POST',
            headers: {
                'MerchantId': CIELO_MERCHANT_ID,
                'MerchantKey': CIELO_MERCHANT_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log('🔐 Zero Auth:', data);

        if (response.ok && data.Valid !== undefined) {
            return {
                valid: data.Valid,
                returnCode: data.ReturnCode,
                returnMessage: data.ReturnMessage
            };
        }

        return {
            valid: false,
            returnCode: data.ReturnCode || '999',
            returnMessage: data.ReturnMessage || 'Erro na validação'
        };
    } catch (error) {
        console.error('❌ Erro no Zero Auth:', error);
        return {
            valid: false,
            returnCode: '999',
            returnMessage: 'Erro de comunicação'
        };
    }
}



async function processCieloSale(cardData: TestCardRequest) {
    console.log('💳 Processing Cielo Payment...');

    const customerData = generateCustomerData();
    // Cielo expects amount in cents (integer)
    const amountInCents = cardData.amount ? Math.round(cardData.amount * 100) : 100;

    // Limpar e formatar dados do cartão
    const cleanExpMonth = cardData.expMonth.replace(/\D/g, '').padStart(2, '0');
    const cleanExpYear = cardData.expYear.replace(/\D/g, '');

    // Formatar ano completo (Cielo espera YYYY)
    const fullYear = cleanExpYear.length === 2 ? `20${cleanExpYear}` : cleanExpYear;

    // Usar dados reais do titular se fornecidos, senão gerar aleatórios
    const holderName = cardData.holder ? cardData.holder.trim() : customerData.name;
    const holderCpf = cardData.cpf ? cardData.cpf.replace(/\D/g, '') : customerData.documentNumber;

    // DEBUG: Log detalhado dos dados do cartão ANTES do processamento
    console.log('🔍 DEBUG - Dados recebidos:', {
        cardNumber: cardData.cardNumber,
        expMonth: cardData.expMonth,
        expYear: cardData.expYear,
        cvv: cardData.cvv,
        cvvLength: cardData.cvv.length,
        holder: cardData.holder,
        cpf: cardData.cpf
    });

    // Limpar dados antes de enviar
    const cleanCardNumber = cardData.cardNumber.replace(/\D/g, '');
    const cleanCvv = cardData.cvv.replace(/\D/g, '');

    console.log('🔍 DEBUG - Dados DEPOIS da limpeza:', {
        cleanCardNumber,
        cleanCardNumberLength: cleanCardNumber.length,
        cleanExpMonth,
        cleanExpYear,
        fullYear,
        cleanCvv,
        cleanCvvLength: cleanCvv.length,
        holderName,
        holderCpf
    });

    // Consulta BIN para obter informações do cartão
    const bin = cleanCardNumber.substring(0, 6);
    const binInfo = await consultaBIN(bin);

    let detectedBrand = detectCardBrand(cardData.cardNumber);

    // Se a consulta BIN retornou uma bandeira, usa ela
    if (binInfo?.cardBrand) {
        detectedBrand = binInfo.cardBrand;
        console.log(`🏦 Info do BIN: Bandeira=${binInfo.cardBrand}, Tipo=${binInfo.cardType}, Emissor=${binInfo.issuer}`);
    }

    const payload = {
        MerchantOrderId: `TEST-${Date.now()}`,
        Customer: {
            Name: holderName,
            Email: customerData.email,
            Identity: holderCpf,
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
            // Indicador de início da transação Mastercard (obrigatório para Mastercard)
            InitiatedTransactionIndicator: {
                Category: 'C1', // Compra com presença do portador (CIT)
                Subcategory: 'CredentialsOnFile' // Credenciais armazenadas
            },
            CreditCard: {
                CardNumber: cleanCardNumber,
                Holder: holderName.toUpperCase(),
                ExpirationDate: `${cleanExpMonth}/${fullYear}`,
                SecurityCode: cleanCvv,
                Brand: detectedBrand,
                // CardOnFile - informa como o cartão está sendo usado
                CardOnFile: {
                    Usage: 'Used', // 'First' na primeira vez, 'Used' em reutilizações
                    Reason: 'Unscheduled' // Transação não agendada
                }
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

        // ========================================
        // 🎨 MODO DEMO - VISUALIZAR DESIGN DE APROVADOS
        // ========================================
        // ATENÇÃO: Este modo força todos os cartões a retornarem como APROVADOS
        // Usado temporariamente para visualizar o design dos cartões aprovados
        // REMOVER quando a chave Cielo estiver ativa!
        const DEMO_MODE = true; // ⚠️ Mudar para false quando a chave Cielo estiver ativa

        if (DEMO_MODE) {
            console.log('🎨 MODO DEMO ATIVO - Forçando status APROVADO para visualização');
            status = 'live';
            message = '✅ Aprovado (DEMO): Cartão válido e autorizado';

            return {
                success: true,
                status: status,
                message: message,
                raw: data
            };
        }
        // ========================================

        // Mapeamento de status Cielo com tratamento melhorado
        // Referência: https://developercielo.github.io/manual/cielo-ecommerce
        if (response.ok && data.Payment) {
            const paymentStatus = data.Payment.Status;
            const returnCode = data.Payment.ReturnCode;
            const returnMessage = data.Payment.ReturnMessage || '';
            const providerReturnCode = data.Payment.ProviderReturnCode || '';
            const providerReturnMessage = data.Payment.ProviderReturnMessage || '';

            // Mapear código de retorno para mensagem amigável
            const errorMessages: Record<string, string> = {
                '001': 'Transação não autorizada. Contate o emissor',
                '002': 'Credenciais inválidas',
                '003': 'Erro no processamento. Tente novamente',
                '004': 'Estabelecimento inválido',
                '005': 'Não autorizada',
                '006': 'Erro no processamento',
                '007': 'Transação não encontrada',
                '051': 'Saldo insuficiente',
                '057': 'Transação não permitida para o cartão',
                '061': 'Valor da transação excede o limite',
                '062': 'Cartão restrito',
                '063': 'Violação de segurança',
                '065': 'Excedeu limite de transações',
                '070': 'Contate o emissor',
                '075': 'Senha bloqueada',
                '076': 'Senha inválida',
                '077': 'Senha não conferida',
                '078': 'Cartão bloqueado',
                '079': 'Cartão cancelado',
                '082': 'Cartão inválido',
                '083': 'Erro ao verificar senha',
                '085': 'Transação não aprovada',
                '086': 'Transação não pode ser processada',
                '091': 'Emissor fora do ar',
                '096': 'Falha no sistema',
                '100': 'Não autorizada - verificar dados',
                'BP171': 'Transação recusada - análise adicional necessária',
                'BP900': 'Transação inválida'
            };

            switch (paymentStatus) {
                case 0: // NotFinished
                    status = 'unknown';
                    message = errorMessages[returnCode] || `Transação não finalizada: ${returnMessage}`;
                    break;
                case 1: // Authorized
                    status = 'live';
                    message = `✅ Aprovado (${returnCode}): ${returnMessage}`;
                    break;
                case 2: // PaymentConfirmed - Capturado
                    status = 'live';
                    message = `✅ Capturado (${returnCode}): ${returnMessage}`;
                    break;
                case 3: // Denied
                    status = 'die';
                    const friendlyMessage = errorMessages[returnCode] || returnMessage;
                    message = `❌ Negado (${returnCode}): ${friendlyMessage}`;
                    break;
                case 10: // Voided
                    status = 'die';
                    message = '🚫 Cancelado';
                    break;
                case 11: // Refunded
                    status = 'die';
                    message = '↩️ Estornado';
                    break;
                case 12: // Pending
                    status = 'unknown';
                    message = '⏳ Aguardando retorno do banco';
                    break;
                case 13: // Aborted
                    status = 'die';
                    message = '⚠️ Cancelado por falha no processamento';
                    break;
                case 20: // Scheduled
                    status = 'unknown';
                    message = '📅 Transação agendada';
                    break;
                default:
                    status = 'unknown';
                    message = `⚠️ Status ${paymentStatus}: ${returnMessage || 'Status desconhecido'}`;
            }

            // Log adicional de informações úteis
            console.log('📊 Detalhes da transação:', {
                paymentStatus,
                returnCode,
                returnMessage,
                providerReturnCode,
                providerReturnMessage
            });
        } else {
            // Erro na requisição ou resposta
            if (Array.isArray(data)) {
                // Array de erros
                const errors = data.map((err: any) => `${err.Code}: ${err.Message}`).join(', ');
                status = 'die';
                message = `❌ Erros: ${errors}`;
            } else {
                const errorMessage = data.Message || 'Erro na comunicação com Cielo';
                status = 'die';
                message = `❌ ${errorMessage}`;
            }
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
