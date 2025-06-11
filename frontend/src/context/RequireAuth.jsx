import React from "react";
import { useAuth } from "./AuthContext";
import { Navigate, useLocation } from "react-router-dom";

export default function RequireAuth({ children }) {
  const { user, loading, roleChecking, userRole } = useAuth();
  const location = useLocation();
  
  if (loading || roleChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin inline-block w-6 h-6 border-4 border-gray-300 border-t-cyan-600 rounded-full"></div>
          <div className="mt-3 text-gray-600">Loading...</div>
        </div>
      </div>
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