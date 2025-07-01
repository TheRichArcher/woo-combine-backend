import React, { useState } from "react";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { auth } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail } from "lucide-react";

export default function SignupForm() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const { user: _user, loading, error } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    
    try {
      // Validate required fields
      if (!firstName.trim() || !lastName.trim()) {
        setFormError("Please enter your first and last name.");
        setSubmitting(false);
        return;
      }

      if (password !== confirmPassword) {
        setFormError("Passwords do not match.");
        setSubmitting(false);
        return;
      }

      if (password.length < 6) {
        setFormError("Password must be at least 6 characters.");
        setSubmitting(false);
        return;
      }
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Send email verification
      try {
        await sendEmailVerification(userCredential.user);
        console.log("Email verification sent successfully");
      } catch (verificationError) {
        console.error("Failed to send verification email:", verificationError);
        // Don't block the signup process if verification email fails
      }
      
      // Show success message and redirect to verify-email page
      setSignupSuccess(true);
      
      // FIXED: Shorter delay to reduce duplicate messaging
      setTimeout(() => {
        navigate("/verify-email");
      }, 800); // Reduced from 1500ms to 800ms
    } catch (err) {
      console.error("Email sign-up error:", err);
      if (err.code === "auth/email-already-in-use") {
        setFormError("An account with this email already exists. Try signing in instead.");
      } else if (err.code === "auth/invalid-email") {
        setFormError("Please enter a valid email address.");
      } else if (err.code === "auth/weak-password") {
        setFormError("Password is too weak. Please choose a stronger password.");
      } else if (err.code === "auth/operation-not-allowed") {
        setFormError("Email/password accounts are not enabled. Please contact support.");
      } else {
        setFormError("Failed to create account. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  // Show success message after signup
  if (signupSuccess) {
    return (
      <div className="w-full max-w-md flex flex-col items-center relative">
        {/* Logo */}
        <img
          src="/favicon/woocombine-logo.png"
          alt="Woo-Combine Logo"
          className="w-20 h-20 mx-auto mb-4 mt-8"
          style={{ objectFit: 'contain' }}
        />

        {/* Success Icon */}
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h2 className="text-3xl font-extrabold mb-4 text-center text-cyan-700 drop-shadow">Account Created!</h2>
        
        <div className="w-full bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Mail className="w-5 h-5 text-blue-600" />
            <p className="text-blue-800 font-medium">Check Your Email</p>
          </div>
          <p className="text-blue-700 text-sm leading-relaxed">
            We've sent a verification email to <span className="font-semibold">{email}</span>. 
            Click the link in the email to activate your account.
          </p>
          <p className="text-blue-600 text-xs mt-2">
            Redirecting you to the verification page...
          </p>
        </div>

        {/* Loading animation */}
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-700"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md flex flex-col items-center relative">
      {/* Back Arrow in Circle */}
      <button
        className="absolute left-4 top-4 w-9 h-9 flex items-center justify-center rounded-full bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 shadow text-cyan-700 hover:text-cyan-900 focus:outline-none z-10"
        type="button"
        aria-label="Back to welcome"
        onClick={() => navigate("/welcome")}
        style={{ left: 0, top: 0, position: 'absolute' }}
      >
        <ArrowLeft size={20} />
      </button>
      {/* Help Link Top-Right */}
      <Link
        to="/help"
        className="absolute right-4 top-4 text-xs text-cyan-700 hover:underline font-semibold"
        style={{ right: 0, top: 0, position: 'absolute' }}
      >
        Need Help?
      </Link>
      {/* Logo */}
      <img
        src="/favicon/woocombine-logo.png"
        alt="Woo-Combine Logo"
        className="w-20 h-20 mx-auto mb-4 mt-8"
        style={{ objectFit: 'contain' }}
      />

      <h2 className="text-3xl font-extrabold mb-6 text-center text-cyan-700 drop-shadow">Let's Get Started</h2>
      <div className="w-full bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Mail className="w-5 h-5 text-blue-600" />
          <p className="text-blue-800 font-medium text-sm">Email Registration</p>
        </div>
        <p className="text-blue-700 text-sm">
          Create your account with email and password. We'll send you a verification email.
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="w-full flex flex-col items-center">
        {/* Name fields */}
        <div className="flex flex-row gap-4 w-full mb-4 min-w-0">
          <input
            type="text"
            placeholder="First Name"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            className="flex-1 min-w-0 box-border px-4 py-3 border border-cyan-200 rounded-full focus:ring-2 focus:ring-cyan-700 focus:border-cyan-700 transition"
            autoComplete="given-name"
            required
          />
          <input
            type="text"
            placeholder="Last Name"
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            className="flex-1 min-w-0 box-border px-4 py-3 border border-cyan-200 rounded-full focus:ring-2 focus:ring-cyan-700 focus:border-cyan-700 transition"
            autoComplete="family-name"
            required
          />
        </div>
        
        {/* Email Input */}
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
        
        {/* Password Input */}
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full mb-4 px-4 py-3 border border-cyan-200 rounded-full focus:ring-2 focus:ring-cyan-700 focus:border-cyan-700 transition"
          autoComplete="new-password"
          required
        />
        
        {/* Confirm Password Input */}
        <input
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          className="w-full mb-4 px-4 py-3 border border-cyan-200 rounded-full focus:ring-2 focus:ring-cyan-700 focus:border-cyan-700 transition"
          autoComplete="new-password"
          required
        />
        
        {formError && <div className="text-red-500 mb-4 text-sm">{formError}</div>}
        {error && <div className="text-red-500 mb-4 text-sm">{error.message}</div>}
        
        <button
          type="submit"
          className="w-full bg-cyan-700 hover:bg-cyan-800 text-white font-bold py-3 rounded-full shadow transition mb-4 disabled:opacity-50"
          disabled={submitting || !firstName.trim() || !lastName.trim() || !email || !password || !confirmPassword}
        >
          {submitting ? "Creating Account..." : "Create Account"}
        </button>
        
        {/* Legal text */}
        <div className="text-xs text-gray-500 text-center mb-4">
          By creating an account, you agree to our{' '}
          <Link to="/terms" className="underline hover:text-cyan-700">Terms & Conditions</Link> and{' '}
          <Link to="/privacy" className="underline hover:text-cyan-700">Privacy Policy</Link>.
        </div>

        {/* Footer Links */}
        <div className="w-full flex flex-col gap-2 text-center">
          <span className="text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="text-cyan-700 font-semibold hover:underline">Sign In</Link>
          </span>
        </div>
      </form>
    </div>
  );
} 