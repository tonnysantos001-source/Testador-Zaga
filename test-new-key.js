// Teste com a NOVA chave de produção
const CIELO_MERCHANT_ID = 'c8bb2f93-34b2-4bc8-a382-be44300aa20e';
const CIELO_MERCHANT_KEY = '44Zz43Y4YI2xcj7zbZEdPO77ScT7i9AiGfBKWW8F'; // Nova chave
const CIELO_API_URL = 'https://api.cieloecommerce.cielo.com.br/1/sales';

console.log('🔑 Testando com NOVA CHAVE DE PRODUÇÃO\n');
console.log('═'.repeat(60) + '\n');
console.log('📋 Credenciais:');
console.log(`   MerchantId: ${CIELO_MERCHANT_ID}`);
console.log(`   MerchantKey: ${CIELO_MERCHANT_KEY.substring(0, 15)}...`);
console.log(`   Endpoint: ${CIELO_API_URL}\n`);

const testCard = {
    number: '4532117080573700',
    month: '12',
    year: '2025',
    cvv: '123',
    holder: 'TESTE HOLDER',
    cpf: '12345678909'
};

const payload = {
    MerchantOrderId: `NEW-KEY-TEST-${Date.now()}`,
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
        SoftDescriptor: 'NewKeyTest',
        CreditCard: {
            CardNumber: testCard.number,
            Holder: testCard.holder,
            ExpirationDate: `${testCard.month}/${testCard.year}`,
            SecurityCode: testCard.cvv,
            Brand: 'Visa'
        }
    }
};

console.log('📤 Enviando requisição...\n');

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

        const data = await response.json();

        console.log(`📥 Status HTTP: ${response.status}\n`);
        console.log('═'.repeat(60));

        if (response.ok && data.Payment) {
            const status = data.Payment.Status;
            const returnCode = data.Payment.ReturnCode;
            const returnMessage = data.Payment.ReturnMessage;

            console.log('\n✅ RESPOSTA DA CIELO:\n');
            console.log(`   Status do Pagamento: ${status}`);
            console.log(`   Código de Retorno: ${returnCode}`);
            console.log(`   Mensagem: ${returnMessage}\n`);

            if (returnCode === '002') {
                console.log('❌ RESULTADO: Credenciais ainda inválidas');
                console.log('   Esta chave também não está ativa/autorizada.\n');
            } else if (status === 1 || status === 2) {
                console.log('🎉 SUCESSO! Chave está ATIVA e FUNCIONANDO!');
                console.log('   A transação foi autorizada pela Cielo.\n');
            } else if (status === 3) {
                console.log('⚠️  Transação negada, mas a chave está ATIVA!');
                console.log(`   Motivo da negação: ${returnMessage}\n`);
            } else {
                console.log(`ℹ️  Status ${status}: ${returnMessage}\n`);
            }

            console.log('📊 Resposta completa:');
            console.log(JSON.stringify(data, null, 2));
        } else if (Array.isArray(data)) {
            console.log('\n❌ ERRO:\n');
            data.forEach(err => {
                console.log(`   Código: ${err.Code}`);
                console.log(`   Mensagem: ${err.Message}\n`);
            });
        }

        console.log('\n' + '═'.repeat(60));

    } catch (error) {
        console.error('💥 Erro:', error.message);
    }
})();
