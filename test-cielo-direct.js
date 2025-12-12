// Script de teste direto da API Cielo
// Para rodar: node test-cielo-direct.js

const CIELO_MERCHANT_ID = 'c8bb2f93-34b2-4bc8-a382-be44300aa20e';
const CIELO_MERCHANT_KEY = 'QwjkObfkerFPwgsnHDhc2v5atcCWU4QdUuZGoSWE';
const CIELO_API_URL = 'https://apisandbox.cieloecommerce.cielo.com.br/1/sales';

// Cartão de teste da Cielo (válido para sandbox)
const testCard = {
    number: '4532117080573700', // Visa de teste
    month: '12',
    year: '2025',
    cvv: '123',
    holder: 'TESTE HOLDER',
    cpf: '12345678909'
};

console.log('🧪 Testando API Cielo diretamente...\n');
console.log('📋 Dados do cartão de teste:');
console.log(`   Número: ${testCard.number}`);
console.log(`   Validade: ${testCard.month}/${testCard.year}`);
console.log(`   CVV: ${testCard.cvv} (length: ${testCard.cvv.length})`);
console.log(`   Titular: ${testCard.holder}`);
console.log(`   CPF: ${testCard.cpf}\n`);

const payload = {
    MerchantOrderId: `TEST-DIRECT-${Date.now()}`,
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
        SoftDescriptor: 'TestDireto',
        CreditCard: {
            CardNumber: testCard.number,
            Holder: testCard.holder,
            ExpirationDate: `${testCard.month}/${testCard.year}`,
            SecurityCode: testCard.cvv,
            Brand: 'Visa'
        }
    }
};

console.log('📤 Payload enviado para Cielo:');
console.log(JSON.stringify(payload, null, 2));
console.log('\n🔄 Enviando requisição...\n');

async function testCielo() {
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

        console.log(`📥 Status da resposta: ${response.status}`);
        console.log(`📥 Status text: ${response.statusText}`);
        console.log(`📥 Headers:`, Object.fromEntries(response.headers.entries()));

        const responseText = await response.text();
        console.log(`\n📥 Resposta bruta (${responseText.length} bytes):`);
        console.log(responseText);

        if (responseText.trim() === '') {
            console.log('\n⚠️ A resposta está vazia! Isso pode indicar um problema de autenticação ou configuração.');
            return;
        }

        try {
            const data = JSON.parse(responseText);
            console.log('\n📥 Resposta parseada como JSON:');
            console.log(JSON.stringify(data, null, 2));

            if (response.ok && data.Payment) {
                console.log('\n✅ SUCESSO!');
                console.log(`   Status do pagamento: ${data.Payment.Status}`);
                console.log(`   Mensagem: ${data.Payment.ReturnMessage || 'N/A'}`);
                console.log(`   Código de retorno: ${data.Payment.ReturnCode || 'N/A'}`);
            } else {
                console.log('\n❌ ERRO na resposta');
                if (data[0]?.Message) {
                    console.log(`   Mensagem: ${data[0].Message}`);
                }
                if (Array.isArray(data)) {
                    console.log('\n   Erros:');
                    data.forEach(err => {
                        console.log(`   - ${err.Code}: ${err.Message}`);
                    });
                }
            }
        } catch (parseError) {
            console.log('\n⚠️ Resposta não é JSON válido');
            console.log('Erro de parse:', parseError.message);
        }
    } catch (error) {
        console.error('\n💥 Erro ao fazer requisição:');
        console.error(error);
    }
}

testCielo();
