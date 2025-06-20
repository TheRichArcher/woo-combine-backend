import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useLogout } from "../context/AuthContext";
import { Users, Plus, QrCode, LogOut, List, Rocket } from 'lucide-react';
import WelcomeLayout from '../components/layouts/WelcomeLayout';

export default function LeagueFallback() {
  const navigate = useNavigate();
  const { user, userRole } = useAuth();
  const logout = useLogout();
  const [feedback, setFeedback] = useState("");
  
  const handleCreateLeague = async () => {
    // For organizers, direct to wizard for guided setup
    if (userRole === 'organizer') {
      setFeedback("Starting guided setup...");
      try {
        console.info('[GUIDED-SETUP] Navigating to onboarding/event for organizer guided setup');
        navigate('/onboarding/event');
      } catch (err) {
        console.error('[GUIDED-SETUP] Navigation error:', err);
        setFeedback(`Navigation error: ${err.message}`);
      }
    } else {
      setFeedback("Redirecting to Create League...");
      try {
        navigate('/create-league');
      } catch (err) {
        setFeedback(`Navigation error: ${err.message}`);
      }
    }
  };
  
  const handleJoinLeague = () => {
    setFeedback("Redirecting to Join League...");
    try {
      navigate('/join');
          } catch {
        setFeedback("Navigation error. Please try again.");
        // Join navigation failed
    }
  };

  const handleSelectLeague = () => {
    setFeedback("Loading your leagues...");
    try {
      navigate('/select-league');
          } catch {
        setFeedback("Navigation error. Please try again.");
        // League selection navigation failed
    }
  };

  const handleLogout = async () => {
    setFeedback("Logging out...");
    try {
      await logout();
      navigate('/welcome');
          } catch {
        setFeedback("Logout error. Please refresh the page.");
        // Logout error handled internally
    }
  };

  return (
    <WelcomeLayout
      contentClassName="min-h-screen"
      hideHeader={true}
      showOverlay={false}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 mx-4">
        {/* Logo */}
        <div className="text-center mb-6">
          <img
            src="/favicon/woocombine-logo.png"
            alt="Woo-Combine Logo"
            className="w-16 h-16 mx-auto mb-4"
            style={{ objectFit: 'contain' }}
          />
          <div className="w-12 h-12 bg-cyan-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-6 h-6 text-cyan-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
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

        {/* Action Options - Reordered by Role */}
        <div className="space-y-3 mb-6">
          {/* For Organizers: Create League First (with Wizard) */}
          {userRole === 'organizer' && (
            <div className="border-2 border-green-300 bg-green-50 rounded-xl p-3 hover:border-green-400 transition">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Rocket className="w-4 h-4 text-green-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">🚀 Start Guided Setup</h3>
                    <span className="bg-green-200 text-green-800 text-xs px-2 py-0.5 rounded-full font-medium">Recommended</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    Create event → Import players → Share with coaches
                  </p>
                  <button
                    onClick={handleCreateLeague}
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold px-3 py-1.5 rounded-lg shadow transition-all duration-200 transform hover:scale-[1.02] flex items-center gap-2 text-sm"
                  >
                    <Rocket className="w-3 h-3" />
                    Get Started
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* For Coaches: Join League First */}
          {userRole !== 'organizer' && (
            <div className="border-2 border-cyan-300 bg-cyan-50 rounded-xl p-3 hover:border-cyan-400 transition">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-cyan-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <QrCode className="w-4 h-4 text-cyan-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">Join with Invite Code</h3>
                    <span className="bg-cyan-200 text-cyan-800 text-xs px-2 py-0.5 rounded-full font-medium">Recommended</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    Ask your organizer for an invite code
                  </p>
                  <button
                    onClick={handleJoinLeague}
                    className="bg-cyan-600 hover:bg-cyan-700 text-white font-semibold px-3 py-1.5 rounded-lg shadow transition-all duration-200 transform hover:scale-[1.02] flex items-center gap-2 text-sm"
                  >
                    <QrCode className="w-3 h-3" />
                    Join League
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Choose Existing League Option */}
          <div className="border border-gray-200 rounded-xl p-3 hover:border-blue-300 transition">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <List className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">Choose from Your Leagues</h3>
                <p className="text-sm text-gray-600 mb-2">
                  Select from leagues you've already created or joined
                </p>
                <button
                  onClick={handleSelectLeague}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1.5 rounded-lg shadow transition-all duration-200 transform hover:scale-[1.02] flex items-center gap-2 text-sm"
                >
                  <List className="w-3 h-3" />
                  Choose League
                </button>
              </div>
            </div>
          </div>

          {/* Secondary Options */}
          {userRole === 'organizer' ? (
            <div className="border border-gray-200 rounded-xl p-3 hover:border-cyan-300 transition">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-cyan-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <QrCode className="w-4 h-4 text-cyan-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">Join Existing League</h3>
                  <p className="text-sm text-gray-600 mb-2">
                    If you were invited by another organizer
                  </p>
                  <button
                    onClick={handleJoinLeague}
                    className="bg-cyan-600 hover:bg-cyan-700 text-white font-semibold px-3 py-1.5 rounded-lg shadow transition-all duration-200 transform hover:scale-[1.02] flex items-center gap-2 text-sm"
                  >
                    <QrCode className="w-3 h-3" />
                    Join League
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-xl p-3 hover:border-green-300 transition">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Plus className="w-4 h-4 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">Create New League</h3>
                  <p className="text-sm text-gray-600 mb-2">
                    Start your own league and invite players to join
                  </p>
                  <button
                    onClick={handleCreateLeague}
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold px-3 py-1.5 rounded-lg shadow transition-all duration-200 transform hover:scale-[1.02] flex items-center gap-2 text-sm"
                  >
                    <Plus className="w-3 h-3" />
                    Create League
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Info & Logout */}
        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <span className="text-gray-600 font-medium text-xs">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-900">Logged in as:</p>
                <p className="text-xs text-gray-600">{user?.email || 'Unknown'}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-red-600 hover:text-red-700 font-medium text-xs transition"
            >
              <LogOut className="w-3 h-3" />
              Log Out
            </button>
          </div>
        </div>
      </div>
    </WelcomeLayout>
  );
} 