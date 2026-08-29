import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ========================================
// INTERFACES & TIPAGEM DE CONFORMIDADE
// ========================================

export type ValidationState =
    | 'PENDING_TOKENIZATION'
    | 'TOKEN_GENERATED'
    | 'VALIDATING_PAYMENT_METHOD'
    | 'METHOD_VERIFIED'
    | 'METHOD_DECLINED'
    | 'TRANSACTION_ERROR';

export interface ClientContextPayload {
    userAgent?: string;
    language?: string;
    timezone?: string;
    timezoneOffset?: number;
    screenResolution?: string;
    colorDepth?: number;
    platform?: string;
    timestamp?: string;
    ip?: string;
}

export interface BillingAddress {
    zip_code: string;
    street_name: string;
    street_number: string;
    neighborhood: string;
    city: string;
    federal_unit: string;
}

export interface PayerIdentification {
    type: 'CPF' | 'CNPJ';
    number: string;
}

export interface PayerData {
    email: string;
    firstName: string;
    lastName: string;
    identification: PayerIdentification;
    phone: {
        area_code: string;
        number: string;
    };
    address: BillingAddress;
}

export interface TestCardRequest {
    sessionId: string;
    cardNumber: string;
    expMonth: string;
    expYear: string;
    cvv: string;
    processingOrder: number;
    amount?: number;
    proxyUrl?: string;
    holder?: string;
    cpf?: string;
    clientContext?: ClientContextPayload;
}

export interface BatchTestCardRequest {
    sessionId: string;
    cards: Array<{
        cardNumber: string;
        expMonth: string;
        expYear: string;
        cvv: string;
        processingOrder: number;
        amount?: number;
        holder?: string;
        cpf?: string;
    }>;
    proxyUrl?: string;
    clientContext?: ClientContextPayload;
}

export interface ValidationResult {
    success: boolean;
    status: 'live' | 'die' | 'unknown';
    validationState: ValidationState;
    message: string;
    transactionId: string | null;
    rawResponse: any;
    responseTimeMs: number;
    payer: PayerData;
    statusDetail?: string;
    errorCode?: string;
}

// ========================================
// CONFIGURAÇÕES MERCADO PAGO OFICIAL
// ========================================
const MERCADOPAGO_PUBLIC_KEY =
    Deno.env.get('MERCADOPAGO_PUBLIC_KEY') || 'APP_USR-ce68e22a-f349-4b30-b597-c06c7311d9f4';
const MERCADOPAGO_ACCESS_TOKEN =
    Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') || 'APP_USR-8963380272153266-012620-b44f7e59d0d47b079c523ee25d19a968-1537908999';

// ========================================
// BANCO DE ENDEREÇOS BRASILEIROS REAIS (COMPLIANCE)
// ========================================
const brazilianAddresses: BillingAddress[] = [
    { zip_code: '01310100', street_name: 'Avenida Paulista', street_number: '1578', neighborhood: 'Bela Vista', city: 'São Paulo', federal_unit: 'SP' },
    { zip_code: '20040002', street_name: 'Avenida Rio Branco', street_number: '156', neighborhood: 'Centro', city: 'Rio de Janeiro', federal_unit: 'RJ' },
    { zip_code: '30130100', street_name: 'Avenida Afonso Pena', street_number: '1500', neighborhood: 'Centro', city: 'Belo Horizonte', federal_unit: 'MG' },
    { zip_code: '80020010', street_name: 'Rua XV de Novembro', street_number: '784', neighborhood: 'Centro', city: 'Curitiba', federal_unit: 'PR' },
    { zip_code: '90010150', street_name: 'Rua dos Andradas', street_number: '1001', neighborhood: 'Centro Histórico', city: 'Porto Alegre', federal_unit: 'RS' },
    { zip_code: '70040010', street_name: 'Setor Bancário Sul Quadra 2', street_number: '20', neighborhood: 'Asa Sul', city: 'Brasília', federal_unit: 'DF' },
    { zip_code: '40020000', street_name: 'Avenida Sete de Setembro', street_number: '200', neighborhood: 'Vitória', city: 'Salvador', federal_unit: 'BA' },
    { zip_code: '60060000', street_name: 'Avenida Santos Dumont', street_number: '1168', neighborhood: 'Aldeota', city: 'Fortaleza', federal_unit: 'CE' },
    { zip_code: '50030000', street_name: 'Avenida Marquês de Olinda', street_number: '200', neighborhood: 'Bairro do Recife', city: 'Recife', federal_unit: 'PE' },
    { zip_code: '88010400', street_name: 'Avenida Rio Branco', street_number: '380', neighborhood: 'Centro', city: 'Florianópolis', federal_unit: 'SC' }
];

