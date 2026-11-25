import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spin } from 'antd';

export const ProtectedRoute = ({ children, allowedRoles }) => {
  const { currentUser, loading, hasRole } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="Loading authentication details..." />
      </div>
    );
  }

  if (!currentUser) {
    // Redirect to login page, preserving path
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !hasRole(allowedRoles)) {
    // Role unauthorized redirection
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

export default ProtectedRoute;
