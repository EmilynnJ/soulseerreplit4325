// c:\Users\emily\soulseerreplit4325-1\frontend\src\services\walletService.js
import apiClient from './api';

export const fetchWalletBalance = async () => {
  try {
    const response = await apiClient.get('/wallet/balance');
    return response.data;
  } catch (error) {
    console.error("Error fetching wallet balance:", error);
    throw error;
  }
};

export const fetchWalletTransactions = async () => {
  try {
    const response = await apiClient.get('/wallet/transactions');
    return response.data;
  } catch (error) {
    console.error("Error fetching wallet transactions:", error);
    throw error;
  }
};

// Function to initiate credit purchase (will call backend to create Stripe session)
export const purchaseCredits = async (amount) => {
  // This will be implemented later when Stripe Checkout is set up
  console.log(`Placeholder: Initiating purchase of ${amount} credits.`);
  // const response = await apiClient.post('/stripe/create-checkout-session', { amount });
  // return response.data; // e.g., { sessionId: 'stripe_session_id' }
};
