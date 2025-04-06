import { useEffect, useState } from 'react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useCart } from '@/hooks/use-cart';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { CelestialButton } from '@/components/ui/celestial-button';
import { Loader2, CheckCircle, ShoppingBag } from 'lucide-react';
import { useLocation } from 'wouter';

// Make sure to call loadStripe outside of a component's render to avoid
// recreating the Stripe object on every render
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { clearCart } = useCart();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      // Stripe.js hasn't yet loaded.
      return;
    }

    setProcessing(true);

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin + '/checkout/success',
      },
      redirect: 'if_required',
    });

    if (result.error) {
      // Show error to your customer
      toast({
        title: 'Payment failed',
        description: result.error.message || 'An error occurred during payment',
        variant: 'destructive',
      });
      setProcessing(false);
    } else if (result.paymentIntent && result.paymentIntent.status === 'succeeded') {
      // Payment successful
      toast({
        title: 'Payment successful',
        description: 'Your order has been placed!',
      });
      clearCart();
      setLocation('/checkout/success');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <CelestialButton 
        disabled={!stripe || processing} 
        type="submit" 
        className="w-full"
      >
        {processing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            Complete payment
          </>
        )}
      </CelestialButton>
    </form>
  );
}

function CheckoutSuccess() {
  return (
    <div className="text-center py-16 px-4">
      <div className="mb-6 flex justify-center">
        <CheckCircle className="h-16 w-16 text-green-500" />
      </div>
      <h1 className="text-3xl font-cinzel text-accent mb-4">Payment Successful!</h1>
      <p className="text-light/80 font-playfair mb-8 max-w-md mx-auto">
        Thank you for your purchase. Your mystical items will be on their way to you soon.
      </p>
      <CelestialButton onClick={() => window.location.href = '/'}>
        Return to Home
      </CelestialButton>
    </div>
  );
}

export default function CheckoutPage() {
  const [clientSecret, setClientSecret] = useState('');
  const { items, totalAmount } = useCart();
  const [location] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    // Check if the cart is empty
    if (items.length === 0) {
      toast({
        title: 'Empty cart',
        description: 'Your cart is empty. Add some items before checkout.',
        variant: 'destructive',
      });
      window.location.href = '/shop';
      return;
    }

    // Create PaymentIntent as soon as the page loads
    async function createPaymentIntent() {
      try {
        const response = await apiRequest('POST', '/api/create-payment-intent', { 
          amount: totalAmount / 100 // Convert from cents to dollars for the API
        });
        
        const data = await response.json();
        
        if (response.ok && data.clientSecret) {
          setClientSecret(data.clientSecret);
        } else {
          throw new Error(data.message || 'Failed to initialize payment');
        }
      } catch (error) {
        console.error('Error creating payment intent:', error);
        toast({
          title: 'Payment initialization failed',
          description: 'Could not initialize payment. Please try again later.',
          variant: 'destructive',
        });
      }
    }

    createPaymentIntent();
  }, [items, totalAmount, toast]);

  // If showing the success page
  if (location === '/checkout/success') {
    return <CheckoutSuccess />;
  }

  return (
    <div className="container mx-auto py-12 px-4 max-w-3xl">
      <h1 className="text-4xl font-alex-brush text-accent text-center mb-8">Complete Your Purchase</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
        {/* Order summary */}
        <div className="md:col-span-2 bg-primary-dark/40 p-6 rounded-lg border border-accent/20">
          <h2 className="text-xl font-cinzel text-accent mb-4 flex items-center">
            <ShoppingBag className="mr-2 h-5 w-5" />
            Order Summary
          </h2>
          
          <div className="space-y-4 max-h-64 overflow-y-auto mb-4">
            {items.map(item => (
              <div key={item.product.id} className="flex gap-3 border-b border-accent/10 pb-3">
                <div className="w-16 h-16 rounded-md overflow-hidden flex-shrink-0">
                  <img 
                    src={item.product.imageUrl} 
                    alt={item.product.name} 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="font-cinzel text-light/90 text-sm">{item.product.name}</h3>
                  <div className="flex justify-between text-xs text-light/70">
                    <span>x{item.quantity}</span>
                    <span>${(item.product.price * item.quantity / 100).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="border-t border-accent/30 pt-4 space-y-2">
            <div className="flex justify-between text-light/70">
              <span>Subtotal</span>
              <span>${(totalAmount / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-light/70">
              <span>Shipping</span>
              <span>Free</span>
            </div>
            <div className="flex justify-between font-cinzel text-light pt-2 border-t border-accent/10">
              <span>Total</span>
              <span>${(totalAmount / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>
        
        {/* Payment form */}
        <div className="md:col-span-3 bg-primary-dark/40 p-6 rounded-lg border border-accent/20">
          <h2 className="text-xl font-cinzel text-accent mb-6">Payment Details</h2>
          
          {!clientSecret ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-accent mb-4" />
              <p className="text-light/70">Initializing payment...</p>
            </div>
          ) : (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <CheckoutForm />
            </Elements>
          )}
        </div>
      </div>
    </div>
  );
}