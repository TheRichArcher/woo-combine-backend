import React, { useState, useEffect } from "react";
import { useAuth, useLogout } from "../context/AuthContext";
import { useNavigate, Navigate } from 'react-router-dom';
import WelcomeLayout from '../components/layouts/WelcomeLayout';
import LoadingScreen from '../components/LoadingScreen';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';
import { ChevronDown, Shield, Users, Eye, CheckCircle, Settings, BarChart3, Upload } from 'lucide-react';

// Simplified role options for faster onboarding
const ALL_ROLE_OPTIONS = [
  { 
    key: "organizer", 
    label: "Event Organizer", 
    desc: "I'm setting up and running combine events",
    icon: Shield,
    emoji: "🏆",
    benefits: "Create events, add players, manage everything"
  },
  { 
    key: "coach", 
    label: "Coach", 
    desc: "I want to evaluate players and see rankings",
    icon: BarChart3,
    emoji: "📊",
    benefits: "View detailed stats, adjust rankings, export data"
  },
  { 
    key: "viewer", 
    label: "Parent/Spectator", 
    desc: "I want to follow results and see reports",
    icon: Eye,
    emoji: "👀",
    benefits: "Watch live results, view player reports"
  }
];

const INVITED_ROLE_OPTIONS = [
  ALL_ROLE_OPTIONS.find(role => role.key === "coach"),
  ALL_ROLE_OPTIONS.find(role => role.key === "viewer")
];