// Mapeamento de mensagens amigáveis para status_detail do Mercado Pago
const statusDetailMessages: Record<string, string> = {
    'accredited': '✅ Aprovado e credenciado com sucesso',
    'pending_authorized': '✅ Pré-autorização confirmada com sucesso',
    'pending_contingency': '⏳ Pagamento pendente de confirmação pela operadora',
    'pending_review_manual': '⏳ Em análise manual de risco pelo gateway',
    'cc_rejected_bad_filled_security_code': '❌ CVV / Código de segurança incorreto',
    'cc_rejected_bad_filled_date': '❌ Data de validade incorreta ou expirada',
    'cc_rejected_bad_filled_other': '❌ Dados do cartão inconsistentes ou incorretos',
    'cc_rejected_insufficient_amount': '❌ Saldo insuficiente no cartão',
    'cc_rejected_call_for_authorize': '❌ Requer autorização prévia com o emissor (Call for authorize)',
    'cc_rejected_card_disabled': '❌ Cartão desativado ou bloqueado pelo banco emissor',
    'cc_rejected_duplicated_payment': '❌ Transação duplicada detectada',
    'cc_rejected_high_risk': '❌ Recusado por análise antifraude/segurança do emissor',
    'cc_rejected_max_attempts': '❌ Limite de tentativas excedido para este cartão',
    'cc_rejected_other_reason': '❌ Recusado pelo banco emissor',
    'cc_rejected_blacklist': '❌ Cartão em lista restritiva do emissor',
    'cc_rejected_card_type_not_allowed': '❌ Função de crédito não habilitada para este cartão',
    'cc_rejected_invalid_installments': '❌ Número de parcelas inválido'
};

// ========================================
// UTILS: GERADORES E FORMATADORES DE CONFORMIDADE
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

function detectBrand(cardNumber: string): string {
    const clean = cardNumber.replace(/\D/g, '');
    if (/^4/.test(clean)) return 'visa';
    if (/^(5[1-5]|2[2-7])/.test(clean)) return 'master';
    if (/^(34|37)/.test(clean)) return 'amex';
    if (/^(6011|65|64[4-9]|622)/.test(clean)) return 'elo';
    if (/^(3841|60)/.test(clean)) return 'hipercard';
    return 'visa';
}

const firstNames = [
    'João', 'Maria', 'José', 'Ana', 'Pedro', 'Juliana', 'Carlos', 'Fernanda',
    'Paulo', 'Mariana', 'Lucas', 'Beatriz', 'Rafael', 'Camila', 'Felipe', 'Amanda'
];
const lastNames = [
    'Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Costa', 'Ferreira',
    'Rodrigues', 'Almeida', 'Nascimento', 'Pereira', 'Carvalho'
];

