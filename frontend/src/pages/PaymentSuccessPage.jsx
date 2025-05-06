// c:\Users\emily\soulseerreplit4325-1\frontend\src\pages\PaymentSuccessPage.jsx
import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';

const PaymentSuccessPage = () => {
  const location = useLocation();
  const { refreshWallet } = useWallet();

  useEffect(() => {
    // const sessionId = new URLSearchParams(location.search).get('session_id');
    // You could use sessionId to fetch transaction details from your backend if needed
    console.log("Payment successful!");
    refreshWallet(); // Refresh wallet balance after successful payment
  }, [location, refreshWallet]);

  return (
    <div>
      <h1 style={{ color: 'var(--color-accent-gold)' }}>Payment Successful!</h1>
      <p>Your credits have been added to your wallet.</p>
      <Link to="/dashboard/client" style={{ color: 'var(--color-primary-pink)' }}>Go to Dashboard</Link>
    </div>
  );
};

export default PaymentSuccessPage;