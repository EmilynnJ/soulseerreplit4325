import Stripe from 'stripe';
import fs from 'fs';
import path from 'path';

// Initialize stripe lazily to avoid startup issues
let stripeInstance: Stripe | null = null;

// Function to read the Stripe Secret Key directly from .env if needed
function getStripeKeyFromFile(): string | null {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const stripeKeyMatch = envContent.match(/STRIPE_SECRET_KEY=([^\n]+)/);
      if (stripeKeyMatch && stripeKeyMatch[1]) {
        console.log('Found STRIPE_SECRET_KEY directly in .env file');
        return stripeKeyMatch[1].trim();
      }
    }
    return null;
  } catch (error) {
    console.error('Error reading .env file:', error);
    return null;
  }
}

// Get the key from environment or file
let STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

// If not found in process.env, try to read it directly from the file
if (!STRIPE_SECRET_KEY) {
  console.log('STRIPE_SECRET_KEY not found in process.env, trying to read from file...');
  STRIPE_SECRET_KEY = getStripeKeyFromFile();
}

// Output status for debugging but don't reveal key content
console.log(`Stripe key status: ${STRIPE_SECRET_KEY ? 'Available' : 'Missing'}`);
if (STRIPE_SECRET_KEY) {
  console.log(`Stripe key length: ${STRIPE_SECRET_KEY.length} characters`);
}

// Getter function to safely access the Stripe instance
function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY environment variable is missing. This is required for production.');
    }
    
    try {
      console.log('Initializing Stripe with provided key');
      stripeInstance = new Stripe(STRIPE_SECRET_KEY, {
        apiVersion: '2023-10-16' as any // Cast to any to bypass TypeScript version mismatch
      });
      console.log('Stripe initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Stripe:', error);
      throw new Error('Failed to initialize Stripe: ' + (error as Error).message);
    }
  }
  return stripeInstance;
}

// For consistency with existing code
const stripe = new Proxy({} as Stripe, {
  get: (target, prop) => {
    try {
      const instance = getStripe();
      return instance[prop as keyof Stripe];
    } catch (error) {
      console.error(`Error accessing Stripe.${String(prop)}:`, error);
      throw error;
    }
  }
});

// Export the stripe instance
export { stripe };

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
    console.log(`Creating payment intent with amount: ${amount} (should be in dollars)`);
    
    // Amount comes in as dollars, convert to cents for Stripe
    const amountInCents = Math.round(amount * 100);
    console.log(`Amount converted to cents: ${amountInCents}`);
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
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

export async function updatePaymentIntent(
  paymentIntentId: string,
  updateData: {
    amount?: number;
    metadata?: Record<string, string>;
  }
) {
  try {
    const { amount, metadata } = updateData;
    const updateParams: Stripe.PaymentIntentUpdateParams = {};

    if (amount !== undefined) {
      updateParams.amount = Math.round(amount * 100); // Convert to cents
    }

    if (metadata) {
      updateParams.metadata = metadata;
    }

    const paymentIntent = await stripe.paymentIntents.update(
      paymentIntentId,
      updateParams
    );

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
    };
  } catch (error: any) {
    console.error('Error updating payment intent:', error);
    throw new Error(`Failed to update payment intent: ${error.message}`);
  }
}

export async function capturePaymentIntent(paymentIntentId: string) {
  try {
    const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);
    return {
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100, // Convert from cents to dollars
      paymentIntentId: paymentIntent.id,
    };
  } catch (error: any) {
    console.error('Error capturing payment intent:', error);
    throw new Error(`Failed to capture payment intent: ${error.message}`);
  }
}

export async function createCustomer({
  email,
  name,
  metadata = {},
}: {
  email: string;
  name: string;
  metadata?: Record<string, string>;
}) {
  try {
    const customer = await stripe.customers.create({
      email,
      name,
      metadata,
    });
    return customer;
  } catch (error: any) {
    console.error('Error creating customer:', error);
    throw new Error(`Failed to create customer: ${error.message}`);
  }
}

export async function retrievePaymentIntent(paymentIntentId: string) {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return paymentIntent;
  } catch (error: any) {
    console.error('Error retrieving payment intent:', error);
    throw new Error(`Failed to retrieve payment intent: ${error.message}`);
  }
}

