// TESTE DE GATEWAY CIELO - SEM ZERO AUTH
// Simula uma compra real de loja online (R$ 1,00)

const CIELO_MERCHANT_ID = 'c8bb2f93-34b2-4bc8-a382-be44300aa20e';
const CIELO_MERCHANT_KEY = 'lSpilX520QWIdAy3t2zac7EJcXKeYTju2PLgrMZj';
const CIELO_API_URL = 'https://api.cieloecommerce.cielo.com.br/1/sales';

console.log('🛒 TESTE DE GATEWAY CIELO - TRANSAÇÃO DE COMPRA\n');
console.log('═'.repeat(70) + '\n');
console.log('📋 Tipo de teste: COMPRA REAL (como loja online)');
console.log('💰 Valor: R$ 1,00 (100 centavos)');
console.log('🔐 Zero Auth: NÃO (usando transação normal de e-commerce)\n');
console.log('📋 Credenciais:');
console.log(`   MerchantId: ${CIELO_MERCHANT_ID}`);
console.log(`   MerchantKey: ${CIELO_MERCHANT_KEY.substring(0, 20)}...`);
console.log(`   Endpoint: ${CIELO_API_URL}\n`);

// Cartão de teste da Cielo que deve retornar APROVADO
const testCard = {
    number: '4532117080573700', // Visa de teste (aprovado)
    month: '12',
    year: '2025',
    cvv: '123',
    holder: 'TESTE HOLDER',
    cpf: '12345678909'
};

console.log('💳 Cartão de teste:');
console.log(`   Número: ${testCard.number}`);
console.log(`   Validade: ${testCard.month}/${testCard.year}`);
console.log(`   CVV: ${testCard.cvv}`);
console.log(`   Titular: ${testCard.holder}\n`);

const payload = {
    MerchantOrderId: `GATEWAY-TEST-${Date.now()}`,
    Customer: {
        Name: testCard.holder,
        Email: 'teste@teste.com',
        Identity: testCard.cpf,
        IdentityType: 'CPF',
        Address: {
            Street: 'Rua Teste',
            Number: '123',
            Complement: '',
            ZipCode: '01001000',
            City: 'Sao Paulo',
            State: 'SP',
            Country: 'BRA'
        }
    },
    Payment: {
        Type: 'CreditCard',
        Amount: 100, // R$ 1,00 em centavos
        Installments: 1,
        Capture: true, // Captura automática (como loja online)
        SoftDescriptor: 'GatewayTest',
        CreditCard: {
            CardNumber: testCard.number,
            Holder: testCard.holder,
            ExpirationDate: `${testCard.month}/${testCard.year}`,
            SecurityCode: testCard.cvv,
            Brand: 'Visa'
        }
    }
};

console.log('📤 Enviando transação de COMPRA para Cielo...\n');

