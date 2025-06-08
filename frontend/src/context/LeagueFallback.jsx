import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useLogout } from "../context/AuthContext";

export default function LeagueFallback() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const logout = useLogout();
  const [feedback, setFeedback] = useState("");
  
  const handleCreateLeague = async () => {
    console.log('[LeagueFallback] Create League button clicked');
    console.log('[LeagueFallback] Current user:', user);
    console.log('[LeagueFallback] User verified:', user?.emailVerified);
    console.log('[LeagueFallback] User UID:', user?.uid);
    console.log('[LeagueFallback] Current window location:', window.location.href);
    
    setFeedback("Redirecting to Create League...");
    
    try {
      console.log('[LeagueFallback] About to call navigate...');
      
      // Add a small delay to see if that helps
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('[LeagueFallback] Calling navigate to /create-league');
      navigate('/create-league');
      
      console.log('[LeagueFallback] Navigate call completed');
      
      // Check if navigation actually happened
      setTimeout(() => {
        console.log('[LeagueFallback] Location after navigate attempt:', window.location.href);
        if (window.location.pathname !== '/create-league') {
          console.warn('[LeagueFallback] Navigation failed - still on:', window.location.pathname);
          setFeedback("Navigation failed. Please try refreshing the page.");
        }
      }, 500);
      
    } catch (error) {
      console.error('[LeagueFallback] Create league navigation error:', error);
      console.error('[LeagueFallback] Error stack:', error.stack);
      setFeedback(`Navigation error: ${error.message}`);
    }
  };
  
  const handleJoinLeague = () => {
    console.log('[LeagueFallback] Navigating to join');
    console.log('[LeagueFallback] Current user:', user);
    console.log('[LeagueFallback] User verified:', user?.emailVerified);
    setFeedback("Redirecting to Join League...");
    try {
      navigate('/join');
    } catch (error) {
      console.error('[LeagueFallback] Join league navigation error:', error);
      setFeedback("Navigation error. Please try again.");
    }
  };

  const handleLogout = async () => {
    console.log('[LeagueFallback] Logging out');
    setFeedback("Logging out...");
    try {
      await logout();
      navigate('/welcome');
    } catch (error) {
      console.error('[LeagueFallback] Logout error:', error);
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
        
        {/* Debug buttons for testing */}
        <div className="mt-4 text-xs">
          <button
            className="bg-gray-500 text-white rounded px-2 py-1 text-xs mr-2"
            onClick={() => {
              console.log('[DEBUG] Direct navigation test using navigate()');
              navigate('/create-league');
            }}
          >
            Test Direct Navigation
          </button>
          <button
            className="bg-gray-500 text-white rounded px-2 py-1 text-xs"
            onClick={() => {
              console.log('[DEBUG] React Router Link test');
              window.history.pushState({}, '', '/create-league');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
          >
            Test History Push
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