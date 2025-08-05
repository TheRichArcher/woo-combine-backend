import React, { useState, useEffect } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail } from "lucide-react";
import { authLogger } from "../../utils/logger";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { loading } = useAuth();
  const navigate = useNavigate();

  // CRITICAL FIX: Clear stale invitation data when accessing login normally
  useEffect(() => {
    // Only clear if user didn't come from invitation flow
    const referrer = document.referrer;
    const currentUrl = window.location.href;
    const cameFromJoinEvent = referrer.includes('/join-event/') || currentUrl.includes('from=invite');
    
    if (!cameFromJoinEvent) {
      const pendingEventJoin = localStorage.getItem('pendingEventJoin');
      if (pendingEventJoin) {
        authLogger.info('Clearing stale pendingEventJoin from normal login access');
        localStorage.removeItem('pendingEventJoin');
      }
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('📝 Login form submitted for:', email);
    setFormError("");
    setSubmitting(true);
    
    try {
      console.log('🔑 Attempting Firebase authentication...');
      await signInWithEmailAndPassword(auth, email, password);
      console.log('✅ Firebase authentication successful - waiting for AuthContext...');
      // Let AuthContext handle the navigation logic for verified users
    } catch (err) {
      authLogger.error("Email sign-in error", err);
      if (err.code === "auth/user-not-found") {
        setFormError("No account found with that email address.");
      } else if (err.code === "auth/wrong-password") {
        setFormError("Incorrect password. Please try again.");
      } else if (err.code === "auth/invalid-email") {
        setFormError("Please enter a valid email address.");
      } else if (err.code === "auth/user-disabled") {
        setFormError("This account has been disabled.");
      } else if (err.code === "auth/too-many-requests") {
        setFormError("Too many failed attempts. Please try again later.");
      } else {
        setFormError("Failed to sign in. Please check your credentials and try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <>
      {/* Header Row: Back + Help */}
      <div className="w-full flex flex-row justify-between items-center mb-6 px-2">
        <button
          className="w-9 h-9 flex items-center justify-center rounded-full bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 shadow text-cyan-700 hover:text-cyan-900 focus:outline-none"
          type="button"
          aria-label="Back to welcome"
          onClick={() => navigate("/welcome")}
        >
          <ArrowLeft size={20} />
        </button>
        <Link
          to="/help"
          className="text-xs text-cyan-700 hover:underline font-semibold"
        >
          Need Help?
        </Link>
      </div>

      <h2 className="text-3xl font-extrabold mb-6 text-center text-cyan-700 drop-shadow">Welcome Back</h2>
      <div className="w-full bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Mail className="w-5 h-5 text-blue-600" />
          <p className="text-blue-800 font-medium text-sm">Email Sign-In</p>
        </div>
        <p className="text-blue-700 text-sm">
          Enter your email and password to access your account.
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="w-full flex flex-col items-center">
        <div className="relative w-full mb-4">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-700" />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-cyan-200 rounded-full focus:ring-2 focus:ring-cyan-700 focus:border-cyan-700 transition"
            autoComplete="email"
            required
          />
        </div>
        
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full mb-4 px-4 py-3 border border-cyan-200 rounded-full focus:ring-2 focus:ring-cyan-700 focus:border-cyan-700 transition"
          autoComplete="current-password"
          required
        />
        
        {formError && <div className="text-red-500 mb-4 text-sm w-full text-center">{formError}</div>}
        
        <button
          type="submit"
          className="w-full bg-cyan-700 hover:bg-cyan-800 text-white font-bold px-6 py-3 rounded-full shadow transition mb-4 disabled:opacity-50"
          disabled={submitting}
        >
          {submitting ? "Signing In..." : "Sign In"}
        </button>

        {/* Footer Links */}
        <div className="w-full flex flex-col gap-2 mt-2 text-center">
          <Link 
            to="/forgot-password" 
            className="text-sm text-cyan-700 hover:underline"
          >
            Forgot your password?
          </Link>
          <span className="text-sm text-gray-600">
            Don't have an account?{' '}
            <Link to="/signup" className="text-cyan-700 font-semibold hover:underline">Let's Get Started</Link>
          </span>
        </div>
      </form>
    </>
  );
} 