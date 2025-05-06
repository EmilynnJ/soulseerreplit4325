// c:\Users\emily\soulseerreplit4325-1\frontend\src\routes\ProtectedRoute.jsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ allowedRoles }) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>; // Or a spinner component
  }

  // Basic check for logged-in user. Role check can be added here.
  // e.g., if (currentUser && allowedRoles && !allowedRoles.includes(currentUser.role)) return <Navigate to="/unauthorized" replace />;
  return currentUser ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;