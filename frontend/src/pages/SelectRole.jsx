import React, { useState } from "react";
import { useAuth, useLogout } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import WelcomeLayout from "../components/layouts/WelcomeLayout";

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
  const [emailCheck, setEmailCheck] = useState(false);
  const [checkingUser, setCheckingUser] = useState(true);
  const navigate = useNavigate();
  const logout = useLogout();
  const db = getFirestore();

  React.useEffect(() => {
    const checkUser = async () => {
      try {
        const auth = getAuth();
        await auth.currentUser?.reload();
        const refreshedUser = auth.currentUser;
        if (!refreshedUser) return;
        if (import.meta.env.DEV) {
          console.log("[SelectRole] Refreshed user:", refreshedUser);
        }
        if (!refreshedUser.emailVerified) {
          setEmailCheck(true);
        }
      } catch (err) {
        console.error("Error in SelectRole user check:", err);
        setError("Failed to check user state.");
      } finally {
        setCheckingUser(false);
      }
    };
    checkUser();
  }, [user]);

  if (!user || checkingUser) {
    return (
      <WelcomeLayout
        contentClassName="min-h-[70vh]"
        hideHeader={true}
        showOverlay={false}
      >
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 sm:p-10 flex flex-col items-center">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-gray-300 border-t-cyan-600 rounded-full"></div>
          <div className="mt-4 text-gray-600">Loading...</div>
        </div>
      </WelcomeLayout>
    );
  }

  const handleContinue = async () => {
    console.log('[SelectRole] handleContinue called');
    setError("");
    const auth = getAuth();
    await auth.currentUser?.reload();
    const refreshedUser = auth.currentUser;
    if (!refreshedUser) {
      setError("No user found. Please log in again.");
      return;
    }
    if (!refreshedUser.emailVerified) {
      setEmailCheck(true);
      setError("Please verify your email to continue.");
      return;
    }
    if (!selectedRole) {
      setError("Please select a role.");
      return;
    }
    setLoading(true);
    try {
      console.log('[SelectRole] Attempting to write user doc:', {
        uid: refreshedUser.uid,
        email: refreshedUser.email,
        role: selectedRole
      });
      await setDoc(doc(db, "users", refreshedUser.uid), {
        id: refreshedUser.uid,
        email: refreshedUser.email,
        role: selectedRole,
        created_at: serverTimestamp(),
      }, { merge: true });
      console.log('[SelectRole] Successfully wrote user doc for UID:', refreshedUser.uid);
      await refreshedUser.getIdToken(true);
      // Force a reload so AuthContext picks up the new Firestore doc and role
      window.location.replace("/dashboard");
    } catch (err) {
      setError(err.message || "Failed to save role.");
      console.error("🔥 Firestore write failed in SelectRole for UID:", refreshedUser?.uid, err);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      const auth = getAuth();
      const refreshedUser = auth.currentUser;
      await refreshedUser.sendEmailVerification();
      setError("Verification email sent. Please check your inbox.");
    } catch (err) {
      setError(err.message || "Failed to send verification email.");
      console.error("🔥 Failed to send verification email:", err);
    }
  };

  const handleCheckAgain = async () => {
    setError("");
    const auth = getAuth();
    await auth.currentUser?.reload();
    const refreshedUser = auth.currentUser;
    if (refreshedUser && refreshedUser.emailVerified) {
      setEmailCheck(false);
      setError("");
    } else {
      setError("Still not verified. Please check your email and try again.");
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

        {/* Email Verification Section */}
        {emailCheck && (
          <div className="w-full mb-6 text-center">
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded mb-4">
              <div className="font-semibold mb-2">Please verify your email to continue.</div>
            </div>
            <div className="flex gap-2">
              <button 
                className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white font-medium py-2 rounded-lg transition disabled:opacity-50" 
                onClick={handleResend} 
                disabled={loading}
              >
                Resend Email
              </button>
              <button 
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 rounded-lg transition disabled:opacity-50" 
                onClick={handleCheckAgain} 
                disabled={loading}
              >
                Check Again
              </button>
            </div>
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