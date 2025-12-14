// Teste com a NOVA chave fornecida em 13/12/2025
const CIELO_MERCHANT_ID = 'c8bb2f93-34b2-4bc8-a382-be44300aa20e';
const CIELO_MERCHANT_KEY = 'lSpilX520QWIdAy3t2zac7EJcXKeYTju2PLgrMZj';
const CIELO_API_URL = 'https://api.cieloecommerce.cielo.com.br/1/sales';

console.log('🔑 TESTANDO NOVA CHAVE CIELO (13/12/2025)\n');
console.log('═'.repeat(70) + '\n');
console.log('📋 Credenciais:');
console.log(`   MerchantId: ${CIELO_MERCHANT_ID}`);
console.log(`   MerchantKey: ${CIELO_MERCHANT_KEY.substring(0, 20)}...`);
console.log(`   Endpoint: ${CIELO_API_URL}\n`);

const testCard = {
    number: '4532117080573700', // Cartão de teste Visa
    month: '12',
    year: '2025',
    cvv: '123',
    holder: 'TESTE HOLDER',
    cpf: '12345678909'
};

console.log('💳 Cartão de teste:');
console.log(`   Número: ${testCard.number}`);
console.log(`   Validade: ${testCard.month}/${testCard.year}`);
console.log(`   CVV: ${testCard.cvv} (${testCard.cvv.length} dígitos)`);
console.log(`   Titular: ${testCard.holder}\n`);

const payload = {
    MerchantOrderId: `LATEST-KEY-TEST-${Date.now()}`,
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
        Amount: 100, // R$ 1,00
        Installments: 1,
        Capture: true,
        SoftDescriptor: 'LatestTest',
        CreditCard: {
            CardNumber: testCard.number,
            Holder: testCard.holder,
            ExpirationDate: `${testCard.month}/${testCard.year}`,
            SecurityCode: testCard.cvv,
            Brand: 'Visa'
        }
    }
};

console.log('📤 Enviando requisição para Cielo...\n');

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
            console.log('❌ ERRO: Resposta vazia da API');
            console.log('═'.repeat(70));
            console.log('\n⚠️  RESULTADO: Chave pode estar bloqueada ou com restrição de IP\n');
            return;
        }

        const data = JSON.parse(textResponse);

        console.log('═'.repeat(70));
        console.log('\n📊 RESPOSTA DA CIELO:\n');
        console.log(JSON.stringify(data, null, 2));
        console.log('\n' + '═'.repeat(70) + '\n');

        // Análise detalhada
        if (response.status === 401) {
            console.log('❌ RESULTADO: 401 Unauthorized');
            console.log('   As credenciais estão incorretas ou não foram ativadas.\n');
            return;
        }

        if (response.ok && data.Payment) {
            const status = data.Payment.Status;
            const returnCode = data.Payment.ReturnCode;
            const returnMessage = data.Payment.ReturnMessage;

            console.log('📈 ANÁLISE DA TRANSAÇÃO:\n');
            console.log(`   Status do Pagamento: ${status}`);
            console.log(`   Código de Retorno: ${returnCode}`);
            console.log(`   Mensagem: ${returnMessage}\n`);

            // Mapeamento de status
            const statusMap = {
                0: 'NotFinished - Transação não finalizada',
                1: 'Authorized - Autorizado ✅',
                2: 'PaymentConfirmed - Capturado ✅',
                3: 'Denied - Negado ❌',
                10: 'Voided - Cancelado',
                11: 'Refunded - Estornado',
                12: 'Pending - Pendente',
                13: 'Aborted - Abortado',
                20: 'Scheduled - Agendado'
            };

            console.log(`   Significado: ${statusMap[status] || 'Status desconhecido'}\n`);

            if (returnCode === '002') {
                console.log('❌ RESULTADO FINAL: CREDENCIAIS INVÁLIDAS');
                console.log('   Erro 002: Esta chave ainda não está autorizada pela Cielo.');
                console.log('\n💡 PRÓXIMOS PASSOS:');
                console.log('   1. Aguardar ativação completa da chave (pode levar até 24h)');
                console.log('   2. Verificar no portal Cielo se a chave está "Ativa"');
                console.log('   3. Confirmar que não há restrições de IP configuradas\n');
            } else if (status === 1 || status === 2) {
                console.log('🎉 RESULTADO FINAL: CHAVE ESTÁ ATIVA E FUNCIONANDO!');
                console.log('   ✅ A transação foi AUTORIZADA pela Cielo!');
                console.log('   ✅ O sistema está pronto para uso!\n');
                console.log('💡 PRÓXIMO PASSO:');
                console.log('   Configurar esta chave nas variáveis de ambiente do Supabase:');
                console.log(`   - CIELO_MERCHANT_ID = ${CIELO_MERCHANT_ID}`);
                console.log(`   - CIELO_MERCHANT_KEY = ${CIELO_MERCHANT_KEY}\n`);
            } else if (status === 3) {
                console.log('⚠️  RESULTADO FINAL: CHAVE ATIVA, MAS TRANSAÇÃO NEGADA');
                console.log('   ✅ A chave está funcionando!');
                console.log(`   ❌ Transação negada: ${returnMessage}`);
                console.log('\n   Isso é NORMAL - a chave está ATIVA, apenas o cartão de teste');
                console.log('   foi negado pelo banco emissor (comportamento esperado).\n');
                console.log('💡 PRÓXIMO PASSO:');
                console.log('   Configurar esta chave nas variáveis de ambiente e começar a usar!\n');
            } else {
                console.log(`ℹ️  RESULTADO: Status ${status} - ${returnMessage}\n`);
            }

            // Verificar se há erro 146
            if (data[0]?.Code === '146') {
                console.log('⚠️  ATENÇÃO: ERRO 146 DETECTADO!');
                console.log('   SecurityCode length exceeded');
                console.log('   O CVV está sendo enviado com formato incorreto.\n');
            }

        } else if (Array.isArray(data)) {
            console.log('❌ ERROS DE VALIDAÇÃO:\n');
            data.forEach(err => {
                console.log(`   Código ${err.Code}: ${err.Message}`);
                if (err.Code === '146') {
                    console.log('   ⚠️  Erro 146: SecurityCode length exceeded');
                    console.log('   O CVV tem mais de 4 dígitos ou formato inválido.\n');
                }
            });
            console.log();
        }

    } catch (error) {
        console.log('═'.repeat(70));
        console.log(`\n💥 ERRO: ${error.message}\n`);
        console.error(error);
    }
})();
