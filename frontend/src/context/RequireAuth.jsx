import React from "react";
import { useAuth } from "./AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import LoadingScreen from '../components/LoadingScreen';
import { getPendingInviteJoinPath } from "../lib/pendingInviteRoute";
import { getInviteHydrationState } from "../lib/inviteHydrationState";
import { logSelectRoleRedirect } from "../lib/selectRoleRedirectDebug";

/**
 * RequireAuth - Authentication and authorization gate for routes.
 * 
 * @param {string[]} allowedRoles - If provided, restrict access to these roles.
 *   e.g., allowedRoles={["organizer"]} for admin-only routes.
 *   If omitted, any authenticated user with a role can access.
 */
export default function RequireAuth({ children, allowedRoles }) {
  const { user, initializing, authChecked, roleChecked, userRole, leagues, selectedLeagueId } = useAuth();
  const location = useLocation();
  const pendingInvitePath = getPendingInviteJoinPath();
  const inviteHydrationState = getInviteHydrationState();
  const effectiveRole = userRole || inviteHydrationState?.role || null;
  const inviteJoinInProgress = (() => {
    try {
      return localStorage.getItem('inviteJoinInProgress') === '1';
    } catch {
      return false;
    }
  })();

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
  
  if (pendingInvitePath && !location.pathname.startsWith('/join-event/')) {
    return <Navigate to={pendingInvitePath} replace />;
  }

  if (!user) {
    return <Navigate to="/welcome" replace />;
  }
  
  // Require email verification for new accounts
  if (!user.emailVerified) {
    return <Navigate to="/verify-email" replace />;
  }
  
  // Deny-by-default: no role means onboarding is incomplete.
  if (!effectiveRole) {
    if (inviteJoinInProgress) {
      console.info('[RequireAuth] Suppressing /select-role redirect during invite join hydration');
      return (
        <LoadingScreen
          title="Finalizing invite access..."
          subtitle="Syncing your account"
          size="large"
          showProgress={true}
        />
      );
    }
    logSelectRoleRedirect({
      source: 'RequireAuth',
      reason: 'missing role in auth guard',
      pathname: location.pathname,
      userRole: effectiveRole,
      leaguesLength: leagues?.length || 0,
      selectedLeagueId: selectedLeagueId || null
    });
    return <Navigate to="/select-role" replace state={{ from: location }} />;
  }
  
  // Role-based access control: if allowedRoles specified, enforce them
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(effectiveRole)) {
    // User has a role but it's not permitted for this route
    if (effectiveRole === 'viewer') {
      return <Navigate to="/results-lookup" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
} 