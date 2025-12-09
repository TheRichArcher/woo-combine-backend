import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useEvent } from '../context/EventContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePlayerDetails } from '../context/PlayerDetailsContext'; // Keep for handleWeightChange context if needed
import PlayerScorecardGenerator from '../components/PlayerScorecardGenerator';
import PlayerDetailsPanel from '../components/Players/PlayerDetailsPanel'; // Import Panel
import EventSelector from '../components/EventSelector';
import LoadingScreen from '../components/LoadingScreen';
import ErrorDisplay from '../components/ErrorDisplay';
import { useDrills } from '../hooks/useDrills';
import { useOptimizedWeights } from '../hooks/useOptimizedWeights'; // Import optimized weights
import { 
  getDefaultWeightsFromTemplate
} from '../constants/drillTemplates';
import { FileText, Users, Search, AlertTriangle, Zap, BarChart3, Wrench, QrCode, Grid2x2, ChevronDown, ChevronUp } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { logger } from '../utils/logger';

const ScorecardsPage = () => {
  const { selectedEvent } = useEvent();
  const { user, selectedLeagueId, userRole } = useAuth();
  const { showError } = useToast();
  const navigate = useNavigate();
  const { openDetails, selectedPlayer: contextSelectedPlayer, closeDetails } = usePlayerDetails();
  
  // Unified Drills Hook
  const { drills: currentDrills, loading: drillsLoading, presets } = useDrills(selectedEvent);

  const [players, setPlayers] = useState([]);
  // Use context selected player
  const selectedPlayer = contextSelectedPlayer;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showGenerator, setShowGenerator] = useState(false);
  
  // Use optimized weights hook
  const { 
    persistedWeights, 
    sliderWeights, 
    handleWeightChange, 
    persistSliderWeights,
    activePreset, 
    applyPreset 
  } = useOptimizedWeights([], currentDrills, presets); // We can pass empty players if we don't need rankings here (Panel handles it)

  // Ref for auto-scrolling to stats
  const statsRef = useRef(null);

  useEffect(() => {
    if (selectedPlayer && statsRef.current) {
      statsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedPlayer]);
  
  // Get drill template and weights from event
  const drillTemplate = selectedEvent?.drillTemplate;
  // const weights = getDefaultWeightsFromTemplate(drillTemplate); // Replaced by useOptimizedWeights

  
  // Filter players based on search term with safe string handling
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

  const handlePlayerSelect = (player) => {
    // Hide generator by default when switching players to keep view clean
    setShowGenerator(false);
    
    // Open the global modal context but suppressed (so we use inline panel)
    openDetails(player, {
        allPlayers: players,
        persistedWeights, 
        sliderWeights,
        persistSliderWeights,
        handleWeightChange,
        activePreset,
        applyPreset,
        drills: currentDrills,
        presets,
        suppressGlobalModal: true // Keep inline for this page
    });
  };

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
              <div className="space-y-1 max-h-[20rem] overflow-y-auto">
                {playersWithScores.map((player) => (
                  <div
                    key={player.id}
                    onClick={() => handlePlayerSelect(player)}
                    className={`w-full text-left p-3 rounded-md border transition-colors text-sm cursor-pointer ${selectedPlayer?.id === player.id ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-500' : 'border-gray-200 hover:bg-gray-50'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900 text-sm">{player.name}</div>
                        <div className="text-xs text-gray-600">#{player.number} • {player.age_group}</div>
                      </div>
                      <div className="flex items-center gap-2">
                         {selectedPlayer?.id === player.id && (
                           <div className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">Viewing</div>
                         )}
                        <Users className="w-4 h-4 text-gray-300" />
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

            {/* Player Stats View */}
            {!selectedPlayer ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">No Player Selected</h3>
                <p className="text-gray-500">Select a player from the list above to view their stats and rankings.</p>
              </div>
            ) : (
              <div ref={statsRef} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in duration-300">
                <div className="bg-blue-600 px-6 py-4 text-white flex justify-between items-center">
                   <div>
                      <h2 className="text-xl font-bold">{selectedPlayer.name}</h2>
                      <p className="text-blue-100 text-sm">#{selectedPlayer.number} • {selectedPlayer.age_group}</p>
                   </div>
                   <div className="text-right">
                      {/* Controls embedded in panel */}
                   </div>
                </div>
                
                <div className="h-[600px] overflow-y-auto bg-white">
                   <PlayerDetailsPanel 
                      player={selectedPlayer}
                      allPlayers={players}
                      persistedWeights={persistedWeights}
                      sliderWeights={sliderWeights}
                      persistSliderWeights={persistSliderWeights}
                      handleWeightChange={handleWeightChange}
                      activePreset={activePreset}
                      applyPreset={applyPreset}
                      drills={currentDrills}
                      presets={presets}
                   />
                </div>

                {/* Footer / Actions */}
                <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex justify-between items-center">
                   <button 
                     onClick={() => setShowGenerator(!showGenerator)}
                     className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
                   >
                     {showGenerator ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                     {showGenerator ? 'Hide Report Generator' : 'Create PDF / Email Report'}
                   </button>
                </div>
              </div>
            )}

            {/* Scorecard Generator (Secondary) */}
            {selectedPlayer && showGenerator && (
              <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                <PlayerScorecardGenerator
                  player={selectedPlayer}
                  allPlayers={players}
                  weights={persistedWeights}
                  selectedDrillTemplate={drillTemplate}
                  drills={currentDrills}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ScorecardsPage;