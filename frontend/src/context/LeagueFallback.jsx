import React from "react";
import { useNavigate } from "react-router-dom";

export default function LeagueFallback() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] mt-20">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 py-6 px-5 mb-6 max-w-lg w-full mx-auto px-4 sm:px-6 text-center">
        <h2 className="text-lg font-semibold text-cyan-700 mb-4">No League Selected</h2>
        <p className="text-gray-600 mb-2">If you were invited by a coach, enter your code or scan the QR they sent you.</p>
        <p className="text-gray-600 mb-4">You can join an existing league or create a new one to get started.</p>
        <div className="flex gap-4 justify-center mt-2 flex-wrap">
          <button
            className="bg-cyan-600 text-white rounded-full px-5 py-2 text-sm font-medium shadow-sm hover:bg-cyan-700 transition"
            onClick={() => navigate('/create-league')}
          >
            Create League
          </button>
          <button
            className="bg-cyan-600 text-white rounded-full px-5 py-2 text-sm font-medium shadow-sm hover:bg-cyan-700 transition"
            onClick={() => navigate('/join')}
          >
            Join League
          </button>
        </div>
      </div>
    </div>
  );
} 