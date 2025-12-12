// Script de monitoramento contínuo da API Cielo
// Para rodar: node test-cielo-monitor.js
// Testa a cada 30 segundos até funcionar

const CIELO_MERCHANT_ID = 'c8bb2f93-34b2-4bc8-a382-be44300aa20e';
const CIELO_MERCHANT_KEY = '44Zz43Y4YI2xcj7zbZEdPO77ScT7i9AiGfBKWW8F';
const CIELO_API_URL = 'https://api.cieloecommerce.cielo.com.br/1/sales';

// Cartão de teste Visa
const testCard = {
    number: '4532117080573700',
    month: '12',
    year: '2025',
    cvv: '123',
    holder: 'TESTE HOLDER',
    cpf: '12345678909'
};

console.log('🔄 MONITOR CIELO - Testando a cada 30 segundos\n');
console.log('📋 Credenciais:');
console.log(`   MerchantId: ${CIELO_MERCHANT_ID}`);
console.log(`   MerchantKey: ${CIELO_MERCHANT_KEY.substring(0, 10)}...`);
console.log(`   URL: ${CIELO_API_URL}\n`);
console.log('⏳ Aguardando ativação das credenciais...\n');
console.log('💡 Pressione Ctrl+C para parar\n');
console.log('─'.repeat(60));

let testCount = 0;
let lastStatus = null;

async function testCielo() {
    testCount++;
    const now = new Date().toLocaleTimeString('pt-BR');

    console.log(`\n[${now}] 🧪 Teste #${testCount}`);

    const payload = {
        MerchantOrderId: `TEST-MONITOR-${Date.now()}`,
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
            SoftDescriptor: 'TestMonitor',
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
        const response = await fetch(CIELO_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'MerchantId': CIELO_MERCHANT_ID,
                'MerchantKey': CIELO_MERCHANT_KEY
            },
            body: JSON.stringify(payload)
        });

        console.log(`   📥 Status HTTP: ${response.status} ${response.statusText}`);

        const responseText = await response.text();

        if (responseText.trim() === '') {
            console.log('   ⚠️  Resposta vazia (0 bytes)');

            if (response.status === 401) {
                console.log('   ❌ CREDENCIAIS INVÁLIDAS');
                console.log('   💡 Aguardando propagação da chave...');
                lastStatus = 'invalid_credentials';
            } else {
                console.log(`   ⚠️  Status ${response.status} com resposta vazia`);
                lastStatus = 'empty_response';
            }
            return;
        }

        try {
            const data = JSON.parse(responseText);

            if (response.ok && data.Payment) {
                const status = data.Payment.Status;
                const returnCode = data.Payment.ReturnCode;
                const returnMessage = data.Payment.ReturnMessage;

                console.log(`   📊 Status: ${status}`);
                console.log(`   📊 Código: ${returnCode}`);
                console.log(`   📊 Mensagem: ${returnMessage}`);

                if (returnCode === '002') {
                    console.log('   ❌ AINDA COM CREDENCIAIS INVÁLIDAS');
                    console.log('   💡 A chave pode levar até 30 minutos para ativar');
                    lastStatus = 'credentials_002';
                } else {
                    console.log('\n   ✅ ✅ ✅ CREDENCIAIS FUNCIONANDO! ✅ ✅ ✅');
                    console.log(`\n   🎉 A API Cielo está respondendo corretamente!`);
                    console.log(`   📊 Código de retorno: ${returnCode}`);
                    console.log(`   📊 Mensagem: ${returnMessage}`);
                    console.log('\n   ✅ Você pode usar o sistema normalmente agora!\n');

                    // Para o monitor quando funcionar
                    process.exit(0);
                }
            } else if (Array.isArray(data)) {
                console.log('   ❌ Erros:');
                data.forEach(err => {
                    console.log(`      - ${err.Code}: ${err.Message}`);
                });
                lastStatus = 'api_errors';
            } else {
                console.log('   ⚠️  Resposta inesperada:', data);
                lastStatus = 'unexpected';
            }
        } catch (parseError) {
            console.log('   ⚠️  Resposta não é JSON');
            console.log(`   📄 Resposta bruta: ${responseText.substring(0, 200)}`);
            lastStatus = 'parse_error';
        }
    } catch (error) {
        console.log('   💥 Erro na requisição:', error.message);
        lastStatus = 'request_error';
    }
}

// Testa imediatamente
testCielo().then(() => {
    // Se não funcionou, continua testando a cada 30 segundos
    if (lastStatus !== 'success') {
        setInterval(testCielo, 30000); // 30 segundos
    }
});
