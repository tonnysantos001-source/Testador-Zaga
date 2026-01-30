import fetch from 'node-fetch';

const API_KEY = '796bfaba-f847-4452-b579-0488d1a7ca5b'; // Chave fornecida
const API_URL = 'https://api.zentripay.com.br/v2/account/balance';

async function testZentripayKey() {
    console.log('🔄 Testando conexão com Zentripay...');
    console.log(`🔑 Chave: ${API_KEY.substring(0, 8)}...`);

    try {
        const response = await fetch(API_URL, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        console.log(`📡 Status da Resposta: ${response.status}`);

        const data = await response.json();
        console.log('📄 Resposta:', JSON.stringify(data, null, 2));

        if (response.ok) {
            console.log('✅ CONEXÃO BEM SUCEDIDA! A chave é válida.');
        } else {
            console.log('❌ FALHA NA CONEXÃO. Verifique a chave ou permissões.');
            if (response.status === 401 || response.status === 403) {
                console.log('⚠️ Erro de Autenticação/Permissão.');
            }
        }
    } catch (error) {
        console.error('💥 Erro ao executar requisição:', error.message);
    }
}

testZentripayKey();
