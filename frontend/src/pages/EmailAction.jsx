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
  const { setUser } = useAuth();

  const [status, setStatus] = useState("processing"); // processing | success | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    const mode = query.get("mode");
    const oobCode = query.get("oobCode");

    // If no mode/code in URL, try graceful handling: if already verified, send to next step; else redirect to verify-email.
    if (!mode || !oobCode) {
      (async () => {
        try {
          if (auth.currentUser) {
            await auth.currentUser.reload();
            if (auth.currentUser.emailVerified) {
              await auth.currentUser.getIdToken(true);
              setUser(auth.currentUser);
              navigate('/verify-email', { replace: true });
              return;
            }
          }
        } catch {}
        setStatus('error');
        setMessage('Invalid verification link.');
      })();
      return;
    }

    const handle = async () => {
      const redirectToNext = () => {
        const pendingEventJoin = localStorage.getItem("pendingEventJoin");
        if (pendingEventJoin) {
          const safePath = pendingEventJoin
            .split("/")
            .map((part) => encodeURIComponent(part))
            .join("/");
          navigate(`/join-event/${safePath}`, { replace: true });
        } else {
          navigate("/select-role", { replace: true });
        }
      };

      try {
        if (mode === "verifyEmail") {
          // Fast-path: If the user is already verified (e.g., link used in another tab),
          // treat this as success and redirect instead of showing an error.
          if (auth.currentUser) {
            await auth.currentUser.reload();
            if (auth.currentUser.emailVerified) {
              await auth.currentUser.getIdToken(true);
              setUser(auth.currentUser);
              setStatus("success");
              setMessage("Your email is already verified. Redirecting...");
              setTimeout(redirectToNext, 800);
              return;
            }
          }

          await applyActionCode(auth, oobCode);
          // Refresh current user to pick up verified flag
          if (auth.currentUser) {
            await auth.currentUser.reload();
            await auth.currentUser.getIdToken(true);
            setUser(auth.currentUser);
          }
          setStatus("success");
          setMessage("Email verified. Redirecting...");
          // Short delay for UX; then go
          setTimeout(redirectToNext, 800);
          return;
        }

        // Unknown mode
        setStatus("error");
        setMessage("Unsupported action.");
      } catch (err) {
        // If verification code is invalid/expired but the user is already verified,
        // handle gracefully and redirect.
        if (mode === "verifyEmail" && auth.currentUser) {
          try {
            await auth.currentUser.reload();
            if (auth.currentUser.emailVerified) {
              await auth.currentUser.getIdToken(true);
              setUser(auth.currentUser);
              setStatus("success");
              setMessage("Your email is already verified. Redirecting...");
              setTimeout(redirectToNext, 800);
              return;
            }
          } catch {
            // fall through to error below
          }
        }
        setStatus("error");
        setMessage("Verification failed or link expired. Try resending the email.");
      }
    };

    handle();
  }, [navigate, query, setUser]);

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
            <h2 className="text-2xl font-bold text-green-600 mb-3">Success!</h2>
            <p className="text-gray-700 mb-4">{message}</p>
            <button
              onClick={() => {
                try { window.close(); } catch {}
              }}
              className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-3 rounded-xl transition mb-3"
            >
              Return to original tab
            </button>
            <p className="text-gray-500 text-sm">
              You can now return to the original tab to finish setting up your account. This tab was opened just to verify your email. You can close it.
            </p>
            <div className="mt-4">
              <button
                onClick={() => navigate('/welcome')}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 rounded-xl transition"
              >
                Go to Welcome (fallback)
              </button>
            </div>
          </>
        )}
        {status === "error" && (
          <>
            <h2 className="text-2xl font-bold text-red-600 mb-3">Verification issue</h2>
            <p className="text-gray-700 mb-6">{message}</p>
            <button onClick={() => navigate('/verify-email')} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-3 rounded-xl">
              Go to Verification Help
            </button>
          </>
        )}
      </div>
    </WelcomeLayout>
  );
}


