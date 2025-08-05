import React from "react";
import { useAuth } from "./AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import LoadingScreen from '../components/LoadingScreen';

export default function RequireAuth({ children }) {
  const { user, initializing, authChecked, roleChecked, userRole } = useAuth();
  const location = useLocation();
  
  if (initializing || !authChecked || !roleChecked) {
    return (
      <LoadingScreen 
        title="Setting up your account..."
        subtitle="This should only take a few seconds"
        size="large"
        showProgress={true}
      />
    );
  }
  
  if (!user) {
    return <Navigate to="/welcome" replace />;
  }
  
  // Require email verification for new accounts
  if (!user.emailVerified) {
    return <Navigate to="/verify-email" replace />;
  }
  
  // Special case: if user is authenticated but has no role,
  // redirect to select-role UNLESS we're already on that page
  if (!userRole && location.pathname !== '/select-role') {
    // CRITICAL FIX: Preserve pendingEventJoin for invited users
    // Check if we're on a join-event route and preserve the invitation context
    if (location.pathname.startsWith('/join-event/')) {
      const joinPath = location.pathname.replace('/join-event/', '');
      localStorage.setItem('pendingEventJoin', joinPath);
      
    }
    
    return <Navigate to="/select-role" replace />;
  }
  
  return children;
} 