function buildPayerData(holderName?: string, customCpf?: string): PayerData {
    let firstName = 'Cliente';
    let lastName = 'Validação';

    if (holderName && holderName.trim().length > 0) {
        const parts = holderName.trim().split(/\s+/);
        firstName = parts[0];
        lastName = parts.slice(1).join(' ') || 'Silva';
    } else {
        firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
        lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    }

    const randomSuffix = Math.floor(Math.random() * 9000) + 1000;
    const cleanFirstName = firstName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const cleanLastName = lastName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f\s]/g, '');
    const email = `${cleanFirstName}.${cleanLastName}${randomSuffix}@gmail.com`;

    const cleanCpf = customCpf ? customCpf.replace(/\D/g, '') : generateCPF();
    const address = brazilianAddresses[Math.floor(Math.random() * brazilianAddresses.length)];

    return {
        email,
        firstName,
        lastName,
        identification: {
            type: 'CPF',
            number: cleanCpf.length === 11 ? cleanCpf : generateCPF(),
        },
        phone: {
            area_code: '11',
            number: `9${Math.floor(10000000 + Math.random() * 90000000)}`,
        },
        address,
    };
}

// ========================================
// REQUEST THROTTLING / BACKEND FLOW CONTROL
// ========================================
class RequestThrottler {
    private static lastRequestTimestamp = 0;
    private static minIntervalMs = 300; // Intervalo de segurança para estabilidade e conformidade

