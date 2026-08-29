// Teste Direto Cielo Sandbox com Chave Ativa
const CIELO_MERCHANT_ID = process.env.CIELO_MERCHANT_ID || '8937bd5b-9796-494d-9fe5-f76b3e4da633';
const CIELO_MERCHANT_KEY = process.env.CIELO_MERCHANT_KEY || 'XKGHUBSBKIRXKAVPSKWLVXYCLVJUGTNZLIHPUSYV';
const CIELO_API_URL = 'https://apisandbox.cieloecommerce.cielo.com.br/1/sales';

console.log('🧪 TESTANDO CREDENCIAIS CIELO SANDBOX ATIVAS');
console.log('=' .repeat(60));
console.log(`MerchantId  : ${CIELO_MERCHANT_ID}`);
console.log(`MerchantKey : ${CIELO_MERCHANT_KEY.substring(0, 15)}...`);
console.log(`Endpoint    : ${CIELO_API_URL}\n`);

const payload = {
    MerchantOrderId: `TEST-${Date.now()}`,
    Customer: {
        Name: 'TEST USER CIELO'
    },
    Payment: {
        Type: 'CreditCard',
        Amount: 100, // R$ 1,00
        Installments: 1,
        Capture: false,
        CreditCard: {
            CardNumber: '4532117080573700',
            Holder: 'TEST USER',
            ExpirationDate: '12/2026',
            SecurityCode: '123',
            Brand: 'Visa'
        }
    }
};

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
        const data = await response.json();

        if (response.ok && data.Payment) {
            console.log('\n✅ TRANSAÇÃO PROCESSADA COM SUCESSO!');
            console.log(`   PaymentId    : ${data.Payment.PaymentId}`);
            console.log(`   Status       : ${data.Payment.Status} (1 = Autorizado)`);
            console.log(`   ReturnCode   : ${data.Payment.ReturnCode}`);
            console.log(`   ReturnMessage: ${data.Payment.ReturnMessage}`);
        } else {
            console.log('\n❌ FALHA NA TRANSAÇÃO:');
            console.log(JSON.stringify(data, null, 2));
        }
    } catch (err) {
        console.error(`💥 Erro: ${err.message}`);
    }
})();
