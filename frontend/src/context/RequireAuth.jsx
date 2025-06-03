import React from "react";
import { useAuth } from "./AuthContext";

export default function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  console.log('[RequireAuth] user:', user, 'loading:', loading);
  if (loading) return <div>Loading...</div>;
  if (!user) {
    window.location.href = "/login";
    return null;
  }
  if (!user.emailVerified) {
    window.location.href = "/verify-email";
    return null;
  }
  return children;
} 