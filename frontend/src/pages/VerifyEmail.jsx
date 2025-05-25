import React, { useState } from "react";
import WelcomeLayout from "../components/layouts/WelcomeLayout";
import { useAuth } from "../context/AuthContext";
import { sendEmailVerification } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function VerifyEmail() {
  const { user } = useAuth();
  const [resendStatus, setResendStatus] = useState("");
  const [resending, setResending] = useState(false);
  const navigate = useNavigate();

  const handleResend = async () => {
    if (!user) return;
    setResending(true);
    setResendStatus("");
    try {
      await sendEmailVerification(user);
      setResendStatus("Verification email sent!");
    } catch (err) {
      setResendStatus("Failed to resend. Try again later.");
    } finally {
      setResending(false);
    }
  };

  return (
    <WelcomeLayout
      contentClassName="min-h-[70vh]"
      hideHeader={true}
      showOverlay={false}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 sm:p-10 flex flex-col items-center relative">
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
        <button
          className="absolute right-4 top-4 text-xs text-cyan-700 hover:underline font-semibold"
          style={{ right: 0, top: 0, position: 'absolute' }}
          onClick={() => navigate("/help")}
        >
          Need Help?
        </button>
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
        {/* Buttons */}
        <button
          className="w-full bg-cyan-700 hover:bg-cyan-800 text-white font-bold py-3 rounded-full shadow transition mb-3"
          style={{ maxWidth: 320 }}
          onClick={() => console.log('TODO: Open mail client')}
        >
          Open Email App
        </button>
        <button
          className="w-full bg-white border border-cyan-700 text-cyan-700 font-bold py-3 rounded-full shadow transition mb-3 disabled:opacity-60"
          style={{ maxWidth: 320 }}
          onClick={handleResend}
          disabled={resending}
        >
          {resending ? "Resending..." : "Resend Email"}
        </button>
        <a
          href="/help"
          className="w-full text-sm text-gray-500 underline hover:text-cyan-700 text-center block mb-2"
          style={{ maxWidth: 320 }}
        >
          Contact Support
        </a>
        {resendStatus && <div className="text-green-600 text-sm mt-1 text-center w-full">{resendStatus}</div>}
      </div>
    </WelcomeLayout>
  );
} 