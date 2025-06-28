import React, { useState, useEffect } from "react";
import { signInWithPhoneNumber, RecaptchaVerifier } from "firebase/auth";
import { auth } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Phone, MessageSquare } from "lucide-react";

export default function LoginForm() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [step, setStep] = useState(1); // 1: phone input, 2: verification code
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState(null);
  const { loading } = useAuth();
  const navigate = useNavigate();

  // Initialize reCAPTCHA verifier
  useEffect(() => {
    const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
      callback: () => {
        // reCAPTCHA solved
      }
    });
    setRecaptchaVerifier(verifier);
    
    return () => {
      if (verifier) {
        verifier.clear();
      }
    };
  }, []);

  const formatPhoneNumber = (value) => {
    // Remove all non-digits
    const phoneNumber = value.replace(/\D/g, '');
    
    // Format as US phone number
    if (phoneNumber.length === 0) return phoneNumber;
    if (phoneNumber.length <= 3) return phoneNumber;
    if (phoneNumber.length <= 6) return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
  };

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    
    try {
      // Convert formatted phone to E.164 format
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      const e164Phone = `+1${cleanPhone}`; // Assuming US numbers
      
      if (cleanPhone.length !== 10) {
        setFormError("Please enter a valid 10-digit phone number.");
        setSubmitting(false);
        return;
      }
      
      const confirmation = await signInWithPhoneNumber(auth, e164Phone, recaptchaVerifier);
      setConfirmationResult(confirmation);
      setStep(2);
    } catch (err) {
      console.error("Phone sign-in error:", err);
      if (err.code === "auth/too-many-requests") {
        setFormError("Too many attempts. Please try again later.");
      } else if (err.code === "auth/invalid-phone-number") {
        setFormError("Invalid phone number. Please check and try again.");
      } else {
        setFormError("Failed to send verification code. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCodeSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    
    try {
      if (!confirmationResult) {
        setFormError("No verification pending. Please restart the process.");
        setStep(1);
        setSubmitting(false);
        return;
      }
      
      await confirmationResult.confirm(verificationCode);
      // Let AuthContext handle the navigation logic for verified users
    } catch (err) {
      console.error("Code verification error:", err);
      if (err.code === "auth/invalid-verification-code") {
        setFormError("Invalid verification code. Please check and try again.");
      } else if (err.code === "auth/code-expired") {
        setFormError("Verification code expired. Please request a new one.");
        setStep(1);
        setConfirmationResult(null);
      } else {
        setFormError("Verification failed. Please try again.");
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
          onClick={() => {
            if (step === 2) {
              setStep(1);
              setVerificationCode("");
              setFormError("");
            } else {
              navigate("/welcome");
            }
          }}
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

      {/* Step 1: Phone Number Input */}
      {step === 1 && (
        <>
          <h2 className="text-3xl font-extrabold mb-6 text-center text-cyan-700 drop-shadow">Welcome Back</h2>
          <div className="w-full bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Phone className="w-5 h-5 text-blue-600" />
              <p className="text-blue-800 font-medium text-sm">Secure Phone Sign-In</p>
            </div>
            <p className="text-blue-700 text-sm">
              Enter your phone number and we'll send you a verification code via SMS.
            </p>
          </div>
          
          <form onSubmit={handlePhoneSubmit} className="w-full flex flex-col items-center">
            <div className="relative w-full mb-6">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-700" />
              <input
                type="tel"
                placeholder="(555) 123-4567"
                value={phoneNumber}
                onChange={e => setPhoneNumber(formatPhoneNumber(e.target.value))}
                className="w-full pl-12 pr-4 py-3 border border-cyan-200 rounded-full focus:ring-2 focus:ring-cyan-700 focus:border-cyan-700 transition"
                autoComplete="tel"
                required
                maxLength={14}
              />
            </div>
            
            {formError && <div className="text-red-500 mb-4 text-sm w-full text-center">{formError}</div>}
            
            <button
              type="submit"
              className="w-full bg-cyan-700 hover:bg-cyan-800 text-white font-bold px-6 py-3 rounded-full shadow transition mb-4 disabled:opacity-50"
              disabled={submitting || phoneNumber.replace(/\D/g, '').length !== 10}
            >
              {submitting ? "Sending Code..." : "Send Verification Code"}
            </button>

            {/* Footer Links */}
            <div className="w-full flex flex-col gap-2 mt-2 text-center">
              <span className="text-sm text-gray-600">
                Don't have an account?{' '}
                <Link to="/signup" className="text-cyan-700 font-semibold hover:underline">Let's Get Started</Link>
              </span>
            </div>
          </form>
        </>
      )}

      {/* Step 2: Verification Code Input */}
      {step === 2 && (
        <>
          <h2 className="text-3xl font-extrabold mb-6 text-center text-cyan-700 drop-shadow">Enter Verification Code</h2>
          <div className="w-full bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-5 h-5 text-green-600" />
              <p className="text-green-800 font-medium text-sm">Code Sent!</p>
            </div>
            <p className="text-green-700 text-sm">
              We sent a 6-digit verification code to <strong>{phoneNumber}</strong>
            </p>
          </div>
          
          <form onSubmit={handleCodeSubmit} className="w-full flex flex-col items-center">
            <input
              type="text"
              placeholder="123456"
              value={verificationCode}
              onChange={e => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full mb-6 px-4 py-3 border border-cyan-200 rounded-full focus:ring-2 focus:ring-cyan-700 focus:border-cyan-700 transition text-center text-2xl font-mono tracking-wider"
              autoComplete="one-time-code"
              required
              maxLength={6}
              autoFocus
            />
            
            {formError && <div className="text-red-500 mb-4 text-sm w-full text-center">{formError}</div>}
            
            <button
              type="submit"
              className="w-full bg-cyan-700 hover:bg-cyan-800 text-white font-bold px-6 py-3 rounded-full shadow transition mb-4 disabled:opacity-50"
              disabled={submitting || verificationCode.length !== 6}
            >
              {submitting ? "Verifying..." : "Verify & Sign In"}
            </button>

            {/* Resend Code Option */}
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setVerificationCode("");
                setFormError("");
                setConfirmationResult(null);
              }}
              className="text-sm text-cyan-700 hover:underline"
            >
              Wrong number? Go back
            </button>
          </form>
        </>
      )}

      {/* Hidden reCAPTCHA container */}
      <div id="recaptcha-container"></div>
    </>
  );
} 