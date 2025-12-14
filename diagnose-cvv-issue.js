// Script para diagnosticar o erro 146 - SecurityCode length exceeded
// Teste com diferentes formatos de CVV

const CIELO_MERCHANT_ID = 'c8bb2f93-34b2-4bc8-a382-be44300aa20e';
const CIELO_MERCHANT_KEY = 'QwjkObfkerFPwgsnHDhc2v5atcCWU4QdUuZGoSWE';
const CIELO_API_URL = 'https://api.cieloecommerce.cielo.com.br/1/sales';

console.log('🔬 DIAGNÓSTICO DO ERRO 146\n');
console.log('═'.repeat(60) + '\n');

// Diferentes formatos de CVV para testar
const testCases = [
    { cvv: '123', description: 'CVV normal (3 dígitos)' },
    { cvv: ' 123 ', description: 'CVV com espaços' },
    { cvv: '123\n', description: 'CVV com quebra de linha' },
    { cvv: '123\r\n', description: 'CVV com CRLF' },
];

async function testCVVFormat(cvvInput, description) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📝 Teste: ${description}`);
    console.log(`   CVV input: "${cvvInput}"`);
    console.log(`   Comprimento original: ${cvvInput.length} caracteres`);
    console.log(`   Bytes: ${Buffer.from(cvvInput).toString('hex')}`);

    // Limpar CVV (remover não-dígitos)
    const cleanCvv = cvvInput.replace(/\D/g, '');
    console.log(`   CVV limpo: "${cleanCvv}"`);
    console.log(`   Comprimento limpo: ${cleanCvv.length} caracteres`);
    console.log(`   Bytes limpo: ${Buffer.from(cleanCvv).toString('hex')}`);

    const testCard = {
        number: '4532117080573700',
        month: '12',
        year: '2025',
        cvv: cleanCvv,
        holder: 'TESTE HOLDER',
        cpf: '12345678909'
    };

    const payload = {
        MerchantOrderId: `CVV-TEST-${Date.now()}`,
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
            SoftDescriptor: 'CvvTest',
            CreditCard: {
                CardNumber: testCard.number,
                Holder: testCard.holder,
                ExpirationDate: `${testCard.month}/${testCard.year}`,
                SecurityCode: testCard.cvv,
                Brand: 'Visa'
            }
        }
    };

    console.log(`\n   📤 SecurityCode enviado: "${payload.Payment.CreditCard.SecurityCode}"`);
    console.log(`   📤 ExpirationDate: "${payload.Payment.CreditCard.ExpirationDate}"`);

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

        if (Array.isArray(data) && data.length > 0) {
            const hasError146 = data.some(err => err.Code === '146');
            if (hasError146) {
                console.log(`\n   ❌ ERRO 146 CONFIRMADO!`);
                data.forEach(err => {
                    console.log(`      Código: ${err.Code} - ${err.Message}`);
                });
            } else {
                console.log(`\n   ⚠️  Outro erro:`);
                data.forEach(err => {
                    console.log(`      Código: ${err.Code} - ${err.Message}`);
                });
            }
        } else if (data.Payment) {
            console.log(`\n   ✅ Requisição OK`);
            console.log(`      Status: ${data.Payment.Status}`);
            console.log(`      Return Code: ${data.Payment.ReturnCode}`);
            console.log(`      Message: ${data.Payment.ReturnMessage}`);
        }

    } catch (error) {
        console.log(`\n   💥 Erro: ${error.message}`);
    }
}

// Executar testes
(async () => {
    for (const testCase of testCases) {
        await testCVVFormat(testCase.cvv, testCase.description);
        // Pequeno delay entre requests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log('\n🎯 CONCLUSÃO:\n');
    console.log('Se todos os testes passaram, o problema pode ser:');
    console.log('1. Credenciais Cielo incorretas ou não ativadas');
    console.log('2. CVV sendo enviado de forma diferente no frontend');
    console.log('3. Problema na integração entre frontend e Edge Function\n');
    console.log('💡 PRÓXIMOS PASSOS:');
    console.log('1. Verificar as credenciais Cielo no painel Supabase');
    console.log('2. Testar com um cartão real através do frontend');
    console.log('3. Verificar os logs da Edge Function no Supabase\n');
})();
