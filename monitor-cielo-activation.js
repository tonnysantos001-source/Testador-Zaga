// Monitor de Ativação da Chave Cielo
// Execute este script periodicamente para verificar quando a chave for ativada

const CIELO_MERCHANT_ID = 'c8bb2f93-34b2-4bc8-a382-be44300aa20e';
const CIELO_MERCHANT_KEY = 'lSpilX520QWIdAy3t2zac7EJcXKeYTju2PLgrMZj';
const CIELO_API_URL = 'https://api.cieloecommerce.cielo.com.br/1/sales';

// Cartão de teste que deve retornar aprovado quando a chave estiver ativa
const testCard = {
    number: '4532117080573700',
    month: '12',
    year: '2025',
    cvv: '123',
    holder: 'TESTE HOLDER',
    cpf: '12345678909'
};

async function checkCieloStatus() {
    const now = new Date();
    const timestamp = now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    console.log('\n' + '═'.repeat(70));
    console.log(`⏰ Verificação em: ${timestamp}`);
    console.log('═'.repeat(70) + '\n');

    const payload = {
        MerchantOrderId: `MONITOR-${Date.now()}`,
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
            SoftDescriptor: 'Monitor',
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

        const data = await response.json();

        if (response.ok && data.Payment) {
            const status = data.Payment.Status;
            const returnCode = data.Payment.ReturnCode;
            const returnMessage = data.Payment.ReturnMessage;

            console.log(`📊 Status HTTP: ${response.status}`);
            console.log(`📊 Status Pagamento: ${status}`);
            console.log(`📊 ReturnCode: ${returnCode}`);
            console.log(`📊 Mensagem: ${returnMessage}\n`);

            if (returnCode === '002') {
                console.log('❌ AINDA NÃO ATIVA');
                console.log('   Erro 002: Credenciais ainda não autorizadas.');
                console.log('   Continue monitorando...\n');
                return false;
            } else if (status === 1 || status === 2) {
                console.log('🎉🎉🎉 CHAVE ATIVADA COM SUCESSO! 🎉🎉🎉');
                console.log('   ✅ A transação foi AUTORIZADA!');
                console.log('   ✅ O sistema está pronto para uso!\n');
                console.log('💡 PRÓXIMOS PASSOS:');
                console.log('   1. Fazer deploy da Edge Function atualizada');
                console.log('   2. Configurar as variáveis de ambiente no Supabase');
                console.log('   3. Testar com cartões reais\n');
                return true;
            } else if (status === 3) {
                console.log('⚠️  CHAVE ATIVA (transação negada)');
                console.log('   ✅ A chave está funcionando!');
                console.log(`   ℹ️  Negada: ${returnMessage}`);
                console.log('   Isso pode ser normal para cartões de teste.\n');
                return true;
            } else {
                console.log(`ℹ️  Status ${status}: ${returnMessage}\n`);
                return false;
            }
        }

    } catch (error) {
        console.log(`❌ Erro na verificação: ${error.message}\n`);
        return false;
    }
}

// Executar verificação única
(async () => {
    console.log('\n🔍 MONITOR DE ATIVAÇÃO - CHAVE CIELO');
    console.log('📋 MerchantId: ' + CIELO_MERCHANT_ID);
    console.log('📋 MerchantKey: ' + CIELO_MERCHANT_KEY.substring(0, 20) + '...\n');

    const isActive = await checkCieloStatus();

    if (isActive) {
        console.log('✅ Monitoramento concluído - chave está ativa!');
        process.exit(0);
    } else {
        console.log('⏳ Chave ainda não está ativa.');
        console.log('💡 Execute este script novamente em alguns minutos.\n');
        console.log('Comandos sugeridos:');
        console.log('   node monitor-cielo-activation.js        (verificar uma vez)');
        console.log('\nOu aguarde 15-30 minutos e teste novamente.\n');
        process.exit(1);
    }
})();
