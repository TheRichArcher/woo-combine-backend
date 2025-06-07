import React, { useState, useEffect } from "react";
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
        if (process.env.NODE_ENV === "development") {
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
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-cmf-light">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full flex flex-col items-center">
        <h2 className="text-2xl font-extrabold text-cmf-primary mb-4">Welcome! What's your role?</h2>
        <div className="w-full flex flex-col gap-4 mb-6">
          {ROLE_OPTIONS.map(opt => (
            <button
              key={opt.key}
              className={`w-full border-2 rounded-xl p-4 text-left flex flex-col transition font-semibold ${selectedRole === opt.key ? "border-cmf-primary bg-cmf-primary/10" : "border-gray-200 bg-white"}`}
              onClick={() => setSelectedRole(opt.key)}
              disabled={loading}
            >
              <span className="text-xl mb-1">{opt.label}</span>
              <span className="text-gray-600 text-sm">{opt.desc}</span>
            </button>
          ))}
        </div>
        {error && <div className="text-red-500 mb-2 text-sm">{error}</div>}
        {emailCheck && (
          <div className="mb-4 text-center">
            <div className="text-yellow-600 font-bold mb-2">Please verify your email to continue.</div>
            <button className="bg-cmf-primary text-white px-4 py-2 rounded mr-2" onClick={handleResend} disabled={loading}>Resend Email</button>
            <button className="bg-cmf-secondary text-white px-4 py-2 rounded" onClick={handleCheckAgain} disabled={loading}>Check Again</button>
          </div>
        )}
        <button
          className="w-full bg-cmf-primary hover:bg-cmf-secondary text-white font-bold py-3 rounded-xl shadow mt-2 disabled:opacity-50"
          onClick={handleContinue}
          disabled={loading}
        >
          {loading ? "Saving..." : "Continue"}
        </button>
        <button
          className="w-full bg-cmf-secondary text-white font-bold py-3 rounded-xl shadow mt-2 disabled:opacity-50"
          onClick={handleLogout}
          disabled={loading}
        >
          {loading ? "Logging out..." : "Logout"}
        </button>
      </div>
    </div>
  );
} 