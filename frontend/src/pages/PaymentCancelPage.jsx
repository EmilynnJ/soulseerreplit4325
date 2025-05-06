// c:\Users\emily\soulseerreplit4325-1\frontend\src\pages\PaymentCancelPage.jsx
import React from 'react';
import { Link } from 'react-router-dom';

const PaymentCancelPage = () => {
  return (
    <div>
      <h1 style={{ color: 'var(--color-primary-deep-pink)' }}>Payment Cancelled</h1>
      <p>Your payment was not processed. You can try again or contact support if you have issues.</p>
      <Link to="/purchase-credits" style={{ color: 'var(--color-accent-gold)' }}>Try Again</Link>
      <br />
      <Link to="/dashboard/client" style={{ color: 'var(--color-primary-pink)' }}>Go to Dashboard</Link>
    </div>
  );
};

export default PaymentCancelPage;