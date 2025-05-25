import React, { useState, useEffect } from "react";
import WelcomeLayout from "../components/layouts/WelcomeLayout";
import { useAuth } from "../context/AuthContext";
import { sendEmailVerification } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { auth } from "../firebase";

export default function VerifyEmail() {
  const { user } = useAuth();
  const [resendStatus, setResendStatus] = useState("");
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const navigate = useNavigate();

  // Auto-refresh every 10s to check verification
  useEffect(() => {
    const interval = setInterval(async () => {
      if (auth.currentUser) {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified) {
          navigate("/dashboard");
        }
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [navigate]);

  // Manual check
  const handleCheckAgain = async () => {
    setChecking(true);
    try {
      if (auth.currentUser) {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified) {
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
      if (auth.currentUser) {
        await auth.currentUser.reload();
        await sendEmailVerification(auth.currentUser);
        setResendStatus("Verification email sent!");
      } else {
        setResendStatus("User not found. Please log in again.");
      }
    } catch (err) {
      setResendStatus(err?.message || "Failed to resend. Try again later.");
      console.error("Resend verification error:", err);
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
          Please check your inbox and confirm your email to continue.
        </p>
        {/* Instruction instead of Open Email App button */}
        <div className="w-full text-center text-cyan-700 font-semibold mb-3 text-base">
          Please check your email inbox in another tab or app.
        </div>
        <button
          className="w-full bg-white border border-cyan-700 text-cyan-700 font-bold px-6 py-3 rounded-full shadow transition mb-5 disabled:opacity-60"
          style={{ maxWidth: 320 }}
          onClick={handleResend}
          disabled={resending || !auth.currentUser}
        >
          {resending ? "Resending..." : "Resend Email"}
        </button>
        <button
          className="w-full bg-white border border-gray-300 text-gray-700 font-bold px-6 py-3 rounded-full shadow transition mb-5 disabled:opacity-60"
          style={{ maxWidth: 320 }}
          onClick={handleCheckAgain}
          disabled={checking}
        >
          {checking ? "Checking..." : "Check Again"}
        </button>
        <a
          href="/help"
          className="w-full text-sm text-gray-500 underline hover:text-cyan-700 text-center block mb-6"
          style={{ maxWidth: 320 }}
        >
          Contact Support
        </a>
        {resendStatus && <div className="text-red-600 text-sm mt-1 text-center w-full">{resendStatus}</div>}
        {!auth.currentUser && <div className="text-red-600 text-sm mt-1 text-center w-full">User session expired. Please log in again.</div>}
      </div>
    </WelcomeLayout>
  );
} 