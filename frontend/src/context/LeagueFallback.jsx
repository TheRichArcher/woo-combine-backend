import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useLogout } from "../context/AuthContext";
import { Users, Plus, QrCode, LogOut } from 'lucide-react';

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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6 border-2 border-cmf-primary/30">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-cmf-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-cmf-primary" />
            </div>
            <h1 className="text-2xl font-bold text-cmf-secondary mb-2">
              No League Selected
            </h1>
            <p className="text-gray-600 text-sm leading-relaxed">
              You need to join or create a league to access WooCombine features
            </p>
          </div>

          {/* Feedback Message */}
          {feedback && (
            <div className="bg-blue-50 border-l-4 border-blue-400 text-blue-700 px-4 py-3 rounded mb-6 text-sm">
              {feedback}
            </div>
          )}

          {/* Action Options */}
          <div className="space-y-4 mb-6">
            {/* Join League Option */}
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-cmf-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <QrCode className="w-5 h-5 text-cmf-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">Join Existing League</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    If you were invited by a coach, enter your code or scan the QR they sent you
                  </p>
                  <button
                    onClick={handleJoinLeague}
                    className="bg-cmf-primary text-white font-semibold px-4 py-2 rounded-lg shadow hover:bg-cmf-secondary transition flex items-center gap-2"
                  >
                    <QrCode className="w-4 h-4" />
                    Join League
                  </button>
                </div>
              </div>
            </div>

            {/* Create League Option */}
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-cmf-secondary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Plus className="w-5 h-5 text-cmf-secondary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">Create New League</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Start your own league and invite players to join
                  </p>
                  <button
                    onClick={handleCreateLeague}
                    className="bg-cmf-secondary text-white font-semibold px-4 py-2 rounded-lg shadow hover:bg-cmf-primary transition flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Create League
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* User Info & Logout */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                <span className="text-gray-600 font-medium text-sm">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Logged in as:</p>
                <p className="text-xs text-gray-600">{user?.email || 'Unknown'}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-red-600 hover:text-red-700 font-medium text-sm transition"
            >
              <LogOut className="w-4 h-4" />
              Log Out
            </button>
          </div>
        </div>

        {/* Help Text */}
        <div className="text-center mt-6">
          <p className="text-xs text-gray-500">
            Having trouble? Check the browser console for errors or contact support.
          </p>
        </div>
      </div>
    </div>
  );
} 