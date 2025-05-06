// c:\Users\emily\soulseerreplit4325-1\frontend\src\pages\PurchaseCreditsPage.jsx
import React from 'react';
import { Link } from 'react-router-dom';

const PurchaseCreditsPage = () => {
  // This page will later integrate with Stripe
  return (
    <div>
      <h1 style={{ color: 'var(--color-primary-pink)' }}>Purchase Credits</h1>
      <p>Select an amount to add to your wallet.</p>
      {/* Placeholder for credit packages and Stripe Checkout button */}
      <button onClick={() => alert("Stripe Checkout to be implemented!")}>Purchase $10 Credits</button>
      <br />
      <Link to="/dashboard/client">Back to Dashboard</Link>
    </div>
  );
};

export default PurchaseCreditsPage;