import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useLogout } from "../context/AuthContext";

export default function LeagueFallback() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const logout = useLogout();
  const [feedback, setFeedback] = useState("");
  
  const handleCreateLeague = async () => {
    setFeedback("Redirecting to Create League...");
    
    try {
      navigate('/create-league');
    } catch (error) {
      setFeedback(`Navigation error: ${error.message}`);
    }
  };
  
  const handleJoinLeague = () => {
    setFeedback("Redirecting to Join League...");
    try {
      navigate('/join');
    } catch (error) {
      setFeedback("Navigation error. Please try again.");
    }
  };

  const handleLogout = async () => {
    setFeedback("Logging out...");
    try {
      await logout();
      navigate('/welcome');
    } catch (error) {
      setFeedback("Logout error. Please refresh the page.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] mt-20">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 py-6 px-5 mb-6 max-w-lg w-full mx-auto px-4 sm:px-6 text-center">
        <h2 className="text-lg font-semibold text-cyan-700 mb-4">No League Selected</h2>
        <p className="text-gray-600 mb-2">If you were invited by a coach, enter your code or scan the QR they sent you.</p>
        <p className="text-gray-600 mb-4">You can join an existing league or create a new one to get started.</p>
        
        {feedback && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded-lg mb-4 text-sm">
            {feedback}
          </div>
        )}
        
        <div className="flex gap-4 justify-center mt-2 flex-wrap">
          <button
            className="bg-cyan-600 text-white rounded-full px-5 py-2 text-sm font-medium shadow-sm hover:bg-cyan-700 transition active:bg-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            onClick={handleCreateLeague}
          >
            Create League
          </button>
          <button
            className="bg-cyan-600 text-white rounded-full px-5 py-2 text-sm font-medium shadow-sm hover:bg-cyan-700 transition active:bg-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            onClick={handleJoinLeague}
          >
            Join League
          </button>
        </div>
        

        
        {/* Logout Button */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="text-xs text-gray-500 mb-2">
            Logged in as: {user?.email || 'Unknown'}
          </div>
          <button
            className="bg-red-500 text-white rounded-full px-4 py-2 text-sm font-medium shadow-sm hover:bg-red-600 transition"
            onClick={handleLogout}
          >
            Log Out
          </button>
        </div>
        
        <div className="mt-4 text-xs text-gray-500">
          Having trouble? Check the browser console for errors or contact support.
        </div>
      </div>
    </div>
  );
} 