import React, { useState, useEffect } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { user, loading, error } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (user) return null;

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
        src="/favicon/ChatGPT Image May 21, 2025, 05_33_34 PM.png"
        alt="Woo-Combine Logo"
        className="w-20 h-20 mx-auto mb-4 mt-8"
        style={{ objectFit: 'contain' }}
      />
      {/* Heading */}
      <h2 className="text-3xl font-extrabold mb-6 text-center text-cyan-700 drop-shadow">Let's Sign In</h2>
      <form onSubmit={handleSubmit} className="w-full flex flex-col items-center">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full mb-6 px-4 py-3 border border-cyan-200 rounded-full focus:ring-2 focus:ring-cyan-700 focus:border-cyan-700 transition"
          required
        />
        <div className="relative w-full mb-6">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-4 py-3 border border-cyan-200 rounded-full focus:ring-2 focus:ring-cyan-700 focus:border-cyan-700 transition pr-12"
            required
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-700 hover:text-cyan-900"
            tabIndex={-1}
            onClick={() => setShowPassword(v => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
          </button>
        </div>
        {formError && <div className="text-red-500 mb-4 text-sm">{formError}</div>}
        {error && <div className="text-red-500 mb-4 text-sm">{error.message}</div>}
        <button
          type="submit"
          className="w-full bg-cyan-700 hover:bg-cyan-800 text-white font-bold py-3 rounded-full shadow transition mb-4"
          disabled={submitting}
        >
          {submitting ? "Signing in..." : "Sign In"}
        </button>
        {/* Legal text */}
        <div className="text-xs text-gray-500 text-center mb-2">
          By signing in to Woo-Combine, you agree to our{' '}
          <Link to="/terms" className="underline hover:text-cyan-700">Terms & Conditions</Link> and{' '}
          <Link to="/privacy" className="underline hover:text-cyan-700">Privacy Policy</Link>.
        </div>
      </form>
    </div>
  );
} 