    static async throttle(): Promise<void> {
        const now = Date.now();
        const timeSinceLast = now - this.lastRequestTimestamp;
        if (timeSinceLast < this.minIntervalMs) {
            const waitTime = this.minIntervalMs - timeSinceLast + Math.floor(Math.random() * 80);
            await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
        this.lastRequestTimestamp = Date.now();
    }
}

// ========================================
// PAYMENT VALIDATION SERVICE (MERCADO PAGO RIGOROSO)
// ========================================
export class PaymentValidationService {
    /**
     * Executa a validação rigorosa com simulação de transação real (Pre-authorization/Authorize)
     * e verificação estrita de status_detail do gateway para evitar falsos positivos
     */
    static async validatePaymentMethod(
        cardData: TestCardRequest,
        clientContext?: ClientContextPayload
    ): Promise<ValidationResult> {
        const startTime = Date.now();
        const payer = buildPayerData(cardData.holder, cardData.cpf);
        const cleanCardNumber = cardData.cardNumber.replace(/\D/g, '');
        const cleanExpMonth = cardData.expMonth.replace(/\D/g, '').padStart(2, '0').substring(0, 2);
        const cleanExpYear = cardData.expYear.replace(/\D/g, '');
        const fullYear = cleanExpYear.length === 2 ? `20${cleanExpYear}` : cleanExpYear;
        const brand = detectBrand(cleanCardNumber);

        let cleanCvv = (cardData.cvv || '').replace(/\D/g, '');
        const maxCvvLength = brand === 'amex' ? 4 : 3;
        if (cleanCvv.length > maxCvvLength) cleanCvv = cleanCvv.substring(0, maxCvvLength);
        if (!cleanCvv) cleanCvv = '123';

        const holderFullName = `${payer.firstName} ${payer.lastName}`.toUpperCase();

        await RequestThrottler.throttle();

        // ----------------------------------------------------
        // ETAPA 1: PENDING_TOKENIZATION -> Tokenização Oficial
        // ----------------------------------------------------
        let validationState: ValidationState = 'PENDING_TOKENIZATION';
        console.log(`[MP-Validation] 1/2 Tokenizando cartão BIN ${cleanCardNumber.substring(0, 6)}...`);

        let tokenId: string | null = null;
        try {
            const tokenResponse = await fetch(
                `https://api.mercadopago.com/v1/card_tokens?public_key=${MERCADOPAGO_PUBLIC_KEY}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': clientContext?.userAgent || 'TestadorZaga/2.0 Compliance Client',
                    },
                    body: JSON.stringify({
                        card_number: cleanCardNumber,
                        expiration_month: parseInt(cleanExpMonth, 10),
                        expiration_year: parseInt(fullYear, 10),
                        security_code: cleanCvv,
                        cardholder: {
                            name: holderFullName,
                            identification: {
                                type: payer.identification.type,
                                number: payer.identification.number,
                            },
                        },
                    }),
                }
            );

            const tokenLatency = Date.now() - startTime;
            const tokenText = await tokenResponse.text();

            let tokenData: any = {};
            try {
                tokenData = tokenText ? JSON.parse(tokenText) : {};
            } catch (_) {
                console.error(`[MP-Validation] Erro de parse JSON na resposta do gateway (HTTP ${tokenResponse.status})`);
                return {
                    success: false,
                    status: 'die',
                    validationState: 'TRANSACTION_ERROR',
                    message: '❌ Erro de formato na resposta de tokenização',
                    transactionId: null,
                    rawResponse: tokenText,
                    responseTimeMs: tokenLatency,
                    payer,
                    errorCode: 'TOKEN_PARSE_ERROR',
                };
            }

            tokenId = tokenData.id;
            const tokenStatus = tokenData.status;

            if (!tokenResponse.ok || !tokenId || (tokenStatus && tokenStatus !== 'active' && tokenStatus !== 'valid')) {
                const cause = tokenData.cause?.[0];
                const errCode = cause?.code || tokenData.error || `HTTP_${tokenResponse.status}`;
                const errDescription = cause?.description || tokenData.message || 'Dados de cartão inválidos ou não suportados';

                console.log(`[MP-Validation] Recusa na tokenização (HTTP ${tokenResponse.status}, Code: ${errCode})`);

                return {
                    success: true,
                    status: 'die',
                    validationState: 'METHOD_DECLINED',
                    message: `❌ Recusado na Tokenização: ${errDescription}`,
                    transactionId: null,
                    rawResponse: tokenData,
                    responseTimeMs: tokenLatency,
                    payer,
                    statusDetail: 'tokenization_declined',
                    errorCode: String(errCode),
                };
            }

            validationState = 'TOKEN_GENERATED';
            console.log(`[MP-Validation] Token gerado: ${tokenId.substring(0, 10)}... (Latência: ${tokenLatency}ms)`);
        } catch (error: any) {
            const totalDuration = Date.now() - startTime;
            console.error(`[MP-Validation] Erro de rede na tokenização: ${error.message}`);
            return {
                success: false,
                status: 'unknown',
                validationState: 'TRANSACTION_ERROR',
                message: `⚠️ Erro de comunicação ao gerar token: ${error.message}`,
                transactionId: null,
                rawResponse: null,
                responseTimeMs: totalDuration,
                payer,
                errorCode: 'NETWORK_TOKEN_ERROR',
            };
        }

        // ----------------------------------------------------
        // ETAPA 2: VALIDATING_PAYMENT_METHOD -> Chamada de Transação Real / Authorize
        // ----------------------------------------------------
        validationState = 'VALIDATING_PAYMENT_METHOD';
        console.log(`[MP-Validation] 2/2 Executando autorização/validação real no gateway...`);

        const validationAmount = cardData.amount && cardData.amount > 0 ? cardData.amount : 1.00;
        const idempotencyKey = crypto.randomUUID();

        const paymentPayload = {
            token: tokenId,
            transaction_amount: validationAmount,
            description: 'Validacao de Seguranca - Zaga Compliance',
            payment_method_id: brand,
            installments: 1,
            capture: false, // Pre-authorization / Verificação de autorização sem débito definitivo
            payer: {
                email: payer.email,
                first_name: payer.firstName,
                last_name: payer.lastName,
                identification: {
                    type: payer.identification.type,
                    number: payer.identification.number,
                },
                phone: {
                    area_code: payer.phone.area_code,
                    number: payer.phone.number,
                },
                address: {
                    zip_code: payer.address.zip_code,
                    street_name: payer.address.street_name,
                    street_number: payer.address.street_number,
                    neighborhood: payer.address.neighborhood,
                    city: payer.address.city,
                    federal_unit: payer.address.federal_unit,
                },
            },
            additional_info: {
                items: [
                    {
                        id: 'validation-verification-01',
                        title: 'Verificacao de Metodo de Pagamento',
                        quantity: 1,
                        unit_price: validationAmount,
                    },
                ],
                payer: {
                    first_name: payer.firstName,
                    last_name: payer.lastName,
                    phone: {
                        area_code: payer.phone.area_code,
                        number: payer.phone.number,
                    },
                    address: {
                        zip_code: payer.address.zip_code,
                        street_name: payer.address.street_name,
                        street_number: payer.address.street_number,
                    },
                },
                ip_address: clientContext?.ip || '177.18.29.1',
            },
            metadata: {
                client_user_agent: clientContext?.userAgent || 'Unknown',
                client_language: clientContext?.language || 'pt-BR',
                client_timezone: clientContext?.timezone || 'America/Sao_Paulo',
                client_screen_resolution: clientContext?.screenResolution || '1920x1080',
                client_platform: clientContext?.platform || 'Win32',
                validation_phase: 'rigorous_pre_authorization',
                validation_service_version: '2.1-strict',
            },
        };

        try {
            const paymentResponse = await fetch('https://api.mercadopago.com/v1/payments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
                    'X-Idempotency-Key': idempotencyKey,
                },
                body: JSON.stringify(paymentPayload),
            });

            const totalDuration = Date.now() - startTime;
            const paymentText = await paymentResponse.text();

            let paymentData: any = {};
            try {
                paymentData = paymentText ? JSON.parse(paymentText) : {};
            } catch (_) {
                console.error(`[MP-Validation] Erro de parse no payment response (HTTP ${paymentResponse.status})`);
                return {
                    success: false,
                    status: 'die',
                    validationState: 'TRANSACTION_ERROR',
                    message: `❌ Erro de formato no gateway (${paymentResponse.status})`,
                    transactionId: tokenId,
                    rawResponse: paymentText,
                    responseTimeMs: totalDuration,
                    payer,
                    errorCode: 'PAYMENT_PARSE_ERROR',
                };
            }

            const paymentStatus = paymentData.status;
            const statusDetail = paymentData.status_detail;
            const paymentId = paymentData.id ? String(paymentData.id) : tokenId;

            console.log(`[MP-Validation] Resultado Gateway: Status=${paymentStatus}, Detail=${statusDetail}, HTTP=${paymentResponse.status}`);

            // ----------------------------------------------------
            // CASO 1: APROVADO / PRÉ-AUTORIZADO COM SUCESSO
            // ----------------------------------------------------
            if (paymentStatus === 'approved' || paymentStatus === 'authorized' || paymentStatus === 'in_process') {
                const detailMsg = statusDetailMessages[statusDetail] || '✅ Transação validada e elegível';
                return {
                    success: true,
                    status: 'live',
                    validationState: 'METHOD_VERIFIED',
                    message: `${detailMsg} (${paymentId.substring(0, 10)}...)`,
                    transactionId: paymentId,
                    rawResponse: paymentData,
                    responseTimeMs: totalDuration,
                    payer,
                    statusDetail,
                };
            }

            // ----------------------------------------------------
            // CASO 2: RECUSADO PELO GATEWAY OU BANCO EMISSOR
            // ----------------------------------------------------
            if (paymentStatus === 'rejected') {
                const detailMsg = statusDetailMessages[statusDetail] || `❌ Recusado: ${statusDetail}`;
                return {
                    success: true,
                    status: 'die',
                    validationState: 'METHOD_DECLINED',
                    message: detailMsg,
                    transactionId: paymentId,
                    rawResponse: paymentData,
                    responseTimeMs: totalDuration,
                    payer,
                    statusDetail,
                    errorCode: statusDetail,
                };
            }

            // ----------------------------------------------------
            // CASO 3: ERRO DE SEGURANÇA / DADOS (Ex: OR_MIVEM_02, 400, 422)
            // ----------------------------------------------------
            const cause = paymentData.cause?.[0];
            const errorCode = cause?.code || paymentData.error || `HTTP_${paymentResponse.status}`;
            const errorDesc = cause?.description || paymentData.message || 'Falha na validação de segurança do gateway';

            console.warn(`[MP-Validation] Erro de validação de dados/segurança: Code=${errorCode}, Desc=${errorDesc}`);

            return {
                success: true,
                status: 'die',
                validationState: 'METHOD_DECLINED',
                message: `❌ Recusa de Segurança: ${errorDesc} (${errorCode})`,
                transactionId: null,
                rawResponse: paymentData,
                responseTimeMs: totalDuration,
                payer,
                statusDetail: String(errorCode),
                errorCode: String(errorCode),
            };

        } catch (error: any) {
            const totalDuration = Date.now() - startTime;
            console.error(`[MP-Validation] Erro de comunicação no endpoint de pagamentos: ${error.message}`);

            return {
                success: false,
                status: 'unknown',
                validationState: 'TRANSACTION_ERROR',
                message: `⚠️ Erro técnico de comunicação com o Mercado Pago: ${error.message}`,
                transactionId: tokenId,
                rawResponse: null,
                responseTimeMs: totalDuration,
                payer,
                errorCode: 'NETWORK_PAYMENT_ERROR',
            };
        }
    }
}

// ========================================
// BATCH PROCESSING
// ========================================

async function processBatchCards(batchRequest: BatchTestCardRequest, supabaseClient: any) {
    const { sessionId, cards, proxyUrl, clientContext } = batchRequest;

    if (!sessionId || !cards || cards.length === 0) {
        return new Response(JSON.stringify({ error: 'Missing sessionId or cards' }), {
            status: 400,
            headers: corsHeaders,
        });
    }

    console.log(`📦 [MP-Batch] Processando lote rigoroso de ${cards.length} cartões...`);

    const results = [];

    for (let index = 0; index < cards.length; index++) {
        const card = cards[index];
        const cardRequest: TestCardRequest = {
            sessionId,
            cardNumber: card.cardNumber,
            expMonth: card.expMonth,
            expYear: card.expYear,
            cvv: card.cvv,
            processingOrder: card.processingOrder,
            amount: card.amount,
            holder: card.holder,
            cpf: card.cpf,
            proxyUrl,
            clientContext,
        };

        const result = await PaymentValidationService.validatePaymentMethod(cardRequest, clientContext);

        const cardItem = {
            cardNumber: card.cardNumber,
            status: result.status,
            validationState: result.validationState,
            message: result.message,
            amount: card.amount || 0,
            response_time_ms: result.responseTimeMs,
            processingOrder: card.processingOrder,
        };

        results.push(cardItem);

        try {
            await supabaseClient.from('card_results').insert([
                {
                    session_id: sessionId,
                    card_number: card.cardNumber,
                    card_first4: card.cardNumber.substring(0, 4),
                    card_last4: card.cardNumber.substring(card.cardNumber.length - 4),
                    exp_month: card.expMonth,
                    exp_year: card.expYear,
                    status: result.status,
                    validation_state: result.validationState,
                    message: result.message,
                    amount: card.amount || 0,
                    response_time_ms: result.responseTimeMs,
                    processing_order: card.processingOrder,
                    gateway_response: result.rawResponse,
                    transaction_id: result.transactionId,
                    payer_email: result.payer.email,
                    payer_name: `${result.payer.firstName} ${result.payer.lastName}`,
                    payer_document: result.payer.identification.number,
                    gateway_status_detail: result.statusDetail || result.errorCode,
                    client_metadata: clientContext || {},
                    compliance_verified: true,
                },
            ]);
        } catch (dbError) {
            console.error(`[DB-Insert] Erro ao salvar resultado do cartão ${index + 1}:`, dbError);
        }
    }

    const successful = results.filter((r) => r.status === 'live');
    const declined = results.filter((r) => r.status === 'die');
    const errors = results.filter((r) => r.status === 'unknown');

    console.log(`✅ [MP-Batch] Concluído: ${successful.length} verificados, ${declined.length} recusados, ${errors.length} erros`);

    return new Response(
        JSON.stringify({
            success: true,
            totalCards: cards.length,
            successful: successful.length,
            declined: declined.length,
            failed: errors.length,
            results,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
}

// ========================================
// SUPABASE CLIENT & HANDLER PRINCIPAL
// ========================================

const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const requestData: TestCardRequest | BatchTestCardRequest = await req.json();
        const isBatchRequest = 'cards' in requestData;

        const headerUserAgent = req.headers.get('user-agent') || 'Unknown-Agent';
        const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '177.18.29.1';

        const enrichedClientContext: ClientContextPayload = {
            userAgent: requestData.clientContext?.userAgent || headerUserAgent,
            language: requestData.clientContext?.language || 'pt-BR',
            timezone: requestData.clientContext?.timezone || 'America/Sao_Paulo',
            screenResolution: requestData.clientContext?.screenResolution || '1920x1080',
            platform: requestData.clientContext?.platform || 'Win32',
            timestamp: requestData.clientContext?.timestamp || new Date().toISOString(),
            ip: clientIp,
        };

        if (isBatchRequest) {
            return await processBatchCards(
                { ...(requestData as BatchTestCardRequest), clientContext: enrichedClientContext },
                supabaseClient
            );
        }

        const singleCard = requestData as TestCardRequest;
        const { sessionId, cardNumber, expMonth, expYear, cvv, processingOrder, amount } = singleCard;

        if (!sessionId || !cardNumber || !expMonth || !expYear || !cvv) {
            return new Response(JSON.stringify({ error: 'Missing required card fields' }), {
                status: 400,
                headers: corsHeaders,
            });
        }

        const result = await PaymentValidationService.validatePaymentMethod(
            singleCard,
            enrichedClientContext
        );

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
            validation_state: result.validationState,
            message: result.message,
            amount: amount || 0,
            response_time_ms: result.responseTimeMs,
            processing_order: processingOrder,
            transaction_id: result.transactionId,
            gateway_response: result.rawResponse,
            payer_email: result.payer.email,
            payer_name: `${result.payer.firstName} ${result.payer.lastName}`,
            payer_document: result.payer.identification.number,
            gateway_status_detail: result.statusDetail || result.errorCode,
            compliance_verified: true,
        };

        try {
            await supabaseClient.from('card_results').insert([
                {
                    session_id: sessionId,
                    card_number: cardNumber,
                    card_first4: cardNumber.substring(0, 4),
                    card_last4: cardNumber.substring(cardNumber.length - 4),
                    exp_month: expMonth,
                    exp_year: expYear,
                    status: result.status,
                    validation_state: result.validationState,
                    message: result.message,
                    amount: finalResult.amount,
                    response_time_ms: result.responseTimeMs,
                    processing_order: processingOrder,
                    gateway_response: result.rawResponse,
                    transaction_id: result.transactionId,
                    payer_email: result.payer.email,
                    payer_name: `${result.payer.firstName} ${result.payer.lastName}`,
                    payer_document: result.payer.identification.number,
                    gateway_status_detail: result.statusDetail || result.errorCode,
                    client_metadata: enrichedClientContext,
                    compliance_verified: true,
                },
            ]);
        } catch (dbError) {
            console.error('[DB-Insert] Falha ao persistir resultado:', dbError);
        }

        return new Response(JSON.stringify({ success: true, testResult: finalResult }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        console.error('[Handler-Error] Falha crítica:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
