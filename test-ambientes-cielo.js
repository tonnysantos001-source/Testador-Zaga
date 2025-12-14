// TESTE DUPLO - SANDBOX E PRODUÇÃO
// Testa as chaves em ambos os ambientes

const CIELO_MERCHANT_ID = 'c8bb2f93-34b2-4bc8-a382-be44300aa20e';
const CIELO_MERCHANT_KEY = 'lSpilX520QWIdAy3t2zac7EJcXKeYTju2PLgrMZj';

const environments = [
    {
        name: 'PRODUÇÃO',
        url: 'https://api.cieloecommerce.cielo.com.br/1/sales'
    },
    {
        name: 'SANDBOX (Testes)',
        url: 'https://apisandbox.cieloecommerce.cielo.com.br/1/sales'
    }
];

const testCard = {
    number: '4532117080573700',
    month: '12',
    year: '2025',
    cvv: '123',
    holder: 'TESTE HOLDER',
    cpf: '12345678909'
};

async function testEnvironment(env) {
    console.log('\n' + '═'.repeat(70));
    console.log(`\n🌐 TESTANDO: ${env.name}`);
    console.log(`📍 URL: ${env.url}\n`);

    const payload = {
        MerchantOrderId: `ENV-TEST-${Date.now()}`,
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
            Amount: 100,
            Installments: 1,
            Capture: true,
            SoftDescriptor: 'EnvTest',
            CreditCard: {
                CardNumber: testCard.number,
                Holder: testCard.holder,
                ExpirationDate: `${testCard.month}/${testCard.year}`,
                SecurityCode: testCard.cvv,
                Brand: 'Visa'
            }
        }
    };

    try {
        const response = await fetch(env.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'MerchantId': CIELO_MERCHANT_ID,
                'MerchantKey': CIELO_MERCHANT_KEY
            },
            body: JSON.stringify(payload)
        });

        const textResponse = await response.text();

        console.log(`📥 Status HTTP: ${response.status}`);

        if (!textResponse || textResponse.length === 0) {
            console.log('❌ Resposta vazia');
            return { env: env.name, success: false, error: 'Empty response' };
        }

        const data = JSON.parse(textResponse);

        if (response.status === 401) {
            console.log('❌ 401 Unauthorized');
            return { env: env.name, success: false, status: 401 };
        }

        if (data.Payment) {
            const status = data.Payment.Status;
            const returnCode = data.Payment.ReturnCode;
            const returnMessage = data.Payment.ReturnMessage;

            console.log(`📊 Status: ${status}`);
            console.log(`📊 ReturnCode: ${returnCode}`);
            console.log(`📊 Mensagem: ${returnMessage}`);

            if (returnCode === '002') {
                console.log('\n❌ CREDENCIAIS INVÁLIDAS neste ambiente');
                return { env: env.name, success: false, returnCode: '002' };
            } else if (status === 1 || status === 2) {
                console.log('\n✅✅✅ FUNCIONOU NESTE AMBIENTE! ✅✅✅');
                console.log(`PaymentId: ${data.Payment.PaymentId}`);
                return { env: env.name, success: true, status, returnCode, paymentId: data.Payment.PaymentId };
            } else if (status === 3) {
                console.log('\n⚠️  CHAVE VÁLIDA - Transação negada');
                console.log('(Normal para cartões de teste)');
                return { env: env.name, success: true, status, returnCode, denied: true };
            } else {
                console.log(`\nℹ️  Status ${status}: ${returnMessage}`);
                return { env: env.name, success: false, status, returnCode };
            }
        } else if (Array.isArray(data)) {
            console.log('\n❌ Erros de validação:');
            data.forEach(err => console.log(`   ${err.Code}: ${err.Message}`));
            return { env: env.name, success: false, errors: data };
        }

    } catch (error) {
        console.log(`\n💥 Erro: ${error.message}`);
        return { env: env.name, success: false, error: error.message };
    }
}

(async () => {
    console.log('\n🔍 TESTE DE AMBIENTES CIELO');
    console.log('═'.repeat(70));
    console.log('\n📋 Credenciais:');
    console.log(`   MerchantId: ${CIELO_MERCHANT_ID}`);
    console.log(`   MerchantKey: ${CIELO_MERCHANT_KEY.substring(0, 20)}...`);

    const results = [];

    for (const env of environments) {
        const result = await testEnvironment(env);
        results.push(result);
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n' + '═'.repeat(70));
    console.log('\n📊 RESUMO DOS TESTES:\n');

    let workingEnv = null;
    results.forEach(r => {
        const symbol = r.success ? '✅' : '❌';
        console.log(`${symbol} ${r.env}:`);
        if (r.success) {
            console.log(`   Status: Funcionando${r.denied ? ' (transação negada)' : '!'}`);
            if (r.paymentId) {
                console.log(`   PaymentId: ${r.paymentId}`);
                workingEnv = r.env;
            }
        } else {
            const reason = r.returnCode === '002' ? 'Credenciais Inválidas' :
                r.status === 401 ? 'Não Autorizada' :
                    r.error || 'Erro desconhecido';
            console.log(`   Status: ${reason}`);
        }
        console.log();
    });

    if (workingEnv) {
        console.log('🎉 AMBIENTE FUNCIONANDO ENCONTRADO!');
        console.log(`   Ambiente: ${workingEnv}`);
        console.log('\n💡 PRÓXIMO PASSO:');
        console.log(`   Configurar o sistema para usar: ${workingEnv}\n`);
    } else {
        console.log('⚠️  NENHUM AMBIENTE FUNCIONANDO');
        console.log('\n💡 POSSÍVEIS CAUSAS:');
        console.log('   1. Credenciais ainda não ativadas completamente');
        console.log('   2. As chaves são de outro ambiente (diferentes das testadas)');
        console.log('   3. Restrições de IP no portal Cielo');
        console.log('   4. Permissões das chaves não incluem transações\n');
        console.log('📝 PRÓXIMOS PASSOS:');
        console.log('   1. Verifique no portal Cielo qual é o ambiente das chaves');
        console.log('   2. Confirme se as chaves têm permissão de "Transações"');
        console.log('   3. Verifique se não há restrição de IP');
        console.log('   4. Entre em contato com o suporte Cielo\n');
    }
})();
