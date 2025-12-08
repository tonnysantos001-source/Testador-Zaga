
const BLACKCAT_PUBLIC_KEY = 'pk_eSrGQ8gm5ZFtewLt9uXOLV5ceauzPrApaxRT3h9Pkz5zV8rt';
const BLACKCAT_SECRET_KEY = 'sk_5eLwUvhPkpQryeuH-YPpEyAy_-UMNGRJRvXctsaLkot0iA6L';
const BLACKCAT_API_URL = 'https://api.blackcatpagamentos.com/v1';

async function testPayment() {
    console.log('Testing Blackcat Payment with USER DATA...');

    const authHeader = `Basic ${btoa(`${BLACKCAT_PUBLIC_KEY}:${BLACKCAT_SECRET_KEY}`)}`;

    // Data transcribed from user image: 4984233019486272, 6, 2030, 202, Esther S Freitas
    const payload = {
        amount: 100,
        paymentMethod: "credit_card",
        installments: 1,
        card: {
            holderName: "ESTHER S FREITAS", // Corrected key
            number: "4984233019486272",
            expirationMonth: 6,
            expirationYear: 30,
            cvv: "202" // Corrected key
        },
        customer: {
            name: "Esther S Freitas",
            email: "esther.freitas@gmail.com",
            documentNumber: "49742331091", // Random valid CPF generator logic might be needed if they validate checksum
            phoneNumber: "11999999999",
            address: {
                street: "Rua Teste",
                number: "123",
                neighborhood: "Centro",
                city: "Sao Paulo",
                state: "SP",
                zipCode: "01001000"
            }
        },
        items: [
            {
                title: "Produto Teste",
                unitPrice: 100,
                quantity: 1,
                tangible: false
            }
        ],
        description: "Pagamento de teste"
    };

    console.log('Payload:', JSON.stringify(payload, null, 2));

    try {
        const response = await fetch(`${BLACKCAT_API_URL}/transactions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log(`Response [${response.status}]:`, JSON.stringify(data, null, 2));

    } catch (error) {
        console.error('Error:', error);
    }
}

testPayment();
