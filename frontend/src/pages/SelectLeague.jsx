import React, { useEffect, useState } from "react";
import WelcomeLayout from "../components/layouts/WelcomeLayout";
import { useAuth, useLogout } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { QrCode } from 'lucide-react';
import api from '../lib/api';

export default function SelectLeague() {
  const { user, userRole, setSelectedLeagueId } = useAuth();
  const logout = useLogout();
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      console.error('[SelectLeague] No user found in context.');
      setFetchError('No user found. Please log in again.');
      return;
    }
    (async () => {
      try {
        const res = await api.get(`/leagues/me`);
        setLeagues(res.data.leagues || []);
        if (!res.data.leagues || res.data.leagues.length === 0) {
          const errorMsg = userRole === 'coach' 
            ? 'No leagues found. Ask your organizer for an invite code to join a league.'
            : 'No leagues linked to this account. Try creating a new one.';
          setFetchError(errorMsg);
        } else {
          setFetchError(null);
        }
      } catch (err) {
        if (err.response?.status === 404) {
          // 404 means user has no leagues yet - this is normal
          setLeagues([]);
          const errorMsg = userRole === 'coach' 
            ? 'No leagues found. Ask your organizer for an invite code to join a league.'
            : 'No leagues linked to this account. Try creating a new one.';
          setFetchError(errorMsg);
        } else {
          // Other errors are actual problems
          console.error('[SelectLeague] Fetch error:', err.message, err.stack, err.response?.data);
          setLeagues([]);
          setFetchError('Could not fetch leagues. Please try again later.');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const handleSelect = (league) => {
    localStorage.setItem('selectedLeagueId', league.id);
    setSelectedLeagueId(league.id);
    navigate('/dashboard');
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/welcome');
    } catch (error) {
      console.error('[SelectLeague] Logout error:', error);
    }
  };

  return (
    <WelcomeLayout
      backgroundColor="bg-gradient-to-br from-cyan-900 via-blue-900 to-cyan-700"
      contentClassName="min-h-screen"
      hideHeader={true}
      showOverlay={false}
    >
      <div className="flex flex-col justify-center items-center min-h-screen bg-gradient-to-br from-cyan-900 via-blue-900 to-cyan-700 relative">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl mx-4 flex flex-col">
          {/* Header */}
          <div className="text-center py-6 px-6 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Select Your League</h1>
            <p className="text-gray-600 text-sm">Choose which league you'd like to access, or join a new one.</p>
          </div>
          
          {/* Content */}
          <div className="p-6 flex-1">
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading leagues...</div>
            ) : fetchError ? (
              <div className="text-center py-8">
                {userRole === 'coach' ? (
                  // Friendly "Oops" experience for coaches
                  <div className="space-y-6">
                    {/* Oops Header */}
                    <div className="text-center">
                      <div className="text-4xl mb-2">😅</div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">Oops!</h3>
                      <p className="text-gray-600 text-sm">
                        Looks like you haven't joined any leagues yet. No worries - let's get you connected!
                      </p>
                    </div>
                    
                    {/* Join League Card - Same as LeagueFallback */}
                    <div className="border-2 border-cyan-400 bg-cyan-50 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-cyan-200 rounded-full flex items-center justify-center flex-shrink-0">
                          <QrCode className="w-5 h-5 text-cyan-700" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-cyan-900 mb-1">
                            Join Existing League
                            <span className="ml-2 bg-cyan-200 text-cyan-800 text-xs px-2 py-1 rounded-full">Recommended</span>
                          </h3>
                          <p className="text-sm text-gray-600 mb-3">
                            Enter the invite code your league organizer gave you, or scan their QR code
                          </p>
                          <button
                            onClick={() => navigate('/join')}
                            className="bg-cyan-600 hover:bg-cyan-700 text-white font-semibold px-4 py-2 rounded-lg shadow transition-all duration-200 transform hover:scale-[1.02] flex items-center gap-2"
                          >
                            <QrCode className="w-4 h-4" />
                            Join with Invite Code
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Simple error for organizers
                  <div className="text-red-600 mb-4">{fetchError}</div>
                )}
              </div>
            ) : leagues.length === 0 ? (
              <div className="text-center py-8">
                {userRole === 'coach' ? (
                  // Same friendly "Oops" experience for coaches with empty leagues
                  <div className="space-y-6">
                    {/* Oops Header */}
                    <div className="text-center">
                      <div className="text-4xl mb-2">😅</div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">Oops!</h3>
                      <p className="text-gray-600 text-sm">
                        Looks like you haven't joined any leagues yet. No worries - let's get you connected!
                      </p>
                    </div>
                    
                    {/* Join League Card - Same as LeagueFallback */}
                    <div className="border-2 border-cyan-400 bg-cyan-50 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-cyan-200 rounded-full flex items-center justify-center flex-shrink-0">
                          <QrCode className="w-5 h-5 text-cyan-700" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-cyan-900 mb-1">
                            Join Existing League
                            <span className="ml-2 bg-cyan-200 text-cyan-800 text-xs px-2 py-1 rounded-full">Recommended</span>
                          </h3>
                          <p className="text-sm text-gray-600 mb-3">
                            Enter the invite code your league organizer gave you, or scan their QR code
                          </p>
                          <button
                            onClick={() => navigate('/join')}
                            className="bg-cyan-600 hover:bg-cyan-700 text-white font-semibold px-4 py-2 rounded-lg shadow transition-all duration-200 transform hover:scale-[1.02] flex items-center gap-2"
                          >
                            <QrCode className="w-4 h-4" />
                            Join with Invite Code
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500">No leagues found. Create or join one below.</div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {leagues.map(league => (
                  <button
                    key={league.id}
                    onClick={() => handleSelect(league)}
                    className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition"
                  >
                    <div className="font-semibold text-gray-900">{league.name}</div>
                    <div className="text-sm text-gray-500 capitalize">Role: {league.role}</div>
                  </button>
                ))}
              </div>
            )}
            
            {/* User Info and Logout */}
            <div className="mt-6 pt-4 border-t border-gray-200 text-center">
              <div className="text-xs text-gray-500 mb-2">
                Logged in as: {user?.email || 'Unknown'}
              </div>
              <button
                onClick={handleLogout}
                className="text-sm text-red-600 hover:text-red-800 underline"
              >
                Log out and switch accounts
              </button>
            </div>
          </div>
        </div>
        
        {/* Bottom Actions */}
        <div className="fixed left-0 right-0 bottom-0 flex flex-col gap-3 items-center bg-white py-4 z-10 border-t border-gray-200">
          <button
            className="w-11/12 max-w-lg border-2 border-blue-600 text-blue-700 font-bold text-lg py-3 rounded-full shadow"
            onClick={() => navigate('/join')}
          >
            {userRole === 'coach' ? 'Join with Invite Code' : 'Join a Team'}
          </button>
        </div>
      </div>
    </WelcomeLayout>
  );
} 