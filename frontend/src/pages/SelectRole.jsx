import React, { useState, useEffect } from "react";
import { useAuth, useLogout } from "../context/AuthContext";
import { useNavigate } from 'react-router-dom';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import WelcomeLayout from '../components/layouts/WelcomeLayout';
import LoadingScreen from '../components/LoadingScreen';

// Role options for different user types
const ALL_ROLE_OPTIONS = [
  { key: "organizer", label: "League Operator", desc: "Manage events, upload players, run combines" },
  { key: "coach", label: "Coach", desc: "View player performance and analyze results" },
  { key: "viewer", label: "Parent/Viewer", desc: "View event results and player performance" }
];

const INVITED_ROLE_OPTIONS = [
  { key: "coach", label: "Coach", desc: "View player performance and analyze results" },
  { key: "viewer", label: "Parent/Viewer", desc: "View event results and player performance" }
];

export default function SelectRole() {
  const { user } = useAuth();
  const [selectedRole, setSelectedRole] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const logout = useLogout();
  const db = getFirestore();
  
  // Parse pending event invitation for role enforcement
  const pendingEventJoin = localStorage.getItem('pendingEventJoin');
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
      // Save user role to Firestore
      await setDoc(doc(db, "users", user.uid), {
        id: user.uid,
        email: user.email,
        role: selectedRole,
        created_at: serverTimestamp(),
      }, { merge: true });
      
      // Longer delay to ensure Firestore write completes and AuthContext stabilizes before navigation
      await new Promise(resolve => setTimeout(resolve, 500));
      
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
        
        {/* Role Options */}
        <div className="w-full flex flex-col gap-4 mb-6">
          {roleOptions.map(opt => (
            <button
              key={opt.key}
              className={`w-full border-2 rounded-xl p-4 text-left flex flex-col transition font-semibold ${
                selectedRole === opt.key 
                  ? "border-cyan-600 bg-cyan-50 text-cyan-900" 
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
              onClick={() => setSelectedRole(opt.key)}
              disabled={loading}
            >
              <span className="text-lg mb-1">{opt.label}</span>
              <span className="text-gray-600 text-sm">{opt.desc}</span>
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
        <div className="mt-6 text-sm text-gray-500">
          <p>You can change your role later in account settings.</p>
        </div>
      </div>
    </WelcomeLayout>
  );
} 