export interface CardData {
    number: string;
    month: string;
    year: string;
    cvv: string;
    holder?: string;
}

// Chave Pública fornecida pelo usuário
const STRIPE_PK = 'pk_live_51SaLoP1wr2WiT2cybDdyFRgbK8w2Fei0E9Qu0Ro1t4EqQBWdYKOcmRZdqxwQiyOhL0PR5yj8COJWCQzsGDCHeHPv00nEcxJI6B';

export async function createStripeToken(card: CardData): Promise<{ id?: string; error?: any }> {
    try {
        const body = new URLSearchParams();
        body.append('card[number]', card.number);
        body.append('card[exp_month]', card.month);
        body.append('card[exp_year]', card.year);
        body.append('card[cvc]', card.cvv);
        if (card.holder) {
            body.append('card[name]', card.holder);
        }

        const response = await fetch('https://api.stripe.com/v1/tokens', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${STRIPE_PK}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: body
        });

        const data = await response.json();

        if (data.error) {
            return { error: data.error };
        }

        return { id: data.id };
    } catch (error) {
        return { error: { message: 'Falha na conexão com Stripe API' } };
    }
}