export default function SelectRole() {
  const { user, refreshUserRole, setUserRole, userRole, roleChecked } = useAuth();
  const [selectedRole, setSelectedRole] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoProceedTimer, setAutoProceedTimer] = useState(null);
  const [pendingAutoProceedRole, setPendingAutoProceedRole] = useState(null);
  const [ariaStatus, setAriaStatus] = useState("");
  const navigate = useNavigate();
  const logout = useLogout();
  const { showInfo } = useToast();
  
  // CRITICAL FIX P0: If user already has a role (restored from server or cache),
  // immediately redirect to dashboard using <Navigate /> for cleaner flow
  // useEffect logic removed to prevent double navigation race conditions
  
  // Parse pending event invitation for role enforcement
  const pendingEventJoin = localStorage.getItem('pendingEventJoin');
  
  // Treat as invited user if we have stored invite context
  const isInvitedUser = !!pendingEventJoin;
  
  // Extract intended role from invitation data
  let intendedRole = null;
  if (pendingEventJoin) {
    const parts = pendingEventJoin.split('/');
    // Check if last part is a role (coach or viewer)
    const lastPart = parts[parts.length - 1];
    if (lastPart === 'coach' || lastPart === 'viewer') {
      intendedRole = lastPart;
    }
  }
  
  // Determine available role options based on invitation
  let roleOptions;
  if (intendedRole) {
    // Role is enforced - only show the intended role
    roleOptions = ALL_ROLE_OPTIONS.filter(opt => opt.key === intendedRole);
  } else if (isInvitedUser) {
    // General invitation - show coach/viewer options
    roleOptions = INVITED_ROLE_OPTIONS;
  } else {
    // Regular user - show all options
    roleOptions = ALL_ROLE_OPTIONS;
  }

  // Auto-select role if it's enforced
  useEffect(() => {
    if (intendedRole && !selectedRole) {
      setSelectedRole(intendedRole);
    }
  }, [intendedRole, selectedRole]);

  // CRITICAL FIX: Check server for pending invites if missing locally (e.g. cross-device/incognito)
  useEffect(() => {
    const checkServerForInvite = async () => {
      // Only check if we don't have a local invite and haven't selected a role yet
      if (!pendingEventJoin && !selectedRole && user) {
        try {
          await refreshUserRole();
          // Check if invite was restored
          const restoredInvite = localStorage.getItem('pendingEventJoin');
          if (restoredInvite) {
            const parts = restoredInvite.split('/');
            // Re-run the navigation logic
            const safePath = restoredInvite.split('/').map(part => encodeURIComponent(part)).join('/');
            navigate(`/join-event/${safePath}`, { replace: true });
          }
        } catch (e) {
          console.error("Failed to check server for invite:", e);
        }
      }
    };
    checkServerForInvite();
  }, [user, pendingEventJoin, selectedRole, refreshUserRole, navigate]);

  // Clear any pending auto-advance on unmount
  useEffect(() => {
    return () => {
      if (autoProceedTimer) {
        clearTimeout(autoProceedTimer);
      }
    };
  }, [autoProceedTimer]);

  // Conditional early return logic - MUST be after all hooks
  
  // Guard 1: Wait for role check to complete
  // This prevents the UI from flashing if the user actually has a role but we're just waiting for the check
  if (!roleChecked) {
    return (
      <LoadingScreen 
        title="Checking account status..."
        subtitle="Please wait"
        size="large"
      />
    );
  }

  // Guard 2: Redirect if role is already present
  if (userRole) {
    console.debug('[SelectRole] User already has role, redirecting to dashboard:', userRole);
    return <Navigate to="/dashboard" replace />;
  }

  if (!user) {
    return (
      <LoadingScreen 
        title="Preparing role selection..."
        subtitle="Setting up your account"
        size="large"
      />
    );
  }

  const handleSelectRole = (roleKey) => {
    if (loading) return;

    // If the same role is tapped again within the cancel window, cancel auto-advance
    if (autoProceedTimer && pendingAutoProceedRole === roleKey) {
      clearTimeout(autoProceedTimer);
      setAutoProceedTimer(null);
      setPendingAutoProceedRole(null);
      setAriaStatus('Selection cancelled.');
      return;
    }

    // If a different role is selected while timer is active, restart the timer
    if (autoProceedTimer && pendingAutoProceedRole !== roleKey) {
      clearTimeout(autoProceedTimer);
      setAutoProceedTimer(null);
    }

    // Clear any previous validation error immediately on selection
    setError("");

    setSelectedRole(roleKey);
    setPendingAutoProceedRole(roleKey);
    setAriaStatus('Proceeding. Activate again to cancel.');

    const timerId = setTimeout(() => {
      setAutoProceedTimer(null);
      setPendingAutoProceedRole(null);
      handleContinue(roleKey);
    }, 350); // brief delay to allow cancel by second tap/press

    setAutoProceedTimer(timerId);
  };

  const handleContinue = async (roleOverride) => {
    // Normalize inputs: button clicks pass a SyntheticEvent, auto-advance passes role string
    if (roleOverride && typeof roleOverride === 'object' && typeof roleOverride.preventDefault === 'function') {
      roleOverride.preventDefault();
    }
    
    setError("");
    
    const roleToSave = (typeof roleOverride === 'string' ? roleOverride : selectedRole);

    if (!roleToSave) {
      setError("Please select a role.");
      return;
    }
    
    setLoading(true);
    
    try {
      // Save user role via backend API with fallback for Firebase issues
      try {
        await api.post('/users/role', {
          role: roleToSave
        });
      } catch (primaryError) {
        // Fallback endpoint is disabled by default in production for security
        throw primaryError;
      }
      
      // CRITICAL FIX: Call refreshUserRole to transition from ROLE_REQUIRED to READY
      // This ensures proper state machine progression and triggers league fetch
      await refreshUserRole();
      
      // Informational hint on next screen
      showInfo('Not the right role? You can change it later in Settings.', 6000);

      // Handle post-role-selection navigation
      if (isInvitedUser && pendingEventJoin) {
        // User was invited to an event - redirect back to join flow
        const safePath = pendingEventJoin.split('/').map(part => encodeURIComponent(part)).join('/');
        navigate(`/join-event/${safePath}`, { replace: true });
      } else {
        // STREAMLINED ONBOARDING: For new organizers, go directly to create-league
        if (roleToSave === 'organizer') {
          // New organizers go straight to league creation for streamlined setup
          navigate("/create-league", { replace: true });
        } else {
          // Non-organizers go to dashboard (which will show LeagueFallback if needed)
          navigate("/dashboard");
        }
      }
      
    } catch (err) {
      setError(err.message || "Failed to save role. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/welcome");
    } catch {
      // Logout errors are handled internally
    }
  };

  return (
    <WelcomeLayout
      contentClassName="min-h-screen"
      hideHeader={true}
      showOverlay={false}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center">
        {/* Logo */}
        <div className="text-center mb-6">
          <img
            src="/favicon/woocombine-logo.png"
            alt="Woo-Combine Logo"
            className="w-16 h-16 mx-auto mb-4"
            style={{ objectFit: 'contain' }}
          />
        </div>

        {/* Header */}
        <h1 className="text-2xl font-bold mb-2 text-gray-900">Almost Done!</h1>
        <p className="mb-6 text-gray-600 text-sm">
          {intendedRole ? 
            `You've been invited as a ${intendedRole === 'coach' ? 'Coach' : 'Viewer'} - just confirm to continue.` :
            "Quick setup: What's your role?"
          }
        </p>

        {/* Debug Info (Development Only) */}
        {import.meta.env.DEV && (
          <div className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 mb-4 text-xs">
            <strong>Debug Info:</strong><br/>
            pendingEventJoin: {pendingEventJoin || 'none'}<br/>
            isInvitedUser: {isInvitedUser ? 'true' : 'false'}<br/>
            intendedRole: {intendedRole || 'none'}<br/>
            roleOptions: {roleOptions.length} options
          </div>
        )}
        
        {/* Simplified Role Selection */}
        <div className="w-full mb-6 space-y-3">
          {roleOptions.map((role) => (
            <button
              key={role.key}
              onClick={() => handleSelectRole(role.key)}
              disabled={loading}
              className={`w-full p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                selectedRole === role.key
                  ? 'border-brand-primary bg-brand-primary/5'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl mt-1">{role.emoji}</span>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{role.label}</h4>
                  <p className="text-sm text-gray-600 mb-1">{role.desc}</p>
                  <p className="text-xs text-gray-500">{role.benefits}</p>
                  {pendingAutoProceedRole === role.key && (
                    <p className="text-xs text-brand-primary mt-1">Continuing... tap again to cancel</p>
                  )}
                </div>
                {selectedRole === role.key && (
                  <CheckCircle className="w-5 h-5 text-brand-primary mt-1" />
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div className="w-full bg-semantic-error/10 border border-semantic-error/20 text-semantic-error px-3 py-2 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-3">
          <button
            onClick={handleContinue}
            className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-semibold py-4 rounded-xl shadow-lg transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:transform-none"
            disabled={!selectedRole || loading}
          >
            {loading ? 'Saving...' : intendedRole ? `Continue as ${intendedRole === 'coach' ? 'Coach' : 'Viewer'}` : 'Continue'}
          </button>

          <button
            onClick={handleLogout}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-xl transition-colors duration-200"
            disabled={loading}
          >
            Sign Out
          </button>
        </div>

        {/* Help Text and a11y live region */}
        <div className="mt-4 text-xs text-gray-400">
          <p>Can be changed later</p>
        </div>
        <div className="sr-only" aria-live="polite">{ariaStatus}</div>
      </div>
    </WelcomeLayout>
  );
} 