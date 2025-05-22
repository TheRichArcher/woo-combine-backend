import React, { useState, useEffect } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { user, loading, error } = useAuth();

  useEffect(() => {
    if (user) {
      window.location.href = "/dashboard";
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Redirect to dashboard or home (stub)
      // window.location.href = "/dashboard";
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (user) return <div>Logged in! (Redirecting...)</div>;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-cmf-light">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-lg w-full max-w-sm">
        <h2 className="text-3xl font-extrabold mb-6 text-center text-cmf-primary drop-shadow">Woo-Combine Login</h2>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full mb-4 px-3 py-2 border-cmf-secondary rounded focus:ring-cmf-primary focus:border-cmf-primary"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full mb-4 px-3 py-2 border-cmf-secondary rounded focus:ring-cmf-primary focus:border-cmf-primary"
          required
        />
        {formError && <div className="text-red-500 mb-4 text-sm">{formError}</div>}
        {error && <div className="text-red-500 mb-4 text-sm">{error.message}</div>}
        <button
          type="submit"
          className="w-full bg-cmf-primary hover:bg-cmf-secondary text-white font-bold py-2 rounded-lg shadow transition"
          disabled={submitting}
        >
          {submitting ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
} 