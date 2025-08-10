import React, { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../firebase";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Button from "../ui/Button";

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
        className="w-9 h-9 flex items-center justify-center rounded-full bg-brand-primary/10 hover:bg-brand-primary/20 border border-brand-primary/20 shadow text-brand-primary hover:opacity-90 focus:outline-none"
          type="button"
          aria-label="Back to login"
          onClick={() => navigate("/login")}
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
      {/* Heading */}
  <h2 className="text-3xl font-extrabold mb-6 text-center text-brand-primary drop-shadow">Reset Password</h2>
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
            className="w-full mb-6 px-4 py-3 border border-brand-primary/20 rounded-full focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition"
            required
          />
          {formError && <div className="text-red-500 mb-4 text-sm w-full text-center">{formError}</div>}
          <Button type="submit" size="lg" className="w-full mb-4" disabled={submitting}>
            {submitting ? "Sending..." : "Send Reset Email"}
          </Button>
        </form>
      )}
      {/* Footer Links */}
      <div className="w-full flex flex-col gap-2 mt-2 text-center">
        <span className="text-sm text-gray-600">
          Remembered your password?{' '}
        <Link to="/login" className="text-brand-primary font-semibold hover:underline">Back to Login</Link>
        </span>
        <span className="text-sm">
        <Link to="/signup" className="text-brand-primary hover:underline">Don't have an account? Let's Get Started</Link>
        </span>
      </div>
    </>
  );
} 