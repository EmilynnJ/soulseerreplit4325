// c:\Users\emily\soulseerreplit4325-1\frontend\src\contexts\WalletContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { fetchWalletBalance, fetchWalletTransactions } from '../services/walletService';

const WalletContext = createContext(null);

export const useWallet = () => useContext(WalletContext);

export const WalletProvider = ({ children }) => {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { currentUser } = useAuth();

  const loadWalletData = useCallback(async () => {
    if (!currentUser) {
      setWallet(null);
      setTransactions([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const balanceData = await fetchWalletBalance();
      setWallet(balanceData);
      const transactionsData = await fetchWalletTransactions();
      setTransactions(transactionsData);
    } catch (err) {
      setError(err.message || 'Failed to load wallet data.');
      console.error("WalletContext Error:", err);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadWalletData();
  }, [loadWalletData]);

  const value = {
    wallet,
    transactions,
    loading,
    error,
    refreshWallet: loadWalletData, // Function to manually refresh wallet data
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};