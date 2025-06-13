import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useLogout } from "../context/AuthContext";
import { Users, Plus, QrCode, LogOut, List } from 'lucide-react';
import WelcomeLayout from '../components/layouts/WelcomeLayout';

export default function LeagueFallback() {
  const navigate = useNavigate();
  const { user, userRole } = useAuth();
  const logout = useLogout();
  const [feedback, setFeedback] = useState("");
  
  const handleCreateLeague = async () => {
    setFeedback("Redirecting to Create League...");
    
    try {
      navigate('/create-league');
    } catch (err) {
      setFeedback(`Navigation error: ${err.message}`);
    }
  };
  
  const handleJoinLeague = () => {
    setFeedback("Redirecting to Join League...");
    try {
      navigate('/join');
    } catch (error) {
      setFeedback("Navigation error. Please try again.");
      console.error('[LeagueFallback] Join navigation error:', error);
    }
  };

  const handleSelectLeague = () => {
    setFeedback("Loading your leagues...");
    try {
      navigate('/select-league');
    } catch (error) {
      setFeedback("Navigation error. Please try again.");
      console.error('[LeagueFallback] Select league navigation error:', error);
    }
  };

  const handleLogout = async () => {
    setFeedback("Logging out...");
    try {
      await logout();
      navigate('/welcome');
    } catch (error) {
      setFeedback("Logout error. Please refresh the page.");
      console.error('[LeagueFallback] Logout error:', error);
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
            {userRole === 'coach' 
              ? 'You need to join a league to access WooCombine features. Ask your organizer for an invite code.'
              : 'You need to join or create a league to access WooCombine features'
            }
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
          {/* Choose Existing League Option */}
          <div className="border border-gray-200 rounded-xl p-4 hover:border-blue-300 transition">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <List className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">Choose from Your Leagues</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Select from leagues you've already {userRole === 'organizer' ? 'created or joined' : 'joined'}
                </p>
                <button
                  onClick={handleSelectLeague}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg shadow transition-all duration-200 transform hover:scale-[1.02] flex items-center gap-2"
                >
                  <List className="w-4 h-4" />
                  Choose League
                </button>
              </div>
            </div>
          </div>

          {/* Join League Option - Enhanced for Coaches */}
          <div className={`border rounded-xl p-4 transition ${
            userRole === 'coach' 
              ? 'border-cyan-400 bg-cyan-50 hover:border-cyan-500' 
              : 'border-gray-200 hover:border-cyan-300'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                userRole === 'coach' ? 'bg-cyan-200' : 'bg-cyan-100'
              }`}>
                <QrCode className={`w-5 h-5 ${userRole === 'coach' ? 'text-cyan-700' : 'text-cyan-600'}`} />
              </div>
              <div className="flex-1">
                <h3 className={`font-semibold mb-1 ${userRole === 'coach' ? 'text-cyan-900' : 'text-gray-900'}`}>
                  Join Existing League
                  {userRole === 'coach' && <span className="ml-2 bg-cyan-200 text-cyan-800 text-xs px-2 py-1 rounded-full">Recommended</span>}
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  {userRole === 'coach' 
                    ? 'Enter the invite code your league organizer gave you, or scan their QR code'
                    : 'If you were invited by a coach, enter your code or scan the QR they sent you'
                  }
                </p>
                <button
                  onClick={handleJoinLeague}
                  className={`font-semibold px-4 py-2 rounded-lg shadow transition-all duration-200 transform hover:scale-[1.02] flex items-center gap-2 ${
                    userRole === 'coach'
                      ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                      : 'bg-cyan-600 hover:bg-cyan-700 text-white'
                  }`}
                >
                  <QrCode className="w-4 h-4" />
                  {userRole === 'coach' ? 'Join with Invite Code' : 'Join League'}
                </button>
              </div>
            </div>
          </div>

          {/* Create League Option - Only for Organizers */}
          {userRole === 'organizer' && (
            <div className="border border-gray-200 rounded-xl p-4 hover:border-green-300 transition">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Plus className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">Create New League</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Start your own league and invite coaches and players to join
                  </p>
                  <button
                    onClick={handleCreateLeague}
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-lg shadow transition-all duration-200 transform hover:scale-[1.02] flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
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