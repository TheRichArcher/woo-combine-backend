import React from "react";
import { useAuth } from "./AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import LoadingScreen from '../components/LoadingScreen';

export default function RequireAuth({ children }) {
  const { user, loading, roleChecking, userRole } = useAuth();
  const location = useLocation();
  
  if (loading || roleChecking) {
    return (
      <LoadingScreen 
        title="Verifying access..."
        subtitle="Checking your authentication"
        size="large"
      />
    );
  }
  
  if (!user) {
    return <Navigate to="/welcome" replace />;
  }
  
  if (!user.emailVerified) {
    return <Navigate to="/verify-email" replace />;
  }
  
  // Special case: if user is authenticated and verified but has no role,
  // redirect to select-role UNLESS we're already on that page
  if (user.emailVerified && !userRole && location.pathname !== '/select-role') {
    return <Navigate to="/select-role" replace />;
  }
  
  return children;
} 