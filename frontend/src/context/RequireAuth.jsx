import React from "react";
import { useAuth } from "./AuthContext";
import { Navigate } from "react-router-dom";

export default function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  console.log('[RequireAuth] user:', user, 'loading:', loading);
  console.log('[RequireAuth] user verified:', user?.emailVerified);
  console.log('[RequireAuth] current path:', window.location.pathname);
  
  if (loading) return <div>Loading...</div>;
  
  if (!user) {
    console.log('[RequireAuth] No user - redirecting to login');
    return <Navigate to="/login" replace />;
  }
  
  if (!user.emailVerified) {
    console.log('[RequireAuth] User not verified - redirecting to verify-email');
    return <Navigate to="/verify-email" replace />;
  }
  
  console.log('[RequireAuth] User authenticated and verified - rendering children');
  return children;
} 