import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { applyActionCode } from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../context/AuthContext";
import WelcomeLayout from "../components/layouts/WelcomeLayout";

// Simple helper to parse query params
function useQuery() {
  const { search } = useLocation();
  return React.useMemo(() => new URLSearchParams(search), [search]);
}

export default function EmailAction() {
  const query = useQuery();
  const navigate = useNavigate();
  const { setUser, user } = useAuth();

  const [status, setStatus] = useState("processing"); // processing | success | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    const mode = query.get("mode");
    const oobCode = query.get("oobCode");

    const handleAction = async () => {
      try {
        if (!mode || !oobCode) {
          throw new Error("Invalid verification link. Please try again from the original tab.");
        }

        if (mode === 'verifyEmail') {
          await applyActionCode(auth, oobCode);
          
          setStatus("success");
          setMessage("Your email has been verified. Please close this window and use the other one.");
          
          // Attempt to notify the original tab
          try {
            localStorage.setItem('email_verified', 'true');
          } catch (e) {
            console.warn("Could not set localStorage flag for cross-tab communication.");
          }

        } else {
          throw new Error("Unsupported action. Please contact support.");
        }
      } catch (error) {
        setStatus("error");
        setMessage(error.message || "An unknown error occurred.");
      }
    };

    handleAction();
  }, [query, navigate, setUser]);

  return (
    <WelcomeLayout contentClassName="min-h-screen" hideHeader={true} showOverlay={false}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl mx-4 p-8 text-center">
        <img src="/favicon/woocombine-logo.png" alt="Woo-Combine Logo" className="w-16 h-16 mx-auto mb-6" style={{ objectFit: 'contain' }} />
        {status === "processing" && (
          <>
            <h2 className="text-2xl font-bold mb-3">Verifying your email…</h2>
            <p className="text-gray-600">Please wait a moment.</p>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 mx-auto mt-6" />
          </>
        )}
        {status === "success" && (
          <>
            <h2 className="text-2xl font-bold text-green-600 mb-3">Success! Email Verified.</h2>
            <p className="text-gray-700 mb-6 font-semibold">{message}</p>
            
            <button
              onClick={() => window.close()}
              className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-3 rounded-xl transition mb-3"
            >
              Close this Tab
            </button>
            
            <p className="text-gray-500 text-sm">
              This tab was opened only to verify your email.
            </p>
          </>
        )}
        {status === "error" && (
          <>
            <h2 className="text-2xl font-bold text-red-600 mb-3">Verification Issue</h2>
            <p className="text-gray-700 mb-6">{message}</p>
            <button onClick={() => navigate('/login')} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-3 rounded-xl">
              Back to Login
            </button>
          </>
        )}
      </div>
    </WelcomeLayout>
  );
}


