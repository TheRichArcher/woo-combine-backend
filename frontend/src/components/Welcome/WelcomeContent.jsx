import React from "react";

export default function WelcomeContent() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 text-center">
      <h1 className="text-3xl sm:text-5xl font-bold text-white mb-4 drop-shadow-lg">
        Coach. Manage. Never miss a moment.
      </h1>
      <p className="text-lg sm:text-2xl text-cyan-100 mb-8 max-w-xl">
        Your all-in-one platform for team management, communication, and never missing a play.
      </p>
      <button
        className="bg-cyan-700 hover:bg-cyan-800 text-white text-xl font-semibold px-10 py-4 rounded-lg shadow-lg mb-8 transition-colors duration-150"
        onClick={() => window.location.assign("/signup")}
      >
        Get Started
      </button>
    </div>
  );
} 