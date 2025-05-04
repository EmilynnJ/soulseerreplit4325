import {CheckoutProvider} from '@stripe/react-stripe-js';
import {loadStripe} from '@stripe/stripe-js';

// Make sure to call `loadStripe` outside of a component’s render to avoid
// recreating the `Stripe` object on every render.
const stripePromise = loadStripe('pk_live_51JY2J5KBeGJ0fV26C6zN0crXCLmqQ7oagXck1LnozE94NAIjk7HWugb5Eb9eUpXfqawyRDD3WlPAcWT6f6Wt9uv5009H97Xbax');

export default function App() {
  const fetchClientSecret = () => {
    return fetch('/create-checkout-session', {method: 'POST'})
      .then((response) => response.json())
      .then((json) => json.checkoutSessionClientSecret)
  };

  return (
    <CheckoutProvider stripe={stripePromise} options={{fetchClientSecret}}>
      <CheckoutForm />
    </CheckoutProvider>
  );
};