import React, { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function SignupForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { user, loading, error } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      // Redirect to dashboard or home (stub)
      // window.location.href = "/dashboard";
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (user) { navigate("/dashboard"); return null; }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-lg w-full max-w-sm flex flex-col items-center">
      <h2 className="text-3xl font-extrabold mb-6 text-center text-cyan-700 drop-shadow">Sign Up</h2>
      <input
        type="text"
        placeholder="Name"
        value={name}
        onChange={e => setName(e.target.value)}
        className="w-full mb-4 px-3 py-2 border border-cyan-200 rounded focus:ring-cyan-700 focus:border-cyan-700"
        required
      />
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        className="w-full mb-4 px-3 py-2 border border-cyan-200 rounded focus:ring-cyan-700 focus:border-cyan-700"
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        className="w-full mb-4 px-3 py-2 border border-cyan-200 rounded focus:ring-cyan-700 focus:border-cyan-700"
        required
      />
      {formError && <div className="text-red-500 mb-4 text-sm">{formError}</div>}
      {error && <div className="text-red-500 mb-4 text-sm">{error.message}</div>}
      <button
        type="submit"
        className="w-full bg-cyan-700 hover:bg-cyan-800 text-white font-bold py-2 rounded-lg shadow transition"
        disabled={submitting}
      >
        {submitting ? "Signing up..." : "Sign Up"}
      </button>
    </form>
  );
} 