import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useEvent } from '../context/EventContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import PlayerScorecardGenerator from '../components/PlayerScorecardGenerator';
import EventSelector from '../components/EventSelector';
import LoadingScreen from '../components/LoadingScreen';
import ErrorDisplay from '../components/ErrorDisplay';
import { useDrills } from '../hooks/useDrills';
import { 
  getDefaultWeightsFromTemplate
} from '../constants/drillTemplates';
import { FileText, Users, Search, Award, AlertTriangle, Zap, BarChart3, Wrench, QrCode, Grid2x2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { logger } from '../utils/logger';

const ScorecardsPage = () => {
  const { selectedEvent } = useEvent();
  const { user, selectedLeagueId, userRole } = useAuth();
  const { showError } = useToast();
  const navigate = useNavigate();
  
  // Unified Drills Hook
  const { drills: currentDrills, loading: drillsLoading } = useDrills(selectedEvent);

  const [players, setPlayers] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const generatorRef = useRef(null);

  useEffect(() => {
    if (selectedPlayer && generatorRef.current) {
      generatorRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedPlayer]);
  
  // Get drill template and weights from event
  const drillTemplate = selectedEvent?.drillTemplate;
  const weights = getDefaultWeightsFromTemplate(drillTemplate);
  
  // Fetch players for the selected event
  const fetchPlayers = useCallback(async () => {
    if (!selectedEvent || !user || !selectedLeagueId) {
      setPlayers([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/players?event_id=${selectedEvent.id}`);
      setPlayers(res.data);
      
      // Auto-select removed per requirements - user must explicitly select player for scorecard
      /* 
      if (res.data.length > 0) {
        setSelectedPlayer(prev => prev || res.data[0]);
      }
      */
    } catch (err) {
      if (err.response?.status === 422) {
        setError("Players may not be set up yet for this event");
      } else {
        setError(err.message || "Failed to load players");
      }
    } finally {
      setLoading(false);
    }
  }, [selectedEvent, user, selectedLeagueId]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  // Filter players based on search term with safe string handling
  const filteredPlayers = players.filter(player => {
    const searchLower = searchTerm.toLowerCase().trim();
    if (!searchLower) return true;
    
    const name = player.name?.toLowerCase() || '';
    const number = player.number?.toString() || '';
    const ageGroup = player.age_group?.toLowerCase() || '';
    
    return name.includes(searchLower) || 
           number.includes(searchLower) || 
           ageGroup.includes(searchLower);
  });

  // Filter players with at least some drill scores (with validation)
  const playersWithScores = filteredPlayers.filter(player => {
    try {
      if (!currentDrills.length) return false;
      return currentDrills.some(drill => {
        const value = player[drill.key];
        return value != null && 
               typeof value === 'number' && 
               !isNaN(value) && 
               isFinite(value);
      });
    } catch (err) {
      logger.warn('SCORECARDS', 'Error filtering player scores', err);
      return false;
    }
  });

  if (loading || drillsLoading) {
    return (
      <LoadingScreen 
        title="Loading Player Scorecards"
        subtitle="Preparing player data and scorecard tools..."
        size="large"
      />
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <ErrorDisplay 
            error={error}
            onRetry={fetchPlayers}
            title="Scorecard Generation Error"
          />
        </div>
      </div>
    );
  }

  if (!selectedEvent) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
            <div className="text-center">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">No Event Selected</h2>
              <p className="text-gray-600 mb-6">
                Please select an event to generate player scorecards
              </p>
              <EventSelector />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Uniform header to match Live Standings */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-lg font-bold text-gray-900">Player Scorecards</h1>
              <p className="text-sm text-gray-600">{selectedEvent.name}</p>
            </div>
          </div>
          <div className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium">Reports</div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link to="/live-entry" className="flex items-center gap-2 p-3 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition">
              <Zap className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-900">Continue Recording</span>
            </Link>
            <Link to="/players?tab=analyze" className="flex items-center gap-2 p-3 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition">
              <Users className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Full Player View</span>
            </Link>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link to="/live-standings" className="text-xs bg-white text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition font-medium">Live Standings</Link>
            <Link to="/sport-templates" className="text-xs bg-white text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition font-medium">Sport Templates</Link>
            {(userRole === 'organizer' || userRole === 'coach') && (
              <Link to="/team-formation" className="text-xs bg-white text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition font-medium">Create Teams</Link>
            )}
          </div>
        </div>

        {/* Body */}
        {playersWithScores.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-yellow-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-yellow-900 mb-2">No Players with Evaluation Scores</h3>
                <p className="text-yellow-800 mb-3">Players need to have drill scores recorded before scorecards can be generated.</p>
                <Link to="/players" className="inline-flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                  <Users className="w-4 h-4" /> Go to Players Page
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Selection */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <h2 className="font-semibold text-gray-900">Select Player</h2>
                </div>
                <div className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">{playersWithScores.length} available</div>
              </div>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search players..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  aria-label="Search players by name, number, or age group"
                />
              </div>
              <div className="space-y-1 max-h-[28rem] overflow-y-auto">
                {playersWithScores.map((player) => (
                  <div
                    key={player.id}
                    onClick={() => navigate(`/players?playerId=${player.id}`)}
                    className={`w-full text-left p-2 rounded-md border transition-colors text-sm cursor-pointer ${selectedPlayer?.id === player.id ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-500' : 'border-gray-200 hover:bg-gray-50'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900 text-sm">{player.name}</div>
                        <div className="text-xs text-gray-600">#{player.number} • {player.age_group}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPlayer(player);
                          }}
                          className="px-2 py-1 text-xs bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition z-10"
                        >
                          Scorecard
                        </button>
                        <Users className="w-3 h-3 text-gray-400 hidden md:block" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {filteredPlayers.length !== playersWithScores.length && (
                <div className="mt-3 p-2 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600">Showing {playersWithScores.length} of {filteredPlayers.length} players with evaluation scores</p>
                </div>
              )}
            </div>

            {/* Generator */}
            <div ref={generatorRef}>
              <PlayerScorecardGenerator
                player={selectedPlayer}
                allPlayers={players}
                weights={weights}
                selectedDrillTemplate={drillTemplate}
                drills={currentDrills}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ScorecardsPage;