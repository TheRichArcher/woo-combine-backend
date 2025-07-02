import React, { useState, useEffect } from "react";
import WelcomeLayout from "../components/layouts/WelcomeLayout";
import { useAuth, useLogout } from "../context/AuthContext";
import { sendEmailVerification } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { auth } from "../firebase";

// Mailbox SVG Component (similar to MOJO design)
const MailboxIcon = () => (
  <svg
    width="120"
    height="120"
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="mx-auto mb-8"
  >
    {/* Mailbox body */}
    <rect
      x="25"
      y="40"
      width="60"
      height="35"
      rx="8"
      fill="#e5e7eb"
      stroke="#9ca3af"
      strokeWidth="2"
    />
    {/* Mailbox flag */}
    <rect
      x="75"
      y="35"
      width="15"
      height="8"
      rx="2"
      fill="#ec4899"
    />
    {/* Mailbox post */}
    <rect
      x="52"
      y="75"
      width="6"
      height="25"
      fill="#9ca3af"
    />
    {/* Ground grass */}
    <ellipse cx="35" cy="100" rx="8" ry="3" fill="#10b981" />
    <ellipse cx="55" cy="102" rx="6" ry="2" fill="#10b981" />
    <ellipse cx="75" cy="100" rx="7" ry="3" fill="#10b981" />
    {/* Envelope in mailbox */}
    <rect
      x="35"
      y="48"
      width="20"
      height="12"
      rx="2"
      fill="white"
      stroke="#6366f1"
      strokeWidth="2"
    />
    {/* Envelope lines */}
    <line x1="37" y1="52" x2="53" y2="52" stroke="#6366f1" strokeWidth="1" />
    <line x1="37" y1="55" x2="48" y2="55" stroke="#6366f1" strokeWidth="1" />
    {/* Magic sparkles */}
    <circle cx="20" cy="30" r="2" fill="#fbbf24" />
    <circle cx="95" cy="25" r="1.5" fill="#fbbf24" />
    <circle cx="15" cy="60" r="1" fill="#fbbf24" />
  </svg>
);

