// Teste completo com as DUAS chaves
const credentials = [
    {
        name: 'Chave Antiga',
        merchantId: 'c8bb2f93-34b2-4bc8-a382-be44300aa20e',
        merchantKey: 'QwjkObfkerFPwgsnHDhc2v5atcCWU4QdUuZGoSWE'
    },
    {
        name: 'Chave Nova (Produção)',
        merchantId: 'c8bb2f93-34b2-4bc8-a382-be44300aa20e',
        merchantKey: '44Zz43Y4YI2xcj7zbZEdPO77ScT7i9AiGfBKWW8F'
    }
];

const CIELO_API_URL = 'https://api.cieloecommerce.cielo.com.br/1/sales';

const testCard = {
    number: '4532117080573700',
    month: '12',
    year: '2025',
    cvv: '123',
    holder: 'TESTE HOLDER',
    cpf: '12345678909'
};

async function testCredential(cred) {
    console.log('\n' + '='.repeat(70));
    console.log(`\n🔑 Testando: ${cred.name}`);
    console.log(`   MerchantId: ${cred.merchantId}`);
    console.log(`   MerchantKey: ${cred.merchantKey.substring(0, 15)}...\n`);

    const payload = {
        MerchantOrderId: `KEY-TEST-${Date.now()}`,
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
            SoftDescriptor: 'KeyTest',
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
        console.log('📤 Enviando requisição...');

        const response = await fetch(CIELO_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'MerchantId': cred.merchantId,
                'MerchantKey': cred.merchantKey
            },
            body: JSON.stringify(payload)
        });

        console.log(`📥 Status HTTP: ${response.status}`);
        console.log(`   Content-Type: ${response.headers.get('content-type')}`);

        // Verificar se há conteúdo
        const textResponse = await response.text();
        console.log(`   Tamanho da resposta: ${textResponse.length} bytes`);

        if (!textResponse || textResponse.length === 0) {
            console.log('\n❌ ERRO: Resposta vazia da API');
            console.log('   Possíveis causas:');
            console.log('   - Credenciais bloqueadas');
            console.log('   - IP não autorizado');
            console.log('   - Limitação de rate limit\n');
            return { success: false, error: 'Empty response' };
        }

        let data;
        try {
            data = JSON.parse(textResponse);
        } catch (e) {
            console.log('\n❌ ERRO: Resposta não é JSON válido');
            console.log(`   Resposta recebida: ${textResponse.substring(0, 500)}\n`);
            return { success: false, error: 'Invalid JSON' };
        }

        // Análise da resposta
        if (response.status === 401) {
            console.log('\n❌ FALHA: 401 Unauthorized');
            console.log('   As credenciais estão incorretas ou não ativadas.\n');
            return { success: false, status: 401 };
        }

        if (response.ok && data.Payment) {
            const status = data.Payment.Status;
            const returnCode = data.Payment.ReturnCode;
            const returnMessage = data.Payment.ReturnMessage;

            console.log(`\n   Status: ${status}`);
            console.log(`   ReturnCode: ${returnCode}`);
            console.log(`   Message: ${returnMessage}`);

            if (returnCode === '002') {
                console.log('\n❌ FALHA: Credenciais Inválidas (erro 002)');
                console.log('   Esta chave não está autorizada.\n');
                return { success: false, returnCode: '002' };
            } else if (status === 1 || status === 2) {
                console.log('\n✅ SUCESSO! Chave ATIVA e AUTORIZADA!');
                console.log('   A transação foi aprovada.\n');
                return { success: true, status, returnCode, returnMessage };
            } else if (status === 3) {
                console.log('\n⚠️  Chave ATIVA, mas transação negada.');
                console.log(`   Motivo: ${returnMessage}\n`);
                return { success: true, status, returnCode, returnMessage, denied: true };
            } else {
                console.log(`\n ℹ️  Status ${status}: ${returnMessage}\n`);
                return { success: false, status, returnCode, returnMessage };
            }
        } else if (Array.isArray(data)) {
            console.log('\n❌ ERRO na validação:');
            data.forEach(err => {
                console.log(`   Código ${err.Code}: ${err.Message}`);
            });
            console.log();
            return { success: false, errors: data };
        }

    } catch (error) {
        console.log(`\n💥 ERRO: ${error.message}\n`);
        return { success: false, error: error.message };
    }
}

(async () => {
    console.log('\n🧪 TESTE DAS CREDENCIAIS CIELO');
    console.log('='.repeat(70));

    const results = [];

    for (const cred of credentials) {
        const result = await testCredential(cred);
        results.push({ name: cred.name, result });
        // Delay entre testes
        await new Promise(resolve => setTimeout(resolve, 1500));
    }

    console.log('\n' + '='.repeat(70));
    console.log('\n📊 RESUMO DOS TESTES:\n');

    let workingKey = null;
    results.forEach((r, idx) => {
        const symbol = r.result.success ? '✅' : '❌';
        console.log(`${symbol} ${r.name}:`);
        if (r.result.success) {
            console.log(`   Status: Ativa${r.result.denied ? ' (transação negada)' : ' e funcionando'}`);
            if (!r.result.denied) {
                workingKey = credentials[idx];
            }
        } else {
            const reason = r.result.returnCode === '002' ? 'Credenciais Inválidas' :
                r.result.status === 401 ? 'Não Autorizada' :
                    r.result.error || 'Erro desconhecido';
            console.log(`   Status: ${reason}`);
        }
        console.log();
    });

    if (workingKey) {
        console.log('🎉 CHAVE FUNCIONANDO ENCONTRADA!');
        console.log(`   Nome: ${workingKey.name || 'Chave ativa'}`);
        console.log(`   MerchantId: ${workingKey.merchantId}`);
        console.log(`   MerchantKey: ${workingKey.merchantKey.substring(0, 20)}...`);
        console.log('\n📝 PRÓXIMO PASSO:');
        console.log('   Configure esta chave nas variáveis de ambiente do Supabase:');
        console.log('   - CIELO_MERCHANT_ID');
        console.log('   - CIELO_MERCHANT_KEY\n');
    } else {
        console.log('⚠️  NENHUMA CHAVE FUNCIONANDO');
        console.log('\n📝 PRÓXIMOS PASSOS:');
        console.log('   1. Verificar com a Cielo se as credenciais foram ativadas');
        console.log('   2. Confirmar se o ambiente correto está sendo usado (sandbox vs produção)');
        console.log('   3. Verificar se há restrições de IP na conta Cielo\n');
    }
})();
