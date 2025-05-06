// c:\Users\emily\soulseerreplit4325-1\frontend\src\services\stripeService.js
import apiClient from './api';
import { loadStripe } from '@stripe/stripe-js';

const VITE_STRIPE_PUBLIC_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
let stripePromise;

export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(VITE_STRIPE_PUBLIC_KEY);
  }
  return stripePromise;
};

export const createStripeCheckoutSession = async (item) => {
  // item could be { amount: 500, currency: 'usd', quantity: 1, name: '$5 Credits' }
  // amount is in cents
  try {
    const response = await apiClient.post('/stripe/create-checkout-session', item);
    return response.data; // Expects { sessionId: '...' }
  } catch (error) {
    console.error("Error creating Stripe checkout session:", error.response?.data || error.message);
    throw error.response?.data || error;
  }
};