import React, { useState, useEffect } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail } from "lucide-react";
import Button from "../ui/Button";
import { authLogger } from "../../utils/logger";
import { isExpectedAuthError } from "../../utils/authErrorHandler";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { loading } = useAuth();
  const navigate = useNavigate();

  // CRITICAL FIX: Clear stale invitation data when accessing login normally
  useEffect(() => {
    // Preserve pendingEventJoin; it can originate from QR flows without referrer
    // No-op: do not clear here to avoid losing invite context
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // CRITICAL FIX: Don't navigate here - let AuthContext handle navigation
      // after role/league state is fully ready. This prevents flicker through
      // intermediate routes like /dashboard before reaching final destination.
      // LoginForm will unmount when AuthContext redirects to proper route.
      
      // Store intended redirect if exists (for post-verification flow)
      const stored = localStorage.getItem('postLoginRedirect');
      if (stored && stored !== '/login') {
        localStorage.setItem('postLoginTarget', stored);
        localStorage.removeItem('postLoginRedirect');
      }
      // Don't navigate - AuthContext onAuthStateChanged will handle it
    } catch (err) {
      // Handle expected credential errors without Sentry logging
      if (!isExpectedAuthError(err.code)) {
        authLogger.error("Email sign-in error", err);
      }

      if (err.code === "auth/user-not-found") {
        setFormError("No account found with that email address.");
      } else if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential" || err.code === "auth/invalid-login-credentials") {
        setFormError(
          <span>
            Incorrect email or password.{" "}
            <Link to="/forgot-password" className="underline font-bold hover:text-red-700">
              Reset password
            </Link>
          </span>
        );
      } else if (err.code === "auth/invalid-email") {
        setFormError("Please enter a valid email address.");
      } else if (err.code === "auth/user-disabled") {
        setFormError("This account has been disabled.");
      } else if (err.code === "auth/too-many-requests") {
        setFormError("Too many failed attempts. Please try again later.");
      } else {
        setFormError("Something went wrong. Please try again.");
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
          className="w-9 h-9 flex items-center justify-center rounded-full bg-brand-primary/10 hover:bg-brand-primary/20 border border-brand-primary/20 shadow text-brand-primary hover:opacity-90 focus:outline-none"
          type="button"
          aria-label="Back to welcome"
          onClick={() => navigate("/welcome")}
        >
          <ArrowLeft size={20} />
        </button>
        <Link
          to="/help"
          className="text-xs text-brand-primary hover:underline font-semibold"
        >
          Need Help?
        </Link>
      </div>

      <h2 className="text-3xl font-extrabold mb-6 text-center text-brand-primary drop-shadow">Welcome Back</h2>
      <div className="w-full bg-brand-primary/10 border border-brand-primary/20 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Mail className="w-5 h-5 text-brand-primary" />
          <p className="text-brand-primary font-medium text-sm">Email Sign-In</p>
        </div>
        <p className="text-gray-700 text-sm">
          Enter your email and password to access your account.
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="w-full flex flex-col items-center">
        <div className="relative w-full mb-4">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-primary" />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-brand-primary/20 rounded-full focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition"
            autoComplete="email"
            required
          />
        </div>
        
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full mb-4 px-4 py-3 border border-brand-primary/20 rounded-full focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition"
          autoComplete="current-password"
          required
        />
        
        {formError && <div className="text-red-500 mb-4 text-sm w-full text-center">{formError}</div>}
        
        <Button type="submit" size="lg" className="w-full mb-4" disabled={submitting}>
          {submitting ? "Signing In..." : "Sign In"}
        </Button>

        {/* Footer Links */}
        <div className="w-full flex flex-col gap-2 mt-2 text-center">
          <Link 
            to="/forgot-password" 
            className="text-sm text-brand-primary hover:underline"
          >
            Forgot your password?
          </Link>
          <span className="text-sm text-gray-600">
            Don't have an account?{' '}
            <Link to="/signup" className="text-brand-primary font-semibold hover:underline">Let's Get Started</Link>
          </span>
        </div>
      </form>
    </>
  );
} 