(async () => {
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

        console.log(`📥 Status HTTP: ${response.status}`);
        console.log(`   Content-Type: ${response.headers.get('content-type')}`);

        const textResponse = await response.text();
        console.log(`   Tamanho da resposta: ${textResponse.length} bytes\n`);

        if (!textResponse || textResponse.length === 0) {
            console.log('❌ ERRO: Resposta vazia');
            console.log('═'.repeat(70));
            console.log('\n⚠️  Possíveis causas:');
            console.log('   - Chave bloqueada');
            console.log('   - IP não autorizado');
            console.log('   - Gateway não ativo\n');
            return;
        }

        const data = JSON.parse(textResponse);

        console.log('═'.repeat(70));
        console.log('\n📊 RESPOSTA COMPLETA DA CIELO:\n');
        console.log(JSON.stringify(data, null, 2));
        console.log('\n' + '═'.repeat(70) + '\n');

        // Análise detalhada
        if (response.status === 401) {
            console.log('❌ RESULTADO: 401 Unauthorized');
            console.log('   Credenciais incorretas ou não autorizadas\n');
            return;
        }

        if (response.ok && data.Payment) {
            const status = data.Payment.Status;
            const returnCode = data.Payment.ReturnCode;
            const returnMessage = data.Payment.ReturnMessage;
            const paymentId = data.Payment.PaymentId;

            console.log('📈 ANÁLISE DA TRANSAÇÃO:\n');
            console.log(`   Payment ID: ${paymentId}`);
            console.log(`   Status: ${status}`);
            console.log(`   ReturnCode: ${returnCode}`);
            console.log(`   Mensagem: ${returnMessage}\n`);

            // Mapeamento de status
            const statusExplanation = {
                0: '⏳ NotFinished - Não finalizada',
                1: '✅ Authorized - AUTORIZADA',
                2: '✅ PaymentConfirmed - CAPTURADA',
                3: '❌ Denied - NEGADA',
                10: '🚫 Voided - Cancelada',
                11: '↩️ Refunded - Estornada',
                12: '⏳ Pending - Pendente',
                13: '⚠️ Aborted - Abortada',
                20: '📅 Scheduled - Agendada'
            };

            console.log(`   Significado: ${statusExplanation[status] || 'Status desconhecido'}\n`);

            // Análise do resultado
            console.log('═'.repeat(70) + '\n');

            if (returnCode === '002') {
                console.log('❌ GATEWAY NÃO ATIVO');
                console.log('\n📋 Diagnóstico:');
                console.log('   - Erro 002: Credenciais Inválidas');
                console.log('   - O gateway de e-commerce NÃO está habilitado');
                console.log('   - Ou as credenciais não têm permissão de transação\n');
                console.log('💡 Solução:');
                console.log('   1. Acesse o portal Cielo');
                console.log('   2. Vá em: Configurações → API → Gateway E-commerce');
                console.log('   3. Verifique se está "ATIVO"');
                console.log('   4. Confirme as permissões da chave API\n');

            } else if (status === 1 || status === 2) {
                console.log('🎉🎉🎉 GATEWAY TOTALMENTE ATIVO! 🎉🎉🎉\n');
                console.log('✅ A transação foi AUTORIZADA!');
                console.log('✅ O gateway de e-commerce está FUNCIONANDO!');
                console.log('✅ As chaves estão VÁLIDAS e ATIVAS!\n');
                console.log('📊 Detalhes da aprovação:');
                console.log(`   - PaymentId: ${paymentId}`);
                console.log(`   - Status: ${status === 1 ? 'Autorizado' : 'Capturado'}`);
                console.log(`   - Código: ${returnCode}`);
                console.log(`   - Valor: R$ 1,00\n`);
                console.log('💡 PRÓXIMO PASSO:');
                console.log('   Remover o DEMO_MODE e usar o gateway real!\n');
                console.log('🔧 Configuração:');
                console.log('   1. Abra: supabase/functions/test-card/index.ts');
                console.log('   2. Linha 328: Mude DEMO_MODE = false');
                console.log('   3. Remova as chamadas para zeroAuth()');
                console.log('   4. Use apenas processCieloSale()');
                console.log('   5. Deploy e pronto!\n');

            } else if (status === 3) {
                console.log('⚠️ GATEWAY ATIVO - Transação Negada\n');
                console.log('✅ As chaves estão FUNCIONANDO!');
                console.log('✅ O gateway está ATIVO!');
                console.log(`❌ Transação negada: ${returnMessage}\n`);
                console.log('📋 Isso é NORMAL:');
                console.log('   - O gateway está funcionando perfeitamente');
                console.log('   - O cartão de teste foi negado pelo banco');
                console.log('   - Comportamento esperado em ambiente de teste\n');
                console.log('💡 PRÓXIMO PASSO:');
                console.log('   Configurar o sistema para usar o gateway real!\n');

            } else if (status === 0) {
                console.log('⏳ TRANSAÇÃO NÃO FINALIZADA\n');
                console.log(`📋 ReturnCode: ${returnCode}`);
                console.log(`📋 Mensagem: ${returnMessage}\n`);

                if (returnCode === '002') {
                    console.log('❌ Gateway ainda não ativo para transações');
                } else {
                    console.log('⚠️ Outro problema na transação');
                }
                console.log();

            } else {
                console.log(`ℹ️ Status ${status}: ${returnMessage}\n`);
            }

        } else if (Array.isArray(data)) {
            console.log('❌ ERROS DE VALIDAÇÃO:\n');
            data.forEach(err => {
                console.log(`   ${err.Code}: ${err.Message}`);
            });
            console.log('\n💡 Verifique o formato dos dados enviados\n');
        }

        console.log('═'.repeat(70));

    } catch (error) {
        console.log('═'.repeat(70));
        console.log(`\n💥 ERRO: ${error.message}\n`);
        console.error(error);
    }
})();
