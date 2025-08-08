import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import DrillInputForm from "../components/DrillInputForm";
import EditPlayerModal from "../components/Players/EditPlayerModal";
import PlayerDetailsModal from "../components/Players/PlayerDetailsModal";
import AddPlayerModal from "../components/Players/AddPlayerModal";

import { useEvent } from "../context/EventContext";
import { useAuth } from "../context/AuthContext";
import EventSelector from "../components/EventSelector";
import api from '../lib/api';
import { X, TrendingUp, Award, Edit, Settings, Users, BarChart3, Download, Filter, ChevronDown, Trophy, Target, FileText, Zap, CheckCircle, UserPlus, ArrowRight } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { parseISO, isValid, format } from 'date-fns';
import { DRILLS, WEIGHT_PRESETS, TABS } from '../constants/players';
import { calculateNormalizedCompositeScores } from '../utils/normalizedScoring';
import { calculateOptimizedRankingsAcrossAll } from '../utils/optimizedScoring';

// PERFORMANCE OPTIMIZATION: New optimized imports
import { useOptimizedWeights } from '../hooks/useOptimizedWeights';
import { withCache, cacheInvalidation } from '../utils/dataCache';

// Icon mapping for TABS
const ICON_MAP = {
  'Users': Users,
  'Download': Download
};











// PERFORMANCE OPTIMIZATION: Cached API function
const cachedFetchPlayers = withCache(
  async (eventId) => {
    const res = await api.get(`/players?event_id=${eventId}`);
    return res.data;
  },
  'players',
  3 * 60 * 1000 // 3 minute cache
);

