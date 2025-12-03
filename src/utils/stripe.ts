export interface CardData {
    number: string;
    month: string;
    year: string;
    cvv: string;
    holder?: string;
}

// Chave Pública fornecida pelo usuário
const STRIPE_PK = 'pk_live_51SaLoP1wr2WiT2cybDdyFRgbK8w2Fei0E9Qu0Ro1t4EqQBWdYKOcmRZdqxwQiyOhL0PR5yj8COJWCQzsGDCHeHPv00nEcxJI6B';

declare global {
    interface Window {
        Stripe: any;
    }
}

let stripeInitialized = false;

function initStripe() {
    if (stripeInitialized) return;
    if (window.Stripe) {
        window.Stripe.setPublishableKey(STRIPE_PK);
        stripeInitialized = true;
    }
}

export async function createStripeToken(card: CardData): Promise<{ id?: string; error?: any }> {
    return new Promise((resolve) => {
        if (!window.Stripe) {
            resolve({ error: { message: 'Stripe.js V2 não carregado' } });
            return;
        }

        initStripe();

        const cardData = {
            number: card.number,
            cvc: card.cvv,
            exp_month: card.month,
            exp_year: card.year,
            name: card.holder
        };

        window.Stripe.card.createToken(cardData, (status: number, response: any) => {
            if (response.error) {
                resolve({ error: response.error });
            } else {
                resolve({ id: response.id });
            }
        });
    });
}
