import React, { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../firebase";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess(true);
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        setFormError("No account found with that email.");
      } else if (err.code === "auth/invalid-email") {
        setFormError("Please enter a valid email address.");
      } else {
        setFormError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Header Row: Back + Help */}
      <div className="w-full flex flex-row justify-between items-center mb-6 px-2">
        <button
          className="w-9 h-9 flex items-center justify-center rounded-full bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 shadow text-cyan-700 hover:text-cyan-900 focus:outline-none"
          type="button"
          aria-label="Back to login"
          onClick={() => navigate("/login")}
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
      {/* Heading */}
      <h2 className="text-3xl font-extrabold mb-6 text-center text-cyan-700 drop-shadow">Reset Password</h2>
      {success ? (
        <div className="w-full text-center text-green-700 font-semibold mb-4">
          Check your email for a password reset link.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="w-full flex flex-col items-center">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full mb-6 px-4 py-3 border border-cyan-200 rounded-full focus:ring-2 focus:ring-cyan-700 focus:border-cyan-700 transition"
            required
          />
          {formError && <div className="text-red-500 mb-4 text-sm w-full text-center">{formError}</div>}
          <button
            type="submit"
            className="w-full bg-cyan-700 hover:bg-cyan-800 text-white font-bold px-6 py-3 rounded-full shadow transition mb-4"
            disabled={submitting}
          >
            {submitting ? "Sending..." : "Send Reset Email"}
          </button>
        </form>
      )}
      {/* Footer Links */}
      <div className="w-full flex flex-col gap-2 mt-2 text-center">
        <span className="text-sm text-gray-600">
          Remembered your password?{' '}
          <Link to="/login" className="text-cyan-700 font-semibold hover:underline">Back to Login</Link>
        </span>
        <span className="text-sm">
          <Link to="/signup" className="text-cyan-700 hover:underline">Don't have an account? Let's Get Started</Link>
        </span>
      </div>
    </>
  );
} 