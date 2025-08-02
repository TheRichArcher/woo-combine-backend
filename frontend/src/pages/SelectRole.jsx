import React, { useState, useEffect } from "react";
import { useAuth, useLogout } from "../context/AuthContext";
import { useNavigate } from 'react-router-dom';
import WelcomeLayout from '../components/layouts/WelcomeLayout';
import LoadingScreen from '../components/LoadingScreen';
import api from '../lib/api';
import { logger } from '../utils/logger';
import { ChevronDown, Shield, Users, Eye, CheckCircle, Settings, BarChart3, Upload } from 'lucide-react';

// Enhanced role options with detailed permissions and features
const ALL_ROLE_OPTIONS = [
  { 
    key: "organizer", 
    label: "League Operator", 
    desc: "Manage events, upload players, run combines",
    icon: Shield,
    color: "from-purple-50 to-indigo-50 border-purple-200",
    features: [
      "Create and manage leagues & events",
      "Upload and manage player rosters",
      "Configure drill templates & weights",
      "Run live entry sessions",
      "Generate reports & scorecards",
      "Manage evaluators & permissions"
    ],
    access: "Full administrative control"
  },
  { 
    key: "coach", 
    label: "Coach", 
    desc: "View player performance and analyze results",
    icon: BarChart3,
    color: "from-blue-50 to-cyan-50 border-blue-200",
    features: [
      "View player rankings & statistics",
      "Analyze performance data",
      "Export rankings & reports",
      "Team formation tools",
      "Custom weight configurations",
      "Player comparison tools"
    ],
    access: "Read access to event data"
  },
  { 
    key: "viewer", 
    label: "Parent/Viewer", 
    desc: "View event results and player performance",
    icon: Eye,
    color: "from-green-50 to-emerald-50 border-green-200",
    features: [
      "View event results & rankings",
      "See individual player performance",
      "Download player scorecards",
      "Basic performance comparisons",
      "Event schedule & information"
    ],
    access: "Read-only event viewing"
  }
];

const INVITED_ROLE_OPTIONS = [
  ALL_ROLE_OPTIONS.find(role => role.key === "coach"),
  ALL_ROLE_OPTIONS.find(role => role.key === "viewer")
];

export default function SelectRole() {
  const { user, refreshUserRole } = useAuth();
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
      // Save user role via backend API (more secure than direct Firestore writes)
      await api.post('/users/role', {
        role: selectedRole
      });
      
      // Refresh AuthContext to detect the new role
      await refreshUserRole();
      
      // Small delay to ensure role is properly set in AuthContext
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Handle post-role-selection navigation
      if (isInvitedUser && pendingEventJoin) {
        // User was invited to an event - redirect back to join flow

        
        // Navigate back to the join-event URL
        const safePath = pendingEventJoin.split('/').map(part => encodeURIComponent(part)).join('/');
        navigate(`/join-event/${safePath}`, { replace: true });
      } else {
        // STREAMLINED ONBOARDING: For new organizers, go directly to create-league
        if (selectedRole === 'organizer') {
          // New organizers go straight to league creation for streamlined setup
          navigate("/create-league", { replace: true });
        } else {
          // Non-organizers go to dashboard (which will show LeagueFallback if needed)
          navigate("/dashboard", { replace: true });
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
        <h1 className="text-2xl font-bold mb-4 text-gray-900">Choose Your Role</h1>
        
        {intendedRole ? (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-amber-600">🔒</span>
              <p className="text-amber-800 font-medium text-sm">Role Pre-Selected for Security</p>
            </div>
            <p className="text-amber-700 text-sm">
              You've been invited as a <strong>{intendedRole === 'coach' ? 'Coach' : 'Viewer'}</strong>. This role has been pre-selected to ensure proper access permissions.
            </p>
          </div>
        ) : isInvitedUser ? (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800 text-sm">
              You've been invited to join an event! Please select your role to continue.
            </p>
          </div>
        ) : (
          <p className="mb-6 text-gray-600">
            Select the role that best describes your involvement in youth sports combines.
          </p>
        )}

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
        
        {/* Role Selection Dropdown */}
        <div className="w-full mb-6">
          <div className="relative">
            <select
              value={selectedRole || ''}
              onChange={(e) => setSelectedRole(e.target.value)}
              disabled={loading}
              className="w-full p-3 pr-10 border-2 rounded-lg appearance-none bg-white text-left cursor-pointer transition-all duration-200 border-gray-300 hover:border-gray-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
            >
              <option value="" disabled>Choose your role...</option>
              {roleOptions.map((role) => (
                <option key={role.key} value={role.key}>
                  {role.label} - {role.desc}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>

          {/* Role Preview Card */}
          {selectedRole && (
            <div className={`mt-4 bg-gradient-to-br ${roleOptions.find(r => r.key === selectedRole)?.color} border-2 rounded-xl p-6`}>
              {(() => {
                const selectedRoleData = roleOptions.find(r => r.key === selectedRole);
                const IconComponent = selectedRoleData?.icon || Users;
                return (
                  <>
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-4">
                      <IconComponent className="w-8 h-8 text-gray-700" />
                      <div className="flex-1">
                        <h4 className="text-lg font-bold text-gray-900">{selectedRoleData?.label}</h4>
                        <p className="text-sm text-gray-700">{selectedRoleData?.desc}</p>
                      </div>
                      <CheckCircle className="w-6 h-6 text-cyan-600" />
                    </div>

                    {/* Access Level */}
                    <div className="bg-white/70 rounded-lg p-3 border border-gray-200 mb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Shield className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-900">Access Level</span>
                      </div>
                      <div className="text-sm text-gray-800">{selectedRoleData?.access}</div>
                    </div>

                    {/* Features */}
                    <div className="bg-white/70 rounded-lg p-3 border border-gray-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Settings className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-900">What you can do:</span>
                      </div>
                      <div className="grid grid-cols-1 gap-1">
                        {selectedRoleData?.features.map((feature, index) => (
                          <div key={index} className="text-xs text-gray-700 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0" />
                            {feature}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
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
        <div className="mt-6 text-sm text-gray-500">
          <p>You can change your role later in account settings.</p>
        </div>
      </div>
    </WelcomeLayout>
  );
} 