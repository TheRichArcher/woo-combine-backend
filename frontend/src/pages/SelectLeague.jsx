import React, { useEffect, useState } from "react";
import WelcomeLayout from "../components/layouts/WelcomeLayout";
import { useAuth, useLogout } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import api from '../lib/api';

export default function SelectLeague() {
  const { user, setSelectedLeagueId, leagues: contextLeagues } = useAuth();
  const logout = useLogout();
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      console.error('[SelectLeague] No user found in context.');
      setFetchError('No user found. Please log in again.');
      setLoading(false);
      return;
    }

    // Check if AuthContext already has leagues loaded
    if (contextLeagues && contextLeagues.length > 0) {
      console.log('[SelectLeague] Using leagues from AuthContext:', contextLeagues.length);
      setLeagues(contextLeagues);
      setFetchError(null);
      setLoading(false);
      return;
    }

    // Only fetch if AuthContext doesn't have leagues
    const fetchLeagues = async () => {
      try {
        console.log('[SelectLeague] Fetching leagues from API...');
        const res = await api.get(`/leagues/me`, {
          timeout: 25000,  // 25s timeout for cold starts
          retry: 1         // Single retry only
        });
        
        const userLeagues = res.data.leagues || [];
        setLeagues(userLeagues);
        
        if (userLeagues.length === 0) {
          setFetchError('No leagues linked to this account. Try creating a new one.');
        } else {
          setFetchError(null);
        }
      } catch (err) {
        console.error('[SelectLeague] Fetch error:', err.message, err.response?.data);
        
        if (err.response?.status === 404) {
          // 404 means user has no leagues yet - this is normal
          setLeagues([]);
          setFetchError('No leagues linked to this account. Try creating a new one.');
        } else if (err.message.includes('timeout')) {
          // Timeout error - provide helpful message
          setLeagues([]);
          setFetchError('Loading is taking longer than usual. This can happen during server startup. Please try refreshing the page.');
        } else {
          // Other errors are actual problems
          setLeagues([]);
          setFetchError('Could not fetch leagues. Please try again later.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchLeagues();
  }, [user, contextLeagues]);

  const handleSelect = (league) => {
    localStorage.setItem('selectedLeagueId', league.id);
    setSelectedLeagueId(league.id);
    navigate('/dashboard');
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
      // Continue with navigation even if logout fails
      navigate('/login');
    }
  };

  return (
    <WelcomeLayout>
      <div className="bg-white rounded-lg shadow-lg overflow-hidden max-w-md w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6">
          <h1 className="text-2xl font-bold text-center">Select Your League</h1>
          <p className="text-blue-100 text-center mt-2 text-sm">
            Choose which league you'd like to access, or join a new one.
          </p>
        </div>

        {/* Content */}
        <div className="p-6 flex-1">
          {loading ? (
            <div className="text-center py-8">
              <div className="text-gray-500 mb-2">Loading leagues...</div>
              <div className="text-xs text-gray-400">This may take a moment during server startup</div>
            </div>
          ) : fetchError ? (
            <div className="text-center py-8">
              <div className="text-red-600 mb-4">{fetchError}</div>
              {fetchError.includes('timeout') && (
                <button
                  onClick={() => window.location.reload()}
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  Refresh Page
                </button>
              )}
            </div>
          ) : leagues.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No leagues found. Create or join one below.</div>
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
        
        {/* Bottom Actions */}
        <div className="bg-gray-50 px-6 py-4 space-y-3">
          <button
            onClick={() => navigate('/join')}
            className="w-full bg-cyan-500 text-white py-2 px-4 rounded-lg hover:bg-cyan-600 transition"
          >
            Join Existing League
          </button>
          <button
            onClick={() => navigate('/create-league')}
            className="w-full bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition"
          >
            Create New League
          </button>
        </div>
      </div>
    </WelcomeLayout>
  );
} 