import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

interface RouteGuardProps {
  children: React.ReactNode;
  requiresAuth?: boolean;
  requiresAdmin?: boolean;
}

export const RouteGuard: React.FC<RouteGuardProps> = ({
  children,
  requiresAuth = false,
  requiresAdmin = false,
}) => {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  // If route requires admin access
  if (requiresAdmin) {
    if (!isAuthenticated) {
      return <Navigate to="/login" state={{ from: location }} replace />;
    }
    
    // Check if user is admin (role === "risp" or id === 1 like in Vue app)
    if (user?.role !== 'risp' && user?.id !== 1) {
      throw new Error('You do not have permission to view this resource.');
    }
  }
  
  // If route requires authentication
  else if (requiresAuth) {
    if (!isAuthenticated) {
      return <Navigate to="/login" state={{ from: location }} replace />;
    }
  }

  // Route is public or user has access
  return <>{children}</>;
};

export default RouteGuard;
