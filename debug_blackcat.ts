
const BLACKCAT_PUBLIC_KEY = 'pk_zjH0069PkZun7luIdDfKlu7Z6VkYud0DgM6HNerlfRk9RuZh';
const BLACKCAT_SECRET_KEY = 'sk_atvi-Vbu7A490IU8UbzdP-mSdHyVcMTlnRiO6bH7vZpbyTZy';
const BLACKCAT_API_URL = 'https://api.blackcatpagamentos.com/v1';

async function testPayment() {
    console.log('Testing Blackcat Payment...');

    const authHeader = `Basic ${btoa(`${BLACKCAT_PUBLIC_KEY}:${BLACKCAT_SECRET_KEY}`)}`;

    const payload = {
        amount: 100, // 1.00
        paymentMethod: "credit_card",
        installments: 1,
        card: {
            holder: "TEST USER",
            number: "4000000000000000", // Test card
            expirationMonth: "12",
            expirationYear: "30",
            securityCode: "123"
        },
        customer: {
            name: "Test User",
            email: "testuser@gmail.com",
            documentNumber: "12345678909", // Valid CPF format generator might be needed if they validate strict checksum
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
