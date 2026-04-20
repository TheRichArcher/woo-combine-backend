import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingScreen from './LoadingScreen';
import { getPendingInviteJoinPath } from '../lib/pendingInviteRoute';

export default function RootRedirect() {
  const { user, userRole, initializing, authChecked, roleChecked } = useAuth();
  const pendingInvitePath = getPendingInviteJoinPath();

  if (initializing || !authChecked || !roleChecked) {
    return (
      <LoadingScreen
        title="Checking your session..."
        subtitle="Please wait"
        size="large"
      />
    );
  }

  if (pendingInvitePath) {
    return <Navigate to={pendingInvitePath} replace />;
  }

  if (!user) {
    return <Navigate to="/welcome" replace />;
  }

  if (!user.emailVerified) {
    return <Navigate to="/verify-email" replace />;
  }

  if (!userRole) {
    return <Navigate to="/select-role" replace />;
  }

  if (userRole === "viewer") {
    return <Navigate to="/results-lookup" replace />;
  }

  return <Navigate to="/coach" replace />;
}
