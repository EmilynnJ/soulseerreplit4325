// c:\Users\emily\soulseerreplit4325-1\frontend\src\pages\ClientDashboardPage.jsx
import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const ClientDashboardPage = () => {
  const { currentUser } = useAuth();

  return (
    <div>
      <h1 style={{ color: 'var(--color-primary-pink)' }}>Client Dashboard</h1>
      <p>Welcome, {currentUser?.name || 'Client'}!</p>
      {/* Sections for: Explore readers, book sessions, join livestreams, track wallet, chat history */}
    </div>
  );
};

export default ClientDashboardPage;