export default function VerifyEmail() {
  const { user, setUser } = useAuth();
  const [resendStatus, setResendStatus] = useState("");
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const navigate = useNavigate();
  const [isVerified, setIsVerified] = useState(false);
  const logout = useLogout();

  // Check if user came back from verification link
  const urlParams = new URLSearchParams(window.location.search);
  const justVerified = urlParams.get('verified') === 'true';

  // Handle users who just clicked verification link
  useEffect(() => {
    if (justVerified && auth.currentUser) {
      const checkAndRedirect = async () => {
        try {
          await auth.currentUser.reload();
          await auth.currentUser.getIdToken(true); // Force token refresh
          
          if (auth.currentUser.emailVerified) {
            setUser(auth.currentUser);
            setIsVerified(true);
            // Clear URL parameter and redirect
            window.history.replaceState({}, document.title, '/verify-email');
            navigate("/select-role");
          }
        } catch (error) {
          console.log('Auto-verification check failed:', error);
        }
      };
      
      checkAndRedirect();
    }
  }, [justVerified, setUser, navigate]);

  // Auto-refresh every 10s to check verification
  useEffect(() => {
    let isActive = true; // Flag to prevent state updates after unmount
    
    const checkVerified = async () => {
      // Only run if component is still active and we're on the verify-email page
      if (!isActive || window.location.pathname !== '/verify-email') {
        return;
      }
      
      if (auth.currentUser) {
        try {
          await auth.currentUser.reload();
          
          // Only proceed if component is still active
          if (!isActive) return;
          
          setIsVerified(auth.currentUser.emailVerified);
          if (auth.currentUser.emailVerified) {
            // Clear the interval before navigating to prevent further runs
            clearInterval(interval);
            // Force refresh of ID token after verification
            await auth.currentUser.getIdToken(true);
            
            // Only update state if component is still active
            if (isActive) {
              setUser(auth.currentUser);
              navigate("/select-role");
            }
          }
        } catch (error) {
          // Silently handle errors to prevent interference
          console.log('Verification check failed:', error);
        }
      }
    };
    
    // Initial check
    checkVerified();
    
    // Set up interval
    const interval = setInterval(checkVerified, 10000);
    
    // Cleanup function
    return () => {
      isActive = false;
      clearInterval(interval);
    };
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
    // Don't run manual check if we're not on the verify-email page
    if (window.location.pathname !== '/verify-email') {
      return;
    }
    
    setChecking(true);
    try {
      if (auth.currentUser) {
        await auth.currentUser.reload();
        setIsVerified(auth.currentUser.emailVerified);
        if (auth.currentUser.emailVerified) {
          // Force refresh of ID token after verification
          await auth.currentUser.getIdToken(true);
          setUser(auth.currentUser);
          navigate("/select-role");
        } else {
          setResendStatus("Still not verified. Please check your email.");
        }
      }
    } catch (error) {
      // Verification check failed
      console.log('Manual verification check failed:', error);
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
        
        // Send with redirect URL to ensure users come back to our app
        const actionCodeSettings = {
          url: `${window.location.origin}/verify-email?verified=true`,
          handleCodeInApp: true,
        };
        
        try {
          await sendEmailVerification(auth.currentUser, actionCodeSettings);
          setResendStatus("Verification email sent!");
        } catch (error) {
          // Fallback without action code settings
          await sendEmailVerification(auth.currentUser);
          setResendStatus("Verification email sent!");
        }
      } else {
        setResendStatus("User not found. Please log in again.");
      }
    } catch {
      setResendStatus("Failed to resend. Try again later.");
      // Email resend failed
    } finally {
      setResending(false);
    }
  };

  // Open email app (attempt to open default email client without composing)
  const handleOpenEmailApp = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    
    try {
      if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
        // iOS - open Mail app
        window.location.href = 'message://';
      } else if (userAgent.includes('android')) {
        // Android - open default email app
        window.location.href = 'intent://view#Intent;scheme=mailto;end';
      } else {
        // Desktop - provide helpful instructions instead of opening new email
        alert('Please open your email app manually to check for the verification email.\n\nLook for an email from WooCombine and click the verification link inside.');
      }
    } catch {
      // Fallback if URL schemes don't work
      alert('Please open your email app manually to check for the verification email.\n\nLook for an email from WooCombine and click the verification link inside.');
    }
  };

  return (
    <WelcomeLayout contentClassName="min-h-screen" hideHeader={true} showOverlay={false}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl mx-4 flex flex-col relative min-h-[600px]">
        {/* Header Row: Back + Help */}
        <div className="w-full flex flex-row justify-between items-center p-6 pb-2">
          <button
            className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 focus:outline-none transition"
            type="button"
            aria-label="Back to welcome"
            onClick={() => navigate("/welcome")}
          >
            <ArrowLeft size={20} />
          </button>
          <button
            className="text-sm text-cyan-600 hover:text-cyan-800 font-medium"
            onClick={() => navigate("/help")}
          >
            Need Help?
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col px-6 pb-6">
          {/* Logo */}
          <div className="text-center mt-4 mb-6">
            <img
              src="/favicon/woocombine-logo.png"
              alt="Woo-Combine Logo"
              className="w-16 h-16 mx-auto mb-4"
              style={{ objectFit: 'contain' }}
            />
          </div>

          {/* Main Title - Bold like MOJO */}
          <h1 className="text-2xl font-black text-gray-900 text-center mb-6 tracking-tight">
            CHECK YOUR EMAIL
          </h1>

          {/* Description - Clear and concise like MOJO */}
          <div className="text-center mb-6">
            <p className="text-gray-700 text-base leading-relaxed mb-4">
              We sent an email to{' '}
              <span className="font-semibold text-gray-900 break-all">
                {user?.email || "your email address"}
              </span>{' '}
              with a link to verify your WooCombine account.
            </p>
            <p className="text-gray-600 text-sm leading-relaxed">
              It might take a few minutes. If you don't see our email in your inbox, please check your spam or 
              promo folders. If you see multiple emails, make sure you're selecting the most recent verification email.
            </p>
          </div>

          {/* Mailbox Illustration */}
          <div className="flex-1 flex items-center justify-center py-4">
            <MailboxIcon />
          </div>

          {/* Primary Action Button - Like MOJO's "Open Email App" */}
          <div className="mt-8 space-y-4">
            {isVerified ? (
              <button
                onClick={() => navigate("/select-role")}
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-4 rounded-xl shadow-lg transition-all duration-200 transform hover:scale-[1.02]"
              >
                Continue to App
              </button>
            ) : (
              <button
                onClick={handleOpenEmailApp}
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-4 rounded-xl shadow-lg transition-all duration-200 transform hover:scale-[1.02]"
              >
                Open Email App
              </button>
            )}

            {/* Check Again Button (secondary action) */}
            {!isVerified && (
              <button
                onClick={handleCheckAgain}
                disabled={checking}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-xl transition-colors duration-200 disabled:opacity-50"
              >
                {checking ? "Checking..." : "I've verified my email"}
              </button>
            )}

            {/* Status Messages */}
            {!isVerified && (
              <div className="text-red-600 text-sm text-center">
                We haven't detected your email verification yet. Please check your inbox and try again.
              </div>
            )}
            
            {resendStatus && (
              <div className={`text-sm text-center ${resendStatus.includes('sent') ? 'text-green-600' : 'text-red-600'}`}>
                {resendStatus}
              </div>
            )}

            {!auth.currentUser && (
              <div className="text-red-600 text-sm text-center">
                User session expired. Please log in again.
              </div>
            )}
          </div>
        </div>

        {/* Bottom Actions - Like MOJO */}
        <div className="px-6 pb-6 pt-4 border-t border-gray-100 space-y-3">
          <button
            onClick={handleResend}
            disabled={resending}
            className="w-full text-cyan-600 hover:text-cyan-800 font-medium py-2 transition-colors duration-200 disabled:opacity-50"
          >
            {resending ? "Sending..." : "Resend Email"}
          </button>
          
          <button
            onClick={() => navigate("/help")}
            className="w-full text-cyan-600 hover:text-cyan-800 font-medium py-2 transition-colors duration-200"
          >
            Contact Support
          </button>

          {/* Session Management */}
          {!auth.currentUser ? (
            <button
              onClick={() => { 
                localStorage.clear(); 
                sessionStorage.clear(); 
                navigate('/welcome', { replace: true }); 
              }}
              className="w-full text-gray-500 hover:text-gray-700 font-medium py-2 transition-colors duration-200"
            >
              Return to Welcome
            </button>
          ) : (
            <button
              onClick={async () => { 
                try {
                  await logout(); 
                  navigate('/welcome'); 
                } catch {
                  navigate('/welcome'); // Still navigate even if logout fails
                }
              }}
              className="w-full text-gray-500 hover:text-gray-700 font-medium py-2 transition-colors duration-200"
            >
              Log Out
            </button>
          )}
        </div>
      </div>
    </WelcomeLayout>
  );
} 