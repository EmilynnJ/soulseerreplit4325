import React from 'react';

const BillingDisplay = ({ totalCost, timeElapsed, ratePerMinute }) => {
  return (
    <div className="billing-display">
      <h3>Session Billing</h3>
      
      <div className="billing-info">
        <div className="billing-item">
          <span className="label">Time Elapsed:</span>
          <span className="value">{timeElapsed}</span>
        </div>
        
        <div className="billing-item">
          <span className="label">Rate:</span>
          <span className="value">${ratePerMinute}/min</span>
        </div>
        
        <div className="billing-item total">
          <span className="label">Total Cost:</span>
          <span className="value">${totalCost}</span>
        </div>
      </div>
      
      <div className="billing-warning">
        <p>⚠️ You will be charged automatically every minute</p>
      </div>
    </div>
  );
};

export default BillingDisplay;