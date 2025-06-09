import React from "react";
import { useAuth } from "./AuthContext";
import { Navigate } from "react-router-dom";

export default function RequireAuth({ children }) {
  const { user, loading, roleChecking } = useAuth();
  
  if (loading || roleChecking) {
    return <div>Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (!user.emailVerified) {
    return <Navigate to="/verify-email" replace />;
  }
  
  return children;
} 