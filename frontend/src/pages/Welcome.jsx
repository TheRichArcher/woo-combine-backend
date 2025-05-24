import React from "react";
import { Link, useNavigate } from "react-router-dom";
import Logo from "../components/Logo";

function WelcomeHero() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center flex-1 text-center">
      <h1 className="text-3xl sm:text-5xl font-bold text-white mb-8 drop-shadow-lg">
        Coach. Manage. Never miss a moment.
      </h1>
      <button
        className="bg-cyan-700 hover:bg-cyan-800 text-white text-xl font-semibold px-10 py-4 rounded-lg shadow-lg mb-8 transition-colors duration-150"
        onClick={() => navigate("/signup")}
      >
        Get Started
      </button>
    </div>
  );
}

export default function Welcome() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-cyan-900 via-blue-900 to-cyan-700 relative">
      <header className="absolute top-0 left-0 p-6">
        <Logo className="text-white drop-shadow-lg" />
      </header>
      <main className="flex flex-1 flex-col justify-center items-center px-4">
        <WelcomeHero />
      </main>
      <footer className="w-full flex flex-col items-center gap-2 pb-8 mt-auto">
        <div className="flex flex-col sm:flex-row gap-2 text-white/80 text-base">
          <Link to="/login" className="hover:underline">Already have an account? <span className="font-semibold text-white">Sign In</span></Link>
          <span className="hidden sm:inline">&middot;</span>
          <Link to="/claim" className="hover:underline">Need to claim an account? <span className="font-semibold text-white">Claim</span></Link>
        </div>
      </footer>
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />
    </div>
  );
} 