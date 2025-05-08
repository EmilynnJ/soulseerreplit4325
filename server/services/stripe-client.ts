import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: '2025-02-24.acacia'
});

export interface CreatePaymentIntentParams {
  amount: number;
  currency?: string;
  customerId?: string;
  metadata?: Record<string, string>;
}

export async function createPaymentIntent({
  amount,
  currency = 'usd',
  customerId,
  metadata = {},
}: CreatePaymentIntentParams) {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      ...(customerId ? { customer: customerId } : {}),
      metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    };
  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    throw new Error(`Failed to create payment intent: ${error.message}`);
  }
}

export default stripe;