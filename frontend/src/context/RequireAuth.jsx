import React from "react";
import { useAuth } from "./AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import LoadingScreen from '../components/LoadingScreen';

/**
 * RequireAuth - Authentication and authorization gate for routes.
 * 
 * @param {string[]} allowedRoles - If provided, restrict access to these roles.
 *   e.g., allowedRoles={["organizer"]} for admin-only routes.
 *   If omitted, any authenticated user with a role can access.
 */
export default function RequireAuth({ children, allowedRoles }) {
  const { user, initializing, authChecked, roleChecked, userRole } = useAuth();
  const location = useLocation();

  // Wait for all auth state to be ready
  if (initializing || !authChecked || !roleChecked) {
    return (
      <LoadingScreen 
        title="Setting up your account..."
        subtitle="Almost there..."
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
  
  // Deny-by-default: no role means onboarding is incomplete.
  if (!userRole) {
    return <Navigate to="/select-role" replace state={{ from: location }} />;
  }
  
  // Role-based access control: if allowedRoles specified, enforce them
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    // User has a role but it's not permitted for this route
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
} 