import fs from 'fs';

// CONFIGURAÇÃO
const API_KEY = '796bfaba-f847-4452-b579-0488d1a7ca5b'; // SUA CHAVE AQUI
const API_URL = 'https://api.zentripay.com.br';

function generateCPF() {
    const randomDigit = () => Math.floor(Math.random() * 10);
    const cpf = Array.from({ length: 9 }, randomDigit);
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += cpf[i] * (10 - i);
    let remainder = sum % 11;
    const digit1 = remainder < 2 ? 0 : 11 - remainder;
    cpf.push(digit1);
    sum = 0;
    for (let i = 0; i < 10; i++) sum += cpf[i] * (11 - i);
    remainder = sum % 11;
    const digit2 = remainder < 2 ? 0 : 11 - remainder;
    cpf.push(digit2);
    return cpf.join('');
}

async function testTransaction() {
    console.log('🔄 Iniciando simulação de transação Zentripay...');
    console.log(`🔑 Usando API Key: ${API_KEY.substring(0, 8)}...`);

    const customerData = {
        name: "Teste Debug Manual",
        email: "teste.debug@gmail.com",
        phone: "11999999999",
        document: generateCPF(),
        address: {
            street: 'Rua das Flores',
            number: '123',
            neighborhood: 'Centro',
            city: 'São Paulo',
            state: 'SP',
            postalCode: '01001000',
            country: 'BR',
            complement: 'Apto 101'
        }
    };

    const payload = {
        amount: 1.05,
        provider: "v2",
        method: "credit_card",
        installments: 1,
        customer: customerData,
        utm: {
            source: "debug_script",
            medium: "api",
            campaign: "test_local"
        },
        productName: "Teste Debug Local",
        postBackUrl: "https://example.com/webhook",
        card: {
            number: "4012001037141112", // Cartão de teste Visa
            holderName: "TESTE DEBUG",
            expirationMonth: "12",
            expirationYear: "28",
            cvv: "123"
        }
    };

    console.log('📤 Enviando payload...');

    try {
        const response = await fetch(`${API_URL}/v2/transactions/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify(payload)
        });

        let data;
        const text = await response.text();
        try {
            data = JSON.parse(text);
        } catch (e) {
            data = text;
        }

        const output = {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            body: data
        };

        console.log('--- RESPOSTA ---');
        console.log(`Status HTTP: ${response.status}`);
        console.log('Body:', JSON.stringify(data, null, 2));

        // Salvar em arquivo para garantia
        fs.writeFileSync('debug-result.json', JSON.stringify(output, null, 2));
        console.log('✅ Resultado salvo em debug-result.json');

    } catch (error) {
        console.error('💥 Erro de rede/execução:', error.message);
        fs.writeFileSync('debug-error.txt', error.message);
    }
}

testTransaction();
