import React, { useState, useEffect } from "react";
import WelcomeLayout from "../components/layouts/WelcomeLayout";
import { useAuth, useLogout } from "../context/AuthContext";
import { sendEmailVerification } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { auth } from "../firebase";

export default function VerifyEmail() {
  const { user, setUser } = useAuth();
  const [resendStatus, setResendStatus] = useState("");
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const navigate = useNavigate();
  const [isVerified, setIsVerified] = useState(false);
  const logout = useLogout();

  // Auto-refresh every 10s to check verification
  useEffect(() => {
    const checkVerified = async () => {
      if (auth.currentUser) {
        await auth.currentUser.reload();
        setIsVerified(auth.currentUser.emailVerified);
        if (auth.currentUser.emailVerified) {
          // Force refresh of ID token after verification
          await auth.currentUser.getIdToken(true);
          setUser(auth.currentUser);
          navigate("/dashboard");
        }
      }
    };
    checkVerified();
    const interval = setInterval(checkVerified, 10000);
    return () => clearInterval(interval);
  }, [navigate, setUser]);

  // Auto-redirect to /welcome if session expired
  useEffect(() => {
    if (!auth.currentUser) {
      const timeout = setTimeout(() => {
        localStorage.clear();
        sessionStorage.clear();
        navigate('/welcome', { replace: true });
      }, 2500);
      return () => clearTimeout(timeout);
    }
  }, [navigate]);

  // Manual check
  const handleCheckAgain = async () => {
    setChecking(true);
    try {
      if (auth.currentUser) {
        await auth.currentUser.reload();
        setIsVerified(auth.currentUser.emailVerified);
        if (auth.currentUser.emailVerified) {
          // Force refresh of ID token after verification
          await auth.currentUser.getIdToken(true);
          setUser(auth.currentUser);
          navigate("/dashboard");
        } else {
          setResendStatus("Still not verified. Please check your email.");
        }
      }
    } catch (err) {
      setResendStatus("Error checking verification status.");
    } finally {
      setChecking(false);
    }
  };

  // Resend email
  const handleResend = async () => {
    setResending(true);
    setResendStatus("");
    try {
      console.log("[VerifyEmail] auth.currentUser:", auth.currentUser);
      if (auth.currentUser) {
        await auth.currentUser.reload();
        // Log emailVerified and token expiration
        const tokenResult = await auth.currentUser.getIdTokenResult();
        console.log("[VerifyEmail] emailVerified:", auth.currentUser.emailVerified);
        console.log("[VerifyEmail] token expiration:", tokenResult.expirationTime);
        await sendEmailVerification(auth.currentUser);
        setResendStatus("Verification email sent!");
      } else {
        setResendStatus("User not found. Please log in again.");
      }
    } catch (err) {
      setResendStatus((err?.message || "Failed to resend. Try again later.") + (err?.code ? ` (code: ${err.code})` : ""));
      console.error("Resend verification error:", err);
      if (err.code) console.error("[Firebase Error Code]", err.code);
      if (err.message) console.error("[Firebase Error Message]", err.message);
    } finally {
      setResending(false);
    }
  };

  // UI: align header row and buttons like /signup
  return (
    <WelcomeLayout contentClassName="min-h-[70vh]" hideHeader={true} showOverlay={false}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 sm:p-10 flex flex-col items-center relative">
        {/* Header Row: Back + Help, match /signup */}
        <div className="w-full flex flex-row justify-between items-center pt-2 pb-2 px-2 mb-2">
          <button
            className="w-9 h-9 flex items-center justify-center rounded-full bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 shadow text-cyan-700 hover:text-cyan-900 focus:outline-none"
            type="button"
            aria-label="Back to welcome"
            onClick={() => navigate("/welcome")}
          >
            <ArrowLeft size={20} />
          </button>
          <button
            className="text-xs text-cyan-700 hover:underline font-semibold"
            onClick={() => navigate("/help")}
          >
            Need Help?
          </button>
        </div>
        {/* Logo */}
        <img
          src="/favicon/ChatGPT Image May 21, 2025, 05_33_34 PM.png"
          alt="Woo-Combine Logo"
          className="w-20 h-20 mx-auto mb-4 mt-8"
          style={{ objectFit: 'contain' }}
        />
        {/* Title */}
        <h2 className="text-3xl font-extrabold mb-6 text-center text-cyan-700 drop-shadow">Verify Your Email</h2>
        {/* Subtext */}
        <p className="text-gray-700 text-center mb-2">
          We've sent a verification link to your email address:
        </p>
        <div className="text-lg font-bold text-cyan-700 text-center mb-2 break-all">{user?.email || "your email"}</div>
        <p className="text-gray-700 text-center mb-6">
          Please check your inbox and confirm your email to continue.<br/>
          <span className="text-cyan-700 font-semibold">Didn't receive the email? Check your spam folder or promotions tab.</span>
        </p>
        {/* CTA to go to app after verifying */}
        {isVerified ? (
          <a
            href="/dashboard"
            className="w-full bg-cmf-primary hover:bg-cmf-secondary text-white font-bold px-6 py-3 rounded-full shadow transition mb-5 block text-center"
            style={{ maxWidth: 320 }}
          >
            Go to App
          </a>
        ) : (
          <button
            className="w-full bg-cmf-primary hover:bg-cmf-secondary text-white font-bold px-6 py-3 rounded-full shadow transition mb-5 block text-center"
            style={{ maxWidth: 320 }}
            onClick={handleCheckAgain}
            disabled={checking}
          >
            {checking ? "Checking..." : "Check Again"}
          </button>
        )}
        {!isVerified && (
          <div className="text-red-600 text-sm mt-1 text-center w-full">
            We haven't detected your email verification yet. Please check your inbox and try again.
          </div>
        )}
        <a
          href="/help"
          className="w-full text-sm text-gray-500 underline hover:text-cyan-700 text-center block mb-6"
          style={{ maxWidth: 320 }}
        >
          Contact Support
        </a>
        {resendStatus && <div className="text-red-600 text-sm mt-1 text-center w-full">{resendStatus}</div>}
        {!auth.currentUser && <div className="text-red-600 text-sm mt-1 text-center w-full">User session expired. Please log in again.</div>}
        {/* Return to Welcome Button if session expired */}
        {!auth.currentUser && (
          <button
            className="w-full bg-cmf-primary hover:bg-cmf-secondary text-white font-bold px-6 py-3 rounded-full shadow transition mb-2 block text-center mt-2"
            style={{ maxWidth: 320 }}
            onClick={() => { localStorage.clear(); sessionStorage.clear(); navigate('/welcome', { replace: true }); }}
          >
            Return to Welcome
          </button>
        )}
        {/* Log Out Button (only if session is active) */}
        {auth.currentUser && (
          <button
            className="w-full bg-gray-200 text-cyan-700 font-bold px-6 py-3 rounded-full shadow transition mb-2 block text-center mt-2"
            style={{ maxWidth: 320 }}
            onClick={async () => { await logout(); navigate('/welcome'); }}
          >
            Log Out
          </button>
        )}
      </div>
    </WelcomeLayout>
  );
} 