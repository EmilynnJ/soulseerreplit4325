// c:\Users\emily\soulseerreplit4325-1\frontend\src\pages\ReaderDashboardPage.jsx
import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const ReaderDashboardPage = () => {
  const { currentUser } = useAuth();

  return (
    <div>
      <h1 style={{ color: 'var(--color-primary-pink)' }}>Reader Dashboard</h1>
      <p>Welcome, {currentUser?.name || 'Reader'}!</p>
      {/* Sections for: View availability calendar, start sessions, go live, see earnings and logs */}
    </div>
  );
};

export default ReaderDashboardPage;