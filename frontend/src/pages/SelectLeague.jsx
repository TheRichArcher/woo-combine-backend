import React, { useEffect, useState } from "react";
import { useAuth, useLogout } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { X, Plus, UserPlus } from "lucide-react";
import Button from "../components/ui/Button";

export default function SelectLeague() {
  const { user, setSelectedLeagueId, leagues: contextLeagues } = useAuth();
  const logout = useLogout();
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (contextLeagues && contextLeagues.length >= 0) {
      setLeagues(contextLeagues);
      setLoading(false);
      setFetchError(null);
    }
  }, [contextLeagues]);

  const handleSelect = (league) => {
    localStorage.setItem('selectedLeagueId', league.id);
    setSelectedLeagueId(league.id);
    navigate('/dashboard');
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch {
      // Logout error handled internally
      // Continue with navigation even if logout fails
      navigate('/login');
    }
  };

  // Get gradient class based on index
  const getGradientClass = (index) => {
    const gradients = [
      'bg-gradient-to-br from-brand-primary to-brand-secondary',
      'bg-gradient-to-br from-purple-500 to-purple-700',
      'bg-gradient-to-br from-blue-500 to-blue-700',
      'bg-gradient-to-br from-green-500 to-green-700',
      'bg-gradient-to-br from-orange-500 to-orange-700',
      'bg-gradient-to-br from-red-500 to-red-700',
    ];
    return gradients[index % gradients.length];
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Consistent Light Overlay */}
      <div className="fixed inset-0 wc-overlay flex items-center justify-center z-50 p-4">
        <div className="wc-card max-w-md w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h1 className="text-xl font-bold text-gray-900">Select League</h1>
            <button
              onClick={() => navigate('/dashboard')}
              className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin inline-block w-8 h-8 border-3 border-gray-300 border-t-brand-primary rounded-full mb-4"></div>
                <div className="text-gray-500 text-lg">Loading leagues...</div>
                <div className="text-xs text-gray-400 mt-1">This may take a moment during server startup</div>
              </div>
            ) : fetchError ? (
              <div className="text-center py-12">
                <div className="text-red-600 mb-4 text-lg">{fetchError}</div>
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
              <div className="text-center py-12 text-gray-500 text-lg">
                No leagues found. Create or join one below.
              </div>
            ) : (
              <div className="space-y-3">
                {leagues.map((league, index) => (
                  <button
                    key={league.id}
                    onClick={() => handleSelect(league)}
                    className={`w-full ${getGradientClass(index)} rounded-2xl p-6 text-white text-left relative overflow-hidden transform hover:scale-105 transition-transform shadow-lg`}
                  >
                    {/* League Code */}
                    <div className="mb-2">
                      <span className="text-white/80 text-sm font-medium">League Code</span>
                      <div className="text-white text-lg font-mono font-bold">
                        ({league.id.slice(-8).toUpperCase()})
                      </div>
                    </div>
                    
                    {/* League Name */}
                    <div className="text-2xl font-bold mb-2 pr-8">
                      {league.name}
                    </div>
                    
                    {/* Role Badge */}
                    <div className="text-white/90 text-sm capitalize">
                      Role: {league.role}
                    </div>
                    
                    {/* Decorative Elements */}
                    <div className="absolute top-4 right-4 w-12 h-12 border-2 border-white/20 rounded-full"></div>
                    <div className="absolute -bottom-6 -right-6 w-24 h-24 border-2 border-white/10 rounded-full"></div>
                    
                    {/* Notification Badge (if organizer) */}
                    {league.role === 'organizer' && (
                      <div className="absolute top-4 right-4 w-6 h-6 bg-white rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-gray-800">!</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bottom Actions - Unified Buttons */}
          <div className="p-4 space-y-3 border-t border-gray-200">
            <Button size="lg" className="w-full flex items-center justify-center gap-2" onClick={() => navigate('/create-league', { replace: true })}>
              <Plus className="w-5 h-5" /> Create a League
            </Button>
            <Button variant="outline" size="lg" className="w-full flex items-center justify-center gap-2" onClick={() => navigate('/join')}>
              <UserPlus className="w-5 h-5" /> Join a League
            </Button>
          </div>

          {/* User Info */}
          <div className="px-4 pb-4 text-center">
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
    </div>
  );
} 