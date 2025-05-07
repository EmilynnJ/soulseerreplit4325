// c:\Users\emily\soulseerreplit4325-1\frontend\src\pages\AdminDashboardPage.jsx
import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const AdminDashboardPage = () => {
  const { currentUser } = useAuth();

  return (
    <div>
      <h1 style={{ color: 'var(--color-primary-pink)' }}>Admin Dashboard</h1>
      <p>Welcome, {currentUser?.name || 'Admin'}!</p>
      {/* Sections for: Manage users, view all session logs, handle payouts and policy updates */}
    </div>
  );
};

export default AdminDashboardPage;