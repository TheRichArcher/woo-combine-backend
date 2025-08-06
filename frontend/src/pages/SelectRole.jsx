import React, { useState, useEffect } from "react";
import { useAuth, useLogout } from "../context/AuthContext";
import { useNavigate } from 'react-router-dom';
import WelcomeLayout from '../components/layouts/WelcomeLayout';
import LoadingScreen from '../components/LoadingScreen';
import api from '../lib/api';
import { logger } from '../utils/logger';
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
  const { user, refreshUserRole, setUserRole } = useAuth();
  const [selectedRole, setSelectedRole] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const logout = useLogout();
  
  // Parse pending event invitation for role enforcement
  const pendingEventJoin = localStorage.getItem('pendingEventJoin');
  
  // CRITICAL FIX: Only treat as invited user if they actually came via invitation
  // Check if the previous page was a join-event route to validate invitation
  const referrer = document.referrer;
  const currentUrl = window.location.href;
  const cameFromJoinEvent = referrer.includes('/join-event/') || currentUrl.includes('from=invite');
  
  // Clear stale pendingEventJoin if user didn't come from invitation flow
  useEffect(() => {
    if (pendingEventJoin && !cameFromJoinEvent) {
      logger.info('SELECT-ROLE', 'Clearing stale pendingEventJoin - user did not come from invitation');
      localStorage.removeItem('pendingEventJoin');
    }
  }, [pendingEventJoin, cameFromJoinEvent]);
  
  // Only consider as invited user if they have pending invite AND came from invitation flow
  const isInvitedUser = !!pendingEventJoin && cameFromJoinEvent;
  
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

  if (!user) {
    return (
      <LoadingScreen 
        title="Preparing role selection..."
        subtitle="Setting up your account"
        size="large"
      />
    );
  }

  const handleContinue = async () => {
    setError("");
    
    if (!selectedRole) {
      setError("Please select a role.");
      return;
    }
    
    setLoading(true);
    
    try {
      // Save user role via backend API with fallback for Firebase issues
      try {
        await api.post('/users/role', {
          role: selectedRole
        });
        console.log('[ROLE-SETTING] Successfully set role via primary endpoint');
      } catch (primaryError) {
        console.warn('[ROLE-SETTING] Primary endpoint failed, trying fallback:', primaryError.message);
        
        // Fallback to simplified endpoint for Firebase configuration issues
        try {
          await api.post('/users/role-simple', {
            role: selectedRole
          });
          console.log('[ROLE-SETTING] Successfully set role via fallback endpoint');
        } catch (fallbackError) {
          console.error('[ROLE-SETTING] Both endpoints failed:', fallbackError.message);
          throw new Error('Failed to set role. Please try again or contact support.');
        }
      }
      
      // PERFORMANCE: Skip redundant role refresh - AuthContext will handle this automatically
      // Just update local state for immediate navigation and persist to localStorage
      setUserRole(selectedRole);
      localStorage.setItem('userRole', selectedRole);
      localStorage.setItem('userEmail', user.email);
      
      // Handle post-role-selection navigation
      if (isInvitedUser && pendingEventJoin) {
        // User was invited to an event - redirect back to join flow
        const safePath = pendingEventJoin.split('/').map(part => encodeURIComponent(part)).join('/');
        navigate(`/join-event/${safePath}`, { replace: true });
      } else {
        // STREAMLINED ONBOARDING: For new organizers, go directly to create-league
        if (selectedRole === 'organizer') {
          // New organizers go straight to league creation for streamlined setup
          navigate("/create-league");
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
              onClick={() => setSelectedRole(role.key)}
              disabled={loading}
              className={`w-full p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                selectedRole === role.key
                  ? 'border-cyan-500 bg-cyan-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl mt-1">{role.emoji}</span>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{role.label}</h4>
                  <p className="text-sm text-gray-600 mb-1">{role.desc}</p>
                  <p className="text-xs text-gray-500">{role.benefits}</p>
                </div>
                {selectedRole === role.key && (
                  <CheckCircle className="w-5 h-5 text-cyan-600 mt-1" />
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div className="w-full bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-3">
          <button
            onClick={handleContinue}
            className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-4 rounded-xl shadow-lg transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:transform-none"
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

        {/* Help Text */}
        <div className="mt-4 text-xs text-gray-400">
          <p>Can be changed later</p>
        </div>
      </div>
    </WelcomeLayout>
  );
} 