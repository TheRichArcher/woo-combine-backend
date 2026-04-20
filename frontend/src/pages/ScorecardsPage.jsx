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
import { FileText, Users, Search, AlertTriangle, ChevronDown, ChevronUp, ArrowLeft, Download, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { logger } from '../utils/logger';
import { formatViewerPlayerName } from '../utils/playerDisplayName';
import { createScorecardEmailDraft, downloadPlayerScorecardPdf } from '../utils/playerScorecardReport';

const ScorecardsPage = () => {
  const { selectedEvent } = useEvent();
  const { user, selectedLeagueId, userRole } = useAuth();
  const { showError } = useToast();
  const { openDetails, selectedPlayer: contextSelectedPlayer } = usePlayerDetails();
  
  // Unified Drills Hook
  const { drills: currentDrills, loading: drillsLoading, presets } = useDrills(selectedEvent);

  const [players, setPlayers] = useState([]);
  // Use context selected player
  const selectedPlayer = contextSelectedPlayer;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showScoreDetails, setShowScoreDetails] = useState(true);
  
  // Use optimized weights hook
  const { 
    persistedWeights, 
    sliderWeights, 
    handleWeightChange, 
    persistSliderWeights,
    activePreset, 
    applyPreset 
  } = useOptimizedWeights([], currentDrills, presets); // We can pass empty players if we don't need rankings here (Panel handles it)

  const handleDownloadScorecard = useCallback(() => {
    if (!selectedPlayer) return;
    const opened = downloadPlayerScorecardPdf({
      player: selectedPlayer,
      displayName: formatViewerPlayerName(selectedPlayer, userRole),
      selectedEvent,
      drills: currentDrills,
      allPlayers: players,
      weights: persistedWeights
    });
    if (!opened) {
      showError('Unable to open scorecard. Please allow popups and try again.');
    }
  }, [selectedPlayer, userRole, selectedEvent, currentDrills, players, persistedWeights, showError]);

  const handleEmailScorecard = useCallback(() => {
    if (!selectedPlayer) return;
    const mailtoLink = createScorecardEmailDraft({
      player: selectedPlayer,
      displayName: formatViewerPlayerName(selectedPlayer, userRole),
      selectedEvent,
      allPlayers: players,
      weights: persistedWeights,
      drills: currentDrills
    });
    if (!mailtoLink) return;
    window.location.href = mailtoLink;
  }, [selectedPlayer, userRole, selectedEvent, players, persistedWeights, currentDrills]);

  // Ref for auto-scrolling to stats
  const statsRef = useRef(null);
  
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
        const value = player.scores?.[drill.key] ?? player[drill.key];
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
    setShowScoreDetails(true);
    
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

    // Scroll only after a direct user selection on this page.
    // This avoids post-mount jumps from persisted context state.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        statsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
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
      <div className="bg-white shadow-sm border-b border-gray-200 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-start gap-3">
            <Link to="/dashboard" className="text-gray-600 hover:text-gray-900 transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Player Scorecards</h1>
              <p className="text-sm text-gray-600">Select a player and generate a PDF or email report</p>
            </div>
          </div>
          <div className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium hidden sm:inline-flex">{selectedEvent.name}</div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
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
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <h2 className="font-semibold text-gray-900">Select Player</h2>
                </div>
                <div className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">{playersWithScores.length} available</div>
              </div>
              <div className="mb-2">
                <p className="text-sm font-medium text-gray-900">Find a player</p>
                <p className="text-xs text-gray-600">
                  Search by name, jersey number, or age group.
                  {userRole === 'admin' ? ' Admin can search all players listed below.' : ''}
                </p>
              </div>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, #, or age group..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  aria-label="Search players by name, number, or age group"
                />
              </div>
              {searchTerm.trim() && (
                <div className="mb-3 p-2 bg-blue-50 border border-blue-100 rounded-lg">
                  <p className="text-xs text-blue-800">
                    Showing {playersWithScores.length} matching player{playersWithScores.length === 1 ? '' : 's'} with evaluation scores.
                  </p>
                </div>
              )}
              <div className="space-y-1 max-h-[20rem] overflow-y-auto">
                {playersWithScores.map((player) => (
                  <div
                    key={player.id}
                    onClick={() => handlePlayerSelect(player)}
                    className={`w-full text-left p-3 rounded-md border transition-colors text-sm cursor-pointer ${selectedPlayer?.id === player.id ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-500' : 'border-gray-200 hover:bg-gray-50'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900 text-sm">{formatViewerPlayerName(player, userRole)}</div>
                        <div className="text-xs text-gray-600">
                          {player.number != null && player.number !== '' ? `#${player.number} • ` : ''}
                          {player.age_group}
                        </div>
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
                {playersWithScores.length === 0 && searchTerm.trim() && (
                  <div className="p-3 rounded-md border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-600">
                    No matching players found. Try a different name, number, or age group.
                  </div>
                )}
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
                <p className="text-gray-500">Pick a player above, then use Generate PDF or Email Report.</p>
              </div>
            ) : (
              <div ref={statsRef} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in duration-300">
                <div className="bg-blue-600 px-6 py-4 text-white flex justify-between items-center">
                   <div>
                      <h2 className="text-xl font-bold">{formatViewerPlayerName(selectedPlayer, userRole)}</h2>
                      <p className="text-blue-100 text-sm">
                        {selectedPlayer.number != null && selectedPlayer.number !== '' ? `#${selectedPlayer.number} • ` : ''}
                        {selectedPlayer.age_group}
                      </p>
                   </div>
                   <div className="text-right">
                      <div className="text-xs bg-white/20 text-white px-2 py-1 rounded-full">Ready to send</div>
                   </div>
                </div>

                <div className="px-4 py-4 border-b border-gray-200 bg-blue-50">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={handleDownloadScorecard}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 text-sm font-semibold transition"
                    >
                      <Download className="w-4 h-4" />
                      Quick Export PDF
                    </button>
                    <button
                      onClick={handleEmailScorecard}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white text-blue-700 px-4 py-2.5 text-sm font-medium hover:bg-blue-100 transition"
                    >
                      <Mail className="w-4 h-4" />
                      Quick Email Report
                    </button>
                  </div>
                  <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <button
                      onClick={() => setShowScoreDetails(!showScoreDetails)}
                      className="text-sm font-medium text-blue-700 hover:text-blue-900 inline-flex items-center gap-1"
                    >
                      {showScoreDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      {showScoreDetails ? 'Collapse Ranking Breakdown' : 'Show Ranking Breakdown'}
                    </button>
                  </div>
                </div>

                {showScoreDetails && (
                  <div className="h-[540px] overflow-y-auto bg-white border-t border-gray-100">
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
                )}
              </div>
            )}

            {/* Scorecard Generator (Embedded report options) */}
            {selectedPlayer && (
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