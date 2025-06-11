import React, { useState } from "react";
import { useAuth, useLogout } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import WelcomeLayout from "../components/layouts/WelcomeLayout";
import LoadingScreen from "../components/LoadingScreen";

const ROLE_OPTIONS = [
  { key: "organizer", label: "🏈 League Operator", desc: "Full access to admin tools and player management." },
  { key: "coach", label: "🧑‍🏫 Coach", desc: "View and customize, but cannot manage all players." },
  { key: "viewer", label: "👀 Viewer / Guest", desc: "Read-only access to league data." },
];

export default function SelectRole() {
  console.log('[SelectRole] component rendered');
  const { user } = useAuth();
  const [selectedRole, setSelectedRole] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingUser, setCheckingUser] = useState(true);
  const navigate = useNavigate();
  const logout = useLogout();
  const db = getFirestore();

  React.useEffect(() => {
    // Simple initialization since RequireAuth already handles all auth checks
        setCheckingUser(false);
  }, []);

  if (!user || checkingUser) {
    return (
      <LoadingScreen 
        title="Preparing role selection..."
        subtitle="Setting up your account"
        size="large"
      />
    );
  }

  const handleContinue = async () => {
    console.log('[SelectRole] handleContinue called');
    setError("");
    
    if (!user) {
      setError("No user found. Please log in again.");
      return;
    }
    
    if (!selectedRole) {
      setError("Please select a role.");
      return;
    }
    
    setLoading(true);
    try {
      console.log('[SelectRole] Attempting to write user doc:', {
        uid: user.uid,
        email: user.email,
        role: selectedRole
      });
      
      await setDoc(doc(db, "users", user.uid), {
        id: user.uid,
        email: user.email,
        role: selectedRole,
        created_at: serverTimestamp(),
      }, { merge: true });
      
      console.log('[SelectRole] Successfully wrote user doc for UID:', user.uid);
      
      // Refresh the user's ID token to pick up any custom claims
      await user.getIdToken(true);
      
      // Navigate to dashboard - AuthContext will handle the role setting
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Failed to save role.");
      console.error("🔥 Firestore write failed in SelectRole for UID:", user?.uid, err);
    } finally {
      setLoading(false);
    }
  };



  const handleLogout = async () => {
    try {
      await logout();
      navigate('/welcome');
    } catch (error) {
      console.error('[SelectRole] Logout error:', error);
      setError("Logout failed. Please try again.");
    }
  };

  return (
    <WelcomeLayout
      contentClassName="min-h-[70vh]"
      hideHeader={true}
      showOverlay={false}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 sm:p-10 flex flex-col items-center">
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
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Welcome! What's your role?</h2>
        
        {/* Role Options */}
        <div className="w-full flex flex-col gap-4 mb-6">
          {ROLE_OPTIONS.map(opt => (
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
        <div className="w-full space-y-3">
          <button
            className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-4 rounded-xl shadow-lg transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:transform-none"
            onClick={handleContinue}
            disabled={loading}
          >
            {loading ? "Saving..." : "Continue"}
          </button>
          
          <button
            className="w-full bg-gray-500 hover:bg-gray-600 text-white font-medium py-3 rounded-xl transition-colors duration-200 disabled:opacity-50"
            onClick={handleLogout}
            disabled={loading}
          >
            {loading ? "Logging out..." : "Logout"}
          </button>
        </div>
      </div>
    </WelcomeLayout>
  );
} 