export default function Players() {
  const { selectedEvent } = useEvent();
  const { user, selectedLeagueId, userRole } = useAuth();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedPlayerIds, setExpandedPlayerIds] = useState({});
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState('players');
  
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam && ['players', 'rankings', 'exports'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [location.search]);
  
  const [selectedAgeGroup, setSelectedAgeGroup] = useState("");

  // PERFORMANCE OPTIMIZATION: Replace complex weight management with optimized hook
  const {
    persistedWeights,
    sliderWeights,
    activePreset,
    handleWeightChange,
    applyPreset,
    rankings: optimizedRankings,
    liveRankings,
    groupedRankings,
    setSliderWeights,
    persistSliderWeights
  } = useOptimizedWeights(players);

  const [showCustomControls, setShowCustomControls] = useState(false);

  // PERFORMANCE OPTIMIZATION: Use grouped rankings from optimized hook
  const grouped = useMemo(() => {
    // Use the optimized groupedRankings if available, otherwise fall back to basic grouping
    if (Object.keys(groupedRankings).length > 0) {
      return groupedRankings;
    }
    
    return players.reduce((acc, player) => {
      const ageGroup = player.age_group || 'Unknown';
      if (!acc[ageGroup]) acc[ageGroup] = [];
      acc[ageGroup].push(player);
      return acc;
    }, {});
  }, [players, groupedRankings]);

  // Determine rankings for the currently selected group. This enables showing
  // rankings even if some players have not recorded any scores yet.
  const selectedGroupRankings = useMemo(() => {
    if (!selectedAgeGroup) return [];
    if (selectedAgeGroup === 'all') {
      return calculateOptimizedRankingsAcrossAll(players, persistedWeights);
    }
    return groupedRankings[selectedAgeGroup] || [];
  }, [selectedAgeGroup, players, persistedWeights, groupedRankings]);

  // Live rankings for the selected group based on current slider weights
  const selectedLiveRankings = useMemo(() => {
    if (!selectedAgeGroup) return [];
    if (selectedAgeGroup === 'all') {
      return calculateOptimizedRankingsAcrossAll(players, sliderWeights);
    }
    // liveRankings is a flat array across age groups; filter to the selected group
    const filtered = (Array.isArray(liveRankings) ? liveRankings : [])
      .filter(p => p && p.age_group === selectedAgeGroup);
    return filtered.length > 0 ? filtered : selectedGroupRankings;
  }, [selectedAgeGroup, players, sliderWeights, liveRankings, selectedGroupRankings]);

  // Selected group players and completion stats (supports partial/no-shows)
  const selectedGroupPlayers = useMemo(() => {
    if (!selectedAgeGroup) return [];
    return selectedAgeGroup === 'all' ? players : (grouped[selectedAgeGroup] || []);
  }, [selectedAgeGroup, players, grouped]);

  const selectedGroupScoredCount = useMemo(() => {
    if (!selectedGroupPlayers || selectedGroupPlayers.length === 0) return 0;
    return selectedGroupPlayers.filter(p =>
      DRILLS.some(drill => p[drill.key] != null && typeof p[drill.key] === 'number')
    ).length;
  }, [selectedGroupPlayers]);

  const selectedGroupCompletionPct = useMemo(() => {
    const total = selectedGroupPlayers.length || 0;
    if (total === 0) return 0;
    return Math.round((selectedGroupScoredCount / total) * 100);
  }, [selectedGroupScoredCount, selectedGroupPlayers]);

  // PERFORMANCE OPTIMIZATION: Simplified ranking function using optimized calculations
  const calculateRankingsForGroup = useCallback((playersGroup, weights) => {
    // Use the optimized rankings if this is for the current weights
    const weightsMatch = Object.keys(weights).every(
      key => Math.abs(weights[key] - persistedWeights[key]) < 0.1
    );
    
    if (weightsMatch && optimizedRankings.length > 0) {
      return optimizedRankings.filter(player => 
        playersGroup.some(p => p.id === player.id)
      );
    }
    
    // Fallback to original calculation for different weights
    const rankedPlayers = calculateNormalizedCompositeScores(playersGroup, weights);
    rankedPlayers.sort((a, b) => b.compositeScore - a.compositeScore);
    
    return rankedPlayers.map((player, index) => ({
      ...player,
      weightedScore: player.compositeScore, // Keep backward compatibility with existing UI
      rank: index + 1
    }));
  }, [optimizedRankings, persistedWeights]);

  // PERFORMANCE OPTIMIZATION: Removed old weight management functions
  // These are now handled by useOptimizedWeights hook



  const OnboardingCallout = () => (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <div className="text-blue-500 text-lg">💡</div>
        <div>
          <h3 className="font-semibold text-blue-900 mb-1">Getting Started with Player Management</h3>
          <p className="text-blue-700 text-sm mb-2">
            You can add players by clicking "Add Player" or uploading a CSV file. Once players are added, you can:
          </p>
          <ul className="text-blue-700 text-sm space-y-1 list-disc list-inside">
            <li>Record drill results for each player</li>
            <li>View detailed statistics and rankings</li>
            <li>Export rankings data for analysis</li>
          </ul>
        </div>
      </div>
    </div>
  );

  // PERFORMANCE OPTIMIZATION: Use cached API calls
  const fetchPlayers = useCallback(async () => {
    if (!selectedEvent || !user || !selectedLeagueId) {
      setPlayers([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Use cached fetch for better performance
      const playersData = await cachedFetchPlayers(selectedEvent.id);
      setPlayers(playersData);
      
      if (selectedPlayer) {
        const updatedPlayer = playersData.find(p => p.id === selectedPlayer.id);
        setSelectedPlayer(updatedPlayer || null);
      }
    } catch (err) {
      if (err.response?.status === 422) {
        setError("422: Unprocessable Entity - Players may not be set up yet");
      } else {
        setError(err.message || "Failed to load players");
      }
    } finally {
      setLoading(false);
    }
  }, [selectedEvent, user, selectedLeagueId, selectedPlayer]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  // PERFORMANCE OPTIMIZATION: Rankings are now calculated automatically by useOptimizedWeights hook

  // Auto-select "all" age group when players load (prevents setState during render)
  useEffect(() => {
    const availableAgeGroups = Object.keys(grouped);
    if (!selectedAgeGroup && availableAgeGroups.length > 0) {
      setSelectedAgeGroup('all');
    }
  }, [selectedAgeGroup, grouped]);

  // Toggle dropdown visibility
  const toggleForm = (id) => {
    setExpandedPlayerIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // PERFORMANCE OPTIMIZATION: Simplified weight controls using optimized hook
  const MobileWeightControls = React.memo(({ showSliders = false }) => {
    const sliderRefs = useRef({});
    
    // Always call hooks at the top level before any conditional logic
    useEffect(() => {
      if (showSliders && !showCustomControls) {
        setShowCustomControls(true);
      }
    }, [showSliders]);
    
    // Return null after hooks if not showing sliders
    if (!showSliders) return null;
    
    return (
      <div className="bg-blue-50 rounded-xl border-2 border-blue-200 p-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Settings className="w-5 h-5 text-cmf-primary" />
          <h2 className="text-lg font-semibold text-cmf-secondary">Ranking Weight Controls</h2>
        </div>
        <p className="text-cmf-primary text-sm mb-3">
          Set drill priorities for ranking calculations. Higher values = more important to you.
          <span className="block text-xs mt-1 opacity-75">
            Currently: <strong>{WEIGHT_PRESETS[activePreset]?.name || 'Custom'}</strong> 
            {!activePreset && (
              <span className="ml-1 text-green-600">⚡ Live updates!</span>
            )}
          </span>
        </p>
        
        <div className="grid grid-cols-2 gap-3 mb-4">
          {Object.entries(WEIGHT_PRESETS).map(([key, preset]) => (
            <button 
              key={key}
              onClick={() => applyPreset(key)} 
              className={`p-4 text-left rounded-lg border-2 transition-all touch-manipulation min-h-[70px] ${
                activePreset === key 
                  ? 'border-cmf-primary bg-cmf-primary text-white shadow-lg' 
                  : 'border-gray-200 hover:border-cmf-primary bg-white text-gray-700 hover:shadow-md'
              }`}
            >
              <div className="font-medium text-sm">{preset.name}</div>
              <div className="text-xs opacity-75 mt-1">{preset.description}</div>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between mb-3 bg-white rounded-lg p-3 border border-gray-200">
          <div>
            <span className="text-sm font-medium text-gray-700">Custom Weight Sliders</span>
            <div className="text-xs text-gray-500">Fine-tune individual drill priorities</div>
          </div>
          <button 
            onClick={() => setShowCustomControls(!showCustomControls)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors min-w-[80px] touch-manipulation ${
              showCustomControls ? 
                'bg-cmf-primary text-white' 
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
          >
            {showCustomControls ? 'Hide' : 'Show'}
          </button>
        </div>

        {showCustomControls && (
          <div className="space-y-3">
            {DRILLS.map((drill) => (
              <div key={drill.key} className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">{drill.label}</label>
                    <div className="text-xs text-gray-500">Higher = more important</div>
                  </div>
                  <span className="text-lg font-mono text-blue-600 bg-blue-100 px-3 py-1 rounded-full min-w-[50px] text-center">
                    {(sliderWeights[drill.key] ?? 0).toFixed(0)}%
                  </span>
                </div>
                
                <div className="touch-none">
                  <input
                    type="range"
                    ref={(el) => (sliderRefs.current[drill.key] = el)}
                    value={sliderWeights[drill.key] ?? 50}
                    min={0}
                    max={100}
                    step={0.1}
                    onChange={(e) => {
                      const newWeight = parseFloat(e.target.value);
                      handleWeightChange(drill.key, newWeight);
                    }}
                    name={drill.key}
                    className="w-full h-6 rounded-lg cursor-pointer accent-blue-600"
                  />
                </div>
                
                <div className="flex justify-between text-xs text-gray-400 mt-2">
                  <span>Less important</span>
                  <span>More important</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  });

  if (!selectedEvent || !selectedEvent.id) return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center border-2 border-blue-200">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-8 h-8 text-cmf-primary" />
          </div>
          <h2 className="text-2xl font-bold text-cmf-primary mb-4">No Event Selected</h2>
          <p className="text-gray-600 mb-6">
            {userRole === "organizer"
              ? "Select or create an event to manage players and drills."
              : "Ask your league operator to assign you to an event."}
          </p>
          <button
            onClick={() => navigate('/select-league')}
            className="bg-cmf-primary text-white font-bold px-6 py-3 rounded-lg shadow hover:bg-cmf-secondary transition"
          >
            Select Event
          </button>
        </div>
      </div>
    </div>
  );

  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
          <div className="animate-spin inline-block w-6 h-6 border-2 border-gray-300 border-t-cmf-primary rounded-full mb-2"></div>
          <div className="text-gray-500">Loading players...</div>
        </div>
      </div>
    </div>
  );

  if (error) {
    if (error.includes('422')) {
      return (
        <div className="min-h-screen bg-gray-50">
          <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center border-2 border-blue-200">
              <h2 className="text-2xl font-bold text-cmf-primary mb-4">No Players Found</h2>
              <p className="text-gray-600 mb-6">Use the Admin tab to upload or import players to get started.</p>
              <Link to="/admin" className="bg-cmf-primary text-white font-bold px-6 py-3 rounded-lg shadow hover:bg-cmf-secondary transition">
                Go to Admin
              </Link>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <div className="text-red-500 font-semibold">Error: {error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (players.length === 0) return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
        
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center border-2 border-blue-200">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-8 h-8 text-cmf-primary" />
          </div>
          <h2 className="text-2xl font-bold text-cmf-primary mb-4">No Players Found Yet</h2>
          <p className="text-gray-600 mb-6">You can upload a CSV or add them manually to get started.</p>
          <div className="flex gap-3 justify-center">
            <Link to="/onboarding/event" className="bg-cmf-primary text-white font-bold px-4 py-2 rounded-lg shadow hover:bg-cmf-secondary transition">
              Upload CSV Players
            </Link>
            <button 
              onClick={() => setShowAddPlayerModal(true)}
              className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded-lg shadow transition flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Add Player
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Main component for when there are players
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border-2 border-blue-200">
          <h1 className="text-2xl font-bold text-cmf-secondary mb-2">
            WooCombine: Players & Rankings
          </h1>
          <p className="text-gray-600 mb-4">
            Managing: <strong>{selectedEvent.name}</strong> - {
              selectedEvent.date && isValid(parseISO(selectedEvent.date))
                ? format(parseISO(selectedEvent.date), 'MM/dd/yyyy')
                : 'Date TBD'
            }
          </p>
          
          {/* Primary Action - Most users want this next */}
          {(userRole === 'organizer' || userRole === 'coach') && (
            <div className="mb-4">
              <Link
                to="/live-entry"
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-6 rounded-xl shadow-lg transition-all duration-200 transform hover:scale-[1.02] flex items-center justify-center gap-3 text-lg"
              >
                🚀 Start Recording Drill Results
                <ArrowRight className="w-5 h-5" />
              </Link>
              <p className="text-sm text-gray-600 text-center mt-2">Record 40-yard dash, vertical jump, and other drill performances</p>
            </div>
          )}
          
          {/* Player Management Options */}
          {userRole === 'organizer' && (
            <div className="border-t border-gray-200 pt-4">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAddPlayerModal(true)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition flex items-center justify-center gap-2 text-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  Add Player
                </button>
                <button
                  onClick={() => navigate('/admin#player-upload')}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition flex items-center justify-center gap-2 text-sm"
                >
                  <Download className="w-4 h-4" />
                  Import CSV
                </button>
              </div>
              <p className="text-xs text-gray-500 text-center mt-2">
                Add individual players or import from spreadsheet
              </p>
            </div>
          )}
        </div>



        {/* Role-based interface - Tabs only for organizers/coaches */}
        {(userRole === 'organizer' || userRole === 'coach') ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 overflow-hidden">
            <div className="flex border-b border-gray-200">
              {TABS.map((tab) => {
                const Icon = ICON_MAP[tab.icon];
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'bg-cmf-primary text-white border-b-2 border-cmf-primary'
                        : 'text-gray-600 hover:text-cmf-primary hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
            
            <div className="px-4 py-2 bg-gray-50 text-xs text-gray-600">
              {TABS.find(tab => tab.id === activeTab)?.description}
            </div>
          </div>
        ) : (
          /* Viewer header */
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-cmf-primary" />
                Event Participants
              </h2>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                👁️ View Only
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              View all participants in this combine event
            </p>
          </div>
        )}

        {/* Content area - Role-based views */}
        {userRole === 'viewer' ? (
          /* Viewer interface with weight controls and rankings */
          <div className="space-y-4">
            {players.length > 0 && Object.keys(grouped).length > 0 ? (
              <>
                {/* Age Group Selector */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                      Event Rankings & Analysis
                    </h2>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                      👁️ Viewer Mode
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Filter className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <select
                      value={selectedAgeGroup}
                      onChange={e => setSelectedAgeGroup(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-300 p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="all">All Players ({players.length} total)</option>
                      {Object.keys(grouped).map(group => (
                        <option key={group} value={group}>{group} ({grouped[group].length} players)</option>
                      ))}
                    </select>
                  </div>
                </div>

                {selectedLiveRankings && selectedLiveRankings.length > 0 ? (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* Compact Weight Controls for Viewers */}
                    <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          <span className="font-semibold text-sm">Explore Rankings: {selectedAgeGroup}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="bg-white/20 px-2 py-1 rounded-full text-xs">
                            {WEIGHT_PRESETS[activePreset]?.name || 'Custom'}
                          </span>
                          <span className="bg-white/10 px-2 py-1 rounded-full text-xs">
                            {selectedGroupScoredCount}/{selectedGroupPlayers.length} with scores ({selectedGroupCompletionPct}%)
                          </span>
                          <Link
                            to="/live-entry"
                            className="bg-white/20 hover:bg-white/30 text-white px-2 py-1 rounded text-xs font-medium"
                          >
                            Record Results
                          </Link>
                        </div>
                      </div>
                      
                      {/* Preset Buttons */}
                      <div className="flex gap-1 mb-3">
                        {Object.entries(WEIGHT_PRESETS).map(([key, preset]) => (
                          <button
                            key={key}
                            onClick={() => applyPreset(key)}
                            className={`px-2 py-1 text-xs rounded border transition-all flex-1 ${
                              activePreset === key 
                                ? 'border-white bg-white/20 text-white font-medium' 
                                : 'border-white/30 hover:border-white/60 text-white/80 hover:text-white'
                            }`}
                          >
                            {preset.name}
                          </button>
                        ))}
                      </div>

                      {/* Compact Sliders */}
                      <div className="bg-white/10 rounded p-2">
                        <div className="grid grid-cols-5 gap-2 text-xs">
                          {DRILLS.map((drill) => (
                            <div key={drill.key} className="text-center">
                              <div className="font-medium mb-1 truncate">{drill.label.replace(' ', '')}</div>
                              <input
                                type="range"
                                value={sliderWeights[drill.key] ?? 50}
                                min={0}
                                max={100}
                                step={5}
                                onInput={(e) => {
                                  // Visual feedback is now handled by the optimized hook
                                  // No need for immediate updates
                                }}
                                onChange={(e) => {
                                  // Use optimized weight change handler
                                  const newWeight = parseFloat(e.target.value);
                                  handleWeightChange(drill.key, newWeight);
                                }}
                                className="w-full h-1 rounded cursor-pointer accent-white"
                              />
                              <div className="font-mono font-bold text-xs mt-1">
                                {(sliderWeights[drill.key] || 0).toFixed(0)}%
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Helpful text for viewers */}
                      <div className="text-xs text-white/80 mt-2 text-center">
                        Adjust weights to see how rankings change with different priorities
                      </div>
                    </div>

                    {/* Low completion notice (viewer) */}
                    {selectedGroupPlayers.length > 0 && selectedGroupCompletionPct < 60 && (
                      <div className="mx-3 mt-2 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded p-2 text-xs">
                        Only {selectedGroupCompletionPct}% of players in this group have recorded scores. Rankings reflect available results and will update as more scores are entered.
                      </div>
                    )}

                    {/* Live Rankings */}
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-sm text-gray-900">Current Rankings</h4>
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full animate-pulse">
                          ⚡ Live Updates
                        </span>
                      </div>
                      
                      <div className="space-y-1">
                        {selectedLiveRankings.slice(0, 10).map((player, index) => (
                          <div key={player.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm">
                            <div className={`font-bold w-6 text-center ${
                              index === 0 ? "text-yellow-500" : 
                              index === 1 ? "text-gray-500" : 
                              index === 2 ? "text-orange-500" : "text-gray-400"
                            }`}>
                              {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}`}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 truncate">{player.name}</div>
                              <div className="text-xs text-gray-500">
                                Player #{player.number || 'N/A'}
                                {selectedAgeGroup === 'all' && ` - ${player.age_group}`}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-blue-600 text-sm">
                                 {(player.weightedScore ?? player.compositeScore ?? 0).toFixed(1)}
                              </div>
                              <div className="text-xs text-gray-500">points</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
                    <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="font-semibold text-gray-900 mb-2">📊 Waiting for Results</h3>
                    <p className="text-gray-600 mb-4">
                      Players in <strong>{selectedAgeGroup}</strong> need drill scores to generate rankings.
                    </p>
                    <p className="text-sm text-gray-500">
                      Check back once the combine event begins and scores are recorded!
                    </p>
                  </div>
                )}

                {/* Info box for viewers */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-blue-600 text-sm">🎯</span>
                    </div>
                    <div>
                      <p className="text-blue-800 font-medium text-sm mb-1">Explore Different Ranking Perspectives</p>
                      <p className="text-blue-700 text-sm">
                        Use the weight controls above to see how player rankings change based on different priorities. 
                        Try "Speed Focused" vs "Skills Focused" to see different perspectives on player performance!
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : players.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">No Participants Yet</h3>
                <p className="text-gray-600">
                  Players haven't been added to this event yet. Check back later!
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">📊 Players Added, Scores Coming Soon</h3>
                <p className="text-gray-600">
                  {players.length} players are registered for this event. Rankings will appear once drill scores are recorded!
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Organizer/Coach interface with tabs */
          <>
            {activeTab === 'players' && (
              <>
                {(userRole === 'organizer' || userRole === 'coach') && players.length > 0 && Object.keys(grouped).length > 0 ? (
                  <div className="space-y-4">
                    {/* Age Group Selector */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-cmf-primary" />
                          Player Rankings
                        </h2>
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                          ⚡ Real-Time
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Filter className="w-5 h-5 text-cmf-primary flex-shrink-0" />
                        <select
                          value={selectedAgeGroup}
                          onChange={e => setSelectedAgeGroup(e.target.value)}
                          className="flex-1 rounded-lg border border-gray-300 p-2 text-sm focus:ring-2 focus:ring-cmf-primary focus:border-cmf-primary"
                        >
                          <option value="all">All Players ({players.length} total)</option>
                          {Object.keys(grouped).map(group => (
                            <option key={group} value={group}>{group} ({grouped[group].length} players)</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {selectedLiveRankings && selectedLiveRankings.length > 0 ? (
                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        {/* Compact Weight Controls */}
                        <div className="bg-gradient-to-r from-cmf-primary to-cmf-secondary text-white p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <TrendingUp className="w-4 h-4" />
                              <span className="font-semibold text-sm">Top Prospects: {selectedAgeGroup}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="bg-white/20 px-2 py-1 rounded-full text-xs">
                                {WEIGHT_PRESETS[activePreset]?.name || 'Custom'}
                              </span>
                              <span className="bg-white/10 px-2 py-1 rounded-full text-xs">
                                {selectedGroupScoredCount}/{selectedGroupPlayers.length} with scores ({selectedGroupCompletionPct}%)
                              </span>
                              <Link
                                to="/live-entry"
                                className="bg-white/20 hover:bg-white/30 text-white px-2 py-1 rounded text-xs font-medium"
                              >
                                Record Results
                              </Link>
                            </div>
                          </div>
                          
                          {/* Preset Buttons */}
                          <div className="flex gap-1 mb-3">
                            {Object.entries(WEIGHT_PRESETS).map(([key, preset]) => (
                              <button
                                key={key}
                                onClick={() => applyPreset(key)}
                                className={`px-2 py-1 text-xs rounded border transition-all flex-1 ${
                                  activePreset === key 
                                    ? 'border-white bg-white/20 text-white font-medium' 
                                    : 'border-white/30 hover:border-white/60 text-white/80 hover:text-white'
                                }`}
                              >
                                {preset.name}
                              </button>
                            ))}
                          </div>

                          {/* Compact Sliders */}
                          <div className="bg-white/10 rounded p-2">
                            <div className="grid grid-cols-5 gap-2 text-xs">
                              {DRILLS.map((drill) => (
                                <div key={drill.key} className="text-center">
                                  <div className="font-medium mb-1 truncate">{drill.label.replace(' ', '')}</div>
                                  <input
                                    type="range"
                                    value={sliderWeights[drill.key] ?? 50}
                                    min={0}
                                    max={100}
                                    step={5}
                                    onChange={(e) => {
                                      // Use optimized weight change handler
                                      const newWeight = parseFloat(e.target.value);
                                      handleWeightChange(drill.key, newWeight);
                                    }}
                                    className="w-full h-1 rounded cursor-pointer accent-white"
                                  />
                                  <div className="font-mono font-bold text-xs mt-1">
                                    {(sliderWeights[drill.key] || 0).toFixed(0)}%
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Live Rankings */}
                        <div className="p-3">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-sm text-gray-900">Top Prospects</h4>
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full animate-pulse">
                              ⚡ Live
                            </span>
                          </div>
                          
                          <div className="space-y-1">
                            {selectedLiveRankings.slice(0, 10).map((player, index) => (
                              <div key={player.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm">
                                <div className={`font-bold w-6 text-center ${
                                  index === 0 ? "text-yellow-500" : 
                                  index === 1 ? "text-gray-500" : 
                                  index === 2 ? "text-orange-500" : "text-gray-400"
                                }`}>
                                  {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}`}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-gray-900 truncate">{player.name}</div>
                                  <div className="text-xs text-gray-500">
                                    Player #{player.number || 'N/A'}
                                    {selectedAgeGroup === 'all' && ` - ${player.age_group}`}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-cmf-primary text-sm">
                                    {(player.weightedScore ?? player.compositeScore ?? 0).toFixed(1)}
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setSelectedPlayer(player);
                                    }}
                                    className="text-xs text-blue-600 hover:text-blue-800"
                                  >
                                    View Details
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
                        <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <h3 className="font-semibold text-gray-900 mb-2">📊 Players Added, Scores Coming Soon</h3>
                        <p className="text-gray-600">
                          Rankings will appear as soon as results are recorded. You can still manage players below.
                        </p>
                      </div>
                    )}

                    {/* Player Management Section */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                          👥 Manage Players ({selectedAgeGroup === 'all' ? 'All Players' : selectedAgeGroup})
                          <span className="text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                            {selectedAgeGroup === 'all' ? players.length : (grouped[selectedAgeGroup]?.length || 0)} players
                          </span>
                        </h3>
                      </div>
                      
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {(selectedAgeGroup === 'all' ? players : (grouped[selectedAgeGroup] || [])).map((player) => (
                          <div key={player.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <h4 className="font-semibold text-gray-900">{player.name}</h4>
                                <p className="text-sm text-gray-600">
                                  Player #{player.number || 'N/A'}
                                  {selectedAgeGroup === 'all' && ` - ${player.age_group}`}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setSelectedPlayer(player);
                                }}
                                className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded-md text-sm font-medium transition"
                              >
                                View Stats & Weights
                              </button>
                              <button
                                onClick={() => setEditingPlayer(player)}
                                className="bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1 rounded-md text-sm font-medium transition"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => toggleForm(player.id)}
                                className="bg-cyan-100 hover:bg-cyan-200 text-cyan-700 px-3 py-1 rounded-md text-sm font-medium transition"
                              >
                                Add Result
                              </button>
                            </div>
                            
                            {expandedPlayerIds[player.id] && (
                              <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200 mt-3">
                                <DrillInputForm playerId={player.id} onSuccess={() => { 
                                  toggleForm(player.id); 
                                  // Invalidate cache on data update
                                  if (selectedEvent) {
                                    cacheInvalidation.playersUpdated(selectedEvent.id);
                                  }
                                  fetchPlayers(); 
                                }} />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : players.length === 0 ? (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
                    <p className="text-gray-500">No players found for this event.</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
                    <Settings className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="font-semibold text-gray-900 mb-2">Coach/Organizer Access Required</h3>
                    <p className="text-gray-500">Weight adjustments and prospect rankings are available for coaches and organizers only.</p>
                  </div>
                )}
              </>
            )}



            {selectedPlayer && (
              <PlayerDetailsModal 
                player={selectedPlayer} 
                allPlayers={players} 
                onClose={() => setSelectedPlayer(null)}
                persistedWeights={persistedWeights}
                sliderWeights={sliderWeights}
                setSliderWeights={setSliderWeights}
                persistSliderWeights={persistSliderWeights}
                handleWeightChange={handleWeightChange}
                activePreset={activePreset}
                applyPreset={applyPreset}
              />
            )}
            {editingPlayer && (
              <EditPlayerModal
                player={editingPlayer}
                allPlayers={players}
                onClose={() => setEditingPlayer(null)}
                onSave={() => {
                  // Invalidate cache on player edit
                  if (selectedEvent) {
                    cacheInvalidation.playersUpdated(selectedEvent.id);
                  }
                  fetchPlayers();
                }}
              />
            )}
            {showAddPlayerModal && (
              <AddPlayerModal
                allPlayers={players}
                onClose={() => setShowAddPlayerModal(false)}
                onSave={() => {
                  // Invalidate cache on player creation
                  if (selectedEvent) {
                    cacheInvalidation.playersUpdated(selectedEvent.id);
                  }
                  fetchPlayers();
                }}
              />
            )}
          </>
        )}



        {activeTab === 'exports' && (
          <>
            {Object.keys(grouped).length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Download className="w-5 h-5 text-cmf-primary" />
                    Download Rankings
                  </h2>
                  <div className="flex items-center gap-2 text-xs">
                    {(() => {
                      const total = players.length;
                      const scored = players.filter(p => p.composite_score != null).length;
                      const pct = total > 0 ? Math.round((scored / total) * 100) : 0;
                      return (
                        <span className="bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-1">
                          Overall: {scored}/{total} with scores ({pct}%)
                        </span>
                      );
                    })()}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  {/* Export All Players Button */}
                  {(() => {
                    const flatAll = Object.values(grouped).flat();
                    const allPlayers = flatAll.filter(p => p.composite_score != null);
                    const handleExportAllCsv = () => {
                      if (allPlayers.length === 0) return;
                      let csv = 'Rank,Name,Player Number,Age Group,Composite Score,40-Yard Dash,Vertical Jump,Catching,Throwing,Agility\n';
                      allPlayers
                        .sort((a, b) => (b.composite_score || 0) - (a.composite_score || 0))
                        .forEach((player, index) => {
                          csv += `${index + 1},"${player.name}",${player.number || 'N/A'},"${player.age_group || 'Unknown'}",${(player.composite_score || 0).toFixed(2)},${player["40m_dash"] || 'N/A'},${player.vertical_jump || 'N/A'},${player.catching || 'N/A'},${player.throwing || 'N/A'},${player.agility || 'N/A'}\n`;
                        });
                      const eventDate = selectedEvent ? new Date(selectedEvent.date).toISOString().slice(0,10) : 'event';
                      const filename = `rankings_all_players_${eventDate}_${allPlayers.length}-of-${flatAll.length}.csv`;
                      const blob = new Blob([csv], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = filename;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    };
                    
                    return allPlayers.length > 0 ? (
                      <button
                        onClick={handleExportAllCsv}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-lg font-medium transition text-left flex justify-between items-center mb-2 border-2 border-blue-200"
                      >
                        <div>
                          <div className="font-semibold">Export All Players</div>
                          <div className="text-sm opacity-75">Complete rankings across all age groups</div>
                        </div>
                        <div className="text-sm opacity-75">({allPlayers.length} with scores)</div>
                      </button>
                    ) : null;
                  })()}
                  
                  {/* Age Group Specific Exports */}
                  {Object.keys(grouped).sort().map(ageGroup => {
                    const ageGroupAll = grouped[ageGroup];
                    const ageGroupPlayers = ageGroupAll.filter(p => p.composite_score != null);
                    const handleExportCsv = () => {
                      if (ageGroupPlayers.length === 0) return;
                      let csv = 'Rank,Name,Player Number,Composite Score,40-Yard Dash,Vertical Jump,Catching,Throwing,Agility\n';
                      ageGroupPlayers
                        .sort((a, b) => (b.composite_score || 0) - (a.composite_score || 0))
                        .forEach((player, index) => {
                          csv += `${index + 1},"${player.name}",${player.number || 'N/A'},${(player.composite_score || 0).toFixed(2)},${player["40m_dash"] || 'N/A'},${player.vertical_jump || 'N/A'},${player.catching || 'N/A'},${player.throwing || 'N/A'},${player.agility || 'N/A'}\n`;
                        });
                      const eventDate = selectedEvent ? new Date(selectedEvent.date).toISOString().slice(0,10) : 'event';
                      const filename = `rankings_${ageGroup}_${eventDate}_${ageGroupPlayers.length}-of-${ageGroupAll.length}.csv`;
                      const blob = new Blob([csv], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = filename;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    };
                    
                    return (
                      <button
                        key={ageGroup}
                        onClick={handleExportCsv}
                        disabled={ageGroupPlayers.length === 0}
                        className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-4 rounded-lg font-medium transition text-left flex justify-between items-center"
                      >
                        <div>
                          <div className="font-semibold">Export {ageGroup} Rankings</div>
                          <div className="text-sm opacity-75">Full rankings with drill scores</div>
                        </div>
                        <div className="text-sm opacity-75">({ageGroupPlayers.length} with scores)</div>
                      </button>
                    );
                  })}
                </div>
                
                {Object.keys(grouped).length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No player data available for export. Upload players first.
                  </div>
                )}
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-cmf-primary" />
                Event Analytics
              </h2>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">{players.length}</div>
                  <div className="text-sm text-blue-700">Total Players</div>
                </div>
                
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">{Object.keys(grouped).length}</div>
                  <div className="text-sm text-green-700">Age Groups</div>
                </div>
                
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {players.filter(p => p.composite_score != null).length}
                  </div>
                  <div className="text-sm text-purple-700">With Scores</div>
                </div>
                
                <div className="bg-orange-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {Math.round((players.filter(p => p.composite_score != null).length / players.length) * 100)}%
                  </div>
                  <div className="text-sm text-orange-700">Completion</div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}