export async function createOnDemandReadingPayment(
  pricePerMinute: number, // in cents
  clientId: number, // ID of the client
  clientName: string, // Name of the client
  readerId: number, // ID of the reader
  readingId: number, // ID of the reading session
  readingType: string, // Type of reading (chat, phone, video)
) {
  try {
    // Calculate initial amount (10 minutes as a pre-authorization)
    const initialAmount = pricePerMinute * 10;
    
    // Create a Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: initialAmount,
      currency: 'usd',
      metadata: {
        readingId: readingId.toString(),
        clientId: clientId.toString(),
        readerId: readerId.toString(),
        readingType,
        pricePerMinute: pricePerMinute.toString(),
        purpose: 'reading_payment'
      },
      capture_method: 'manual', // Authorize only initially, capture exact amount later
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return {
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      paymentLinkUrl: `/reading-session/${readingId}?paymentIntentId=${paymentIntent.id}`,
      amount: initialAmount
    };
  } catch (error: any) {
    console.error('Error creating on-demand reading payment:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function fetchStripeProducts() {
  try {
    const products = await stripe.products.list({
      active: true,
      expand: ['data.default_price']
    });
    
    return products.data.map(product => {
      const price = product.default_price as Stripe.Price;
      return {
        stripeProductId: product.id,
        stripePriceId: price?.id,
        name: product.name,
        description: product.description || '',
        price: price?.unit_amount || 0, // in cents
        imageUrl: product.images?.[0] || 'https://placehold.co/600x400?text=No+Image',
        category: product.metadata?.category || 'other',
        stock: parseInt(product.metadata?.stock || '100'),
        featured: product.metadata?.featured === 'true'
      };
    });
  } catch (error: any) {
    console.error('Error fetching Stripe products:', error);
    throw new Error(`Failed to fetch Stripe products: ${error.message}`);
  }
}

export async function syncProductWithStripe(product: {
  id: number;
  name: string;
  description: string;
  price: number; // in cents
  imageUrl: string;
  category: string;
  stock: number;
  featured: boolean;
  stripeProductId?: string | null;
  stripePriceId?: string | null;
}) {
  try {
    let stripeProduct;
    let stripePrice;
    
    // If product exists in Stripe, update it
    if (product.stripeProductId) {
      stripeProduct = await stripe.products.update(
        product.stripeProductId,
        {
          name: product.name,
          description: product.description,
          images: [product.imageUrl],
          metadata: {
            category: product.category,
            stock: product.stock.toString(),
            featured: product.featured.toString()
          }
        }
      );
      
      // If price has changed, create a new price
      if (product.stripePriceId) {
        const existingPrice = await stripe.prices.retrieve(product.stripePriceId);
        if (existingPrice.unit_amount !== product.price) {
          // Create new price and update the product's default price
          stripePrice = await stripe.prices.create({
            product: product.stripeProductId,
            unit_amount: product.price,
            currency: 'usd',
          });
          
          // Update the product's default price
          await stripe.products.update(
            product.stripeProductId,
            {
              default_price: stripePrice.id
            }
          );
        } else {
          stripePrice = existingPrice;
        }
      } else {
        // Create a new price if none exists
        stripePrice = await stripe.prices.create({
          product: product.stripeProductId,
          unit_amount: product.price,
          currency: 'usd',
        });
        
        // Update the product's default price
        await stripe.products.update(
          product.stripeProductId,
          {
            default_price: stripePrice.id
          }
        );
      }
    } else {
      // Create a new product in Stripe
      stripeProduct = await stripe.products.create({
        name: product.name,
        description: product.description,
        images: [product.imageUrl],
        default_price_data: {
          unit_amount: product.price,
          currency: 'usd',
        },
        metadata: {
          category: product.category,
          stock: product.stock.toString(),
          featured: product.featured.toString()
        }
      });
      
      // Get the default price ID
      const price = stripeProduct.default_price as string;
      stripePrice = await stripe.prices.retrieve(price);
    }
    
    return {
      stripeProductId: stripeProduct.id,
      stripePriceId: stripePrice.id
    };
  } catch (error: any) {
    console.error('Error syncing product with Stripe:', error);
    throw new Error(`Failed to sync product with Stripe: ${error.message}`);
  }
}

export default {
  createPaymentIntent,
  updatePaymentIntent,
  capturePaymentIntent,
  createCustomer,
  retrievePaymentIntent,
  createOnDemandReadingPayment,
  fetchStripeProducts,
  syncProductWithStripe,
  // Export Stripe's native clients for direct access
  accounts: stripe.accounts,
  accountLinks: stripe.accountLinks,
  customers: stripe.customers,
  paymentIntents: stripe.paymentIntents,
  prices: stripe.prices,
  products: stripe.products
};