// Script para testar se a chave da API Cielo está ativa
// Usa um cartão de teste válido da Cielo

const CIELO_MERCHANT_ID = 'c8bb2f93-34b2-4bc8-a382-be44300aa20e';
const CIELO_MERCHANT_KEY = 'QwjkObfkerFPwgsnHDhc2v5atcCWU4QdUuZGoSWE';
const CIELO_API_URL = 'https://api.cieloecommerce.cielo.com.br/1/sales';

console.log('🔍 Testando chave de API da Cielo...\n');
console.log('📋 Credenciais:');
console.log(`   MerchantId: ${CIELO_MERCHANT_ID}`);
console.log(`   MerchantKey: ${CIELO_MERCHANT_KEY.substring(0, 10)}...`);
console.log(`   Endpoint: ${CIELO_API_URL}\n`);

// Cartão de teste VÁLIDO da Cielo para PRODUÇÃO
const testCard = {
    number: '4532117080573700', // Visa de teste (retorna aprovado)
    month: '12',
    year: '2025',
    cvv: '123', // CVV com 3 dígitos
    holder: 'TESTE HOLDER',
    cpf: '12345678909'
};

console.log('💳 Cartão de teste:');
console.log(`   Número: ${testCard.number}`);
console.log(`   Validade: ${testCard.month}/${testCard.year}`);
console.log(`   CVV: ${testCard.cvv} (${testCard.cvv.length} dígitos)`);
console.log(`   Titular: ${testCard.holder}\n`);

const payload = {
    MerchantOrderId: `API-TEST-${Date.now()}`,
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
        SoftDescriptor: 'ApiTest',
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

// Função async principal
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
        console.log('📥 Resposta da Cielo:');
        console.log(JSON.stringify(data, null, 2));
        console.log('\n' + '='.repeat(60) + '\n');

        if (response.status === 401) {
            console.log('❌ CHAVE NÃO ESTÁ ATIVA');
            console.log('   Status: 401 Unauthorized');
            console.log('   A chave de API ainda não foi ativada pela Cielo.');
            console.log('   Aguarde a propagação ou verifique as credenciais.\n');
        } else if (response.ok && data.Payment) {
            console.log('✅ CHAVE ESTÁ ATIVA!');
            console.log(`   Status do pagamento: ${data.Payment.Status}`);
            console.log(`   Código de retorno: ${data.Payment.ReturnCode || 'N/A'}`);
            console.log(`   Mensagem: ${data.Payment.ReturnMessage || 'N/A'}`);

            // Verificar se há erro 146
            if (data[0]?.Code === '146') {
                console.log('\n⚠️  ERRO 146 DETECTADO!');
                console.log('   SecurityCode length exceeded');
                console.log('   O CVV está sendo enviado com formato incorreto.\n');
            }
        } else if (Array.isArray(data) && data.length > 0) {
            console.log('⚠️  ERRO NA REQUISIÇÃO');
            data.forEach(error => {
                console.log(`   Código: ${error.Code}`);
                console.log(`   Mensagem: ${error.Message}`);

                if (error.Code === '146') {
                    console.log('\n🔍 PROBLEMA IDENTIFICADO:');
                    console.log('   O erro 146 indica que o SecurityCode (CVV) está');
                    console.log('   sendo enviado com mais de 4 dígitos ou formato incorreto.');
                    console.log(`   CVV enviado: "${testCard.cvv}" (${testCard.cvv.length} dígitos)`);
                    console.log('\n💡 SOLUÇÃO:');
                    console.log('   Verificar se o CVV não está sendo concatenado ou');
                    console.log('   se há espaços/caracteres especiais não removidos.\n');
                }
            });
        }
    } catch (error) {
        console.error('💥 Erro ao conectar com a API:');
        console.error(error.message);
    }
})();
