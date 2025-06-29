import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import DrillInputForm from "../components/DrillInputForm";
import EditPlayerModal from "../components/Players/EditPlayerModal";
import PlayerDetailsModal from "../components/Players/PlayerDetailsModal";
import WeightControls from "../components/Players/WeightControls";

import { useEvent } from "../context/EventContext";
import { useAuth } from "../context/AuthContext";
import { usePlayerRankings } from "../hooks/usePlayerRankings";
import { useWeightManagement } from "../hooks/useWeightManagement";
import EventSelector from "../components/EventSelector";
import api from '../lib/api';
import { TrendingUp, Users, BarChart3, Download, Filter } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { parseISO, isValid, format } from 'date-fns';
import WelcomeLayout from "../components/layouts/WelcomeLayout";

// Import constants from centralized location
import { DRILLS, PLAYER_TABS, DEFAULT_WEIGHTS, WEIGHT_PRESETS } from '../constants/players';



// EditPlayerModal and PlayerDetailsModal now imported from separate component files

export default function Players() {
  const { selectedEvent } = useEvent();
  const { user, selectedLeagueId, userRole } = useAuth();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedPlayerIds, setExpandedPlayerIds] = useState({});
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [editingPlayer, setEditingPlayer] = useState(null);
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
  const [searchTerm, setSearchTerm] = useState("");

  // Initialize custom hooks for ranking and weight management
  const { calculateRankingsForGroup } = usePlayerRankings();
  
  // Live ranking state  
  const [liveRankings, setLiveRankings] = useState({});

  // Initialize weight management hook
  const {
    persistedWeights,
    sliderWeights,
    activePreset,
    applyPreset,
    handleWeightChange,
    persistSliderWeights,
    updateSliderWeights: setSliderWeights,
    resetWeights: setActivePreset
  } = useWeightManagement((newWeights) => {
    // Callback when weights change - trigger live rankings recalculation
    calculateLiveRankings(newWeights);
  });

  // Filter players based on search term
  const filteredPlayers = useMemo(() => {
    if (!searchTerm.trim()) {
      return players;
    }
    
    const term = searchTerm.toLowerCase().trim();
    return players.filter(player => {
      // Search by name
      const nameMatch = player.name?.toLowerCase().includes(term);
      // Search by player number
      const numberMatch = player.number?.toString().includes(term);
      // Search by age group
      const ageGroupMatch = player.age_group?.toLowerCase().includes(term);
      
      return nameMatch || numberMatch || ageGroupMatch;
    });
  }, [players, searchTerm]);

  // Calculate grouped data for weight controls (using filtered players)
  const grouped = useMemo(() => {
    return filteredPlayers.reduce((acc, player) => {
      const ageGroup = player.age_group || 'Unknown';
      if (!acc[ageGroup]) acc[ageGroup] = [];
      acc[ageGroup].push(player);
      return acc;
    }, {});
  }, [filteredPlayers]);

  // Ranking calculation now handled by custom hook

  // 🏆 Live ranking calculation function
  const calculateLiveRankings = useCallback((weightsToUse = null) => {
    const weights = weightsToUse || persistedWeights;
    const newRankings = {};
    
    // Calculate "All Players" rankings first (using filtered players)
    const allPlayersWithScores = filteredPlayers.filter(player => 
      DRILLS.some(drill => player[drill.key] != null && typeof player[drill.key] === 'number')
    );
    
    if (allPlayersWithScores.length > 0) {
      newRankings['all'] = calculateRankingsForGroup(allPlayersWithScores, weights);
    }
    
    // Process each age group
    Object.entries(grouped).forEach(([ageGroup, ageGroupPlayers]) => {
      newRankings[ageGroup] = calculateRankingsForGroup(ageGroupPlayers, weights);
    });
    
    setLiveRankings(newRankings);
    
    return newRankings;
  }, [grouped, filteredPlayers, calculateRankingsForGroup, persistedWeights]);



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
      
      if (selectedPlayer) {
        const updatedPlayer = res.data.find(p => p.id === selectedPlayer.id);
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
  }, [selectedEvent, user, selectedLeagueId]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  // Calculate initial live rankings when filtered players or weights change
  useEffect(() => {
    if (filteredPlayers.length > 0) {
      calculateLiveRankings();
    }
  }, [filteredPlayers, calculateLiveRankings]);

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

  // MobileWeightControls component for weight adjustments
  const MobileWeightControls = ({ showSliders = false }) => {
    const sliderRefs = useRef({});
    const [localWeights, setLocalWeights] = useState(sliderWeights);
    const [showCustomControls, setShowCustomControls] = useState(false);
    
    // Sync local weights when sliderWeights change
    useEffect(() => {
      setLocalWeights(sliderWeights);
    }, [sliderWeights]);
    
    // Persist weights function
    const persistWeights = useCallback(() => {
      Object.entries(localWeights).forEach(([key, value]) => {
        handleWeightChange(key, value);
      });
    }, [localWeights, handleWeightChange]);
    
    // Always call hooks at the top level before any conditional logic
    useEffect(() => {
      if (showSliders && !showCustomControls) {
        setShowCustomControls(true);
      }
    }, [showSliders, showCustomControls]);
    
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
                    {localWeights[drill.key]}
                  </span>
                </div>
                
                <div className="touch-none">
                  <input
                    type="range"
                    ref={(el) => (sliderRefs.current[drill.key] = el)}
                    defaultValue={localWeights[drill.key] ?? 50}
                    min={0}
                    max={100}
                    step={1}
                    onInput={(e) => {
                      const newWeight = parseInt(e.target.value, 10);
                      setLocalWeights((prev) => ({ ...prev, [drill.key]: newWeight }));
                    }}
                    onPointerUp={persistWeights}
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
  };

  if (!selectedEvent || !selectedEvent.id) return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-900 via-blue-900 to-cyan-700">
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
    <div className="min-h-screen bg-gradient-to-br from-cyan-900 via-blue-900 to-cyan-700">
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
        <div className="min-h-screen bg-gradient-to-br from-cyan-900 via-blue-900 to-cyan-700">
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
      <div className="min-h-screen bg-gradient-to-br from-cyan-900 via-blue-900 to-cyan-700">
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <div className="text-red-500 font-semibold">Error: {error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (players.length === 0) return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-900 via-blue-900 to-cyan-700">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center border-2 border-blue-200">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-8 h-8 text-cmf-primary" />
          </div>
          <h2 className="text-2xl font-bold text-cmf-primary mb-4">No Players Found Yet</h2>
          <p className="text-gray-600 mb-6">You can upload a CSV or add them manually to get started.</p>
          <div className="flex gap-3 justify-center">
            <Link to="/admin#player-upload-section" className="bg-cmf-primary text-white font-bold px-4 py-2 rounded-lg shadow hover:bg-cmf-secondary transition">
              Upload CSV
            </Link>
            <Link to="/admin#player-upload-section" className="bg-cmf-secondary text-white font-bold px-4 py-2 rounded-lg shadow hover:bg-cmf-primary transition">
              Add Player
            </Link>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <WelcomeLayout
      contentClassName="min-h-screen"
      hideHeader={true}
      showOverlay={false}
    >
      <div className="w-full max-w-lg mx-auto px-4">
        {/* Header Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 mb-6 text-center">
          {/* Logo */}
          <div className="text-center mb-4">
            <img
              src="/favicon/woocombine-logo.png"
              alt="Woo-Combine Logo"
              className="w-12 h-12 mx-auto mb-3"
              style={{ objectFit: 'contain' }}
            />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            WooCombine: Players & Rankings
          </h1>
          <p className="text-gray-600 mb-4">
            Managing: <strong>{selectedEvent.name}</strong> - {
              selectedEvent.date && isValid(parseISO(selectedEvent.date))
                ? format(parseISO(selectedEvent.date), 'MM/dd/yyyy')
                : 'Date TBD'
            }
          </p>
          
          <div className="flex gap-2 flex-wrap justify-center">
            {(userRole === 'organizer' || userRole === 'coach') && (
              <Link
                to="/live-entry"
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2"
              >
                🚀 Live Entry
              </Link>
            )}
            {userRole === 'organizer' && (
              <Link
                to="/admin"
                className="bg-cmf-primary hover:bg-cmf-secondary text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2"
              >
                ⚙️ Admin Tools
              </Link>
            )}
          </div>
        </div>



        {/* Role-based interface - Tabs only for organizers/coaches */}
        {(userRole === 'organizer' || userRole === 'coach') ? (
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 mb-6 overflow-hidden">
            <div className="flex border-b border-gray-200">
              {PLAYER_TABS.map((tab) => {
                const Icon = tab.icon === 'Users' ? Users : Download;
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
            
            <div className="px-4 py-2 bg-gray-50 text-xs text-gray-600 text-center">
              {PLAYER_TABS.find(tab => tab.id === activeTab)?.description}
            </div>
          </div>
        ) : (
          /* Viewer header */
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 mb-6 p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Users className="w-5 h-5 text-cmf-primary" />
              <h2 className="font-semibold text-gray-900">Event Participants</h2>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                👁️ View Only
              </span>
            </div>
            <p className="text-sm text-gray-600">
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
                {/* Search & Filter Controls */}
                <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                      Event Rankings & Analysis
                    </h2>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                      👁️ Viewer Mode
                    </span>
                  </div>
                  
                  {/* Search Input */}
                  <div className="mb-3">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search players by name, number, or age group..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <Users className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                      {searchTerm && (
                        <button
                          onClick={() => setSearchTerm('')}
                          className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {searchTerm && (
                      <p className="text-xs text-blue-600 mt-1">
                        Found {filteredPlayers.length} player{filteredPlayers.length !== 1 ? 's' : ''} matching "{searchTerm}"
                      </p>
                    )}
                  </div>
                  
                  {/* Age Group Filter */}
                  <div className="flex items-center gap-3">
                    <Filter className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <select
                      value={selectedAgeGroup}
                      onChange={e => setSelectedAgeGroup(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-300 p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="all">All Players ({filteredPlayers.length} total)</option>
                      {Object.keys(grouped).map(group => (
                        <option key={group} value={group}>{group} ({grouped[group].length} players)</option>
                      ))}
                    </select>
                  </div>
                </div>

                {liveRankings[selectedAgeGroup] && liveRankings[selectedAgeGroup].length > 0 ? (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* Compact Weight Controls for Viewers */}
                    <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          <span className="font-semibold text-sm">Explore Rankings: {selectedAgeGroup}</span>
                        </div>
                        <span className="bg-white/20 px-2 py-1 rounded-full text-xs">
                          {WEIGHT_PRESETS[activePreset]?.name || 'Custom'}
                        </span>
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
                                  // Update weight immediately for smooth visual feedback
                                  const newWeight = parseInt(e.target.value, 10);
                                  setSliderWeights(prev => ({ ...prev, [drill.key]: newWeight }));
                                }}
                                onChange={(e) => {
                                  // Debounced calculation on change complete
                                  const newWeight = parseInt(e.target.value, 10);
                                  const newWeights = { ...sliderWeights, [drill.key]: newWeight };
                                  calculateLiveRankings(newWeights);
                                  setActivePreset('');
                                }}
                                className="w-full h-1 rounded cursor-pointer accent-white"
                              />
                              <div className="font-mono font-bold text-xs mt-1">
                                {sliderWeights[drill.key] || 0}
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

                    {/* Live Rankings */}
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-sm text-gray-900">Current Rankings</h4>
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full animate-pulse">
                          ⚡ Live Updates
                        </span>
                      </div>
                      
                      <div className="space-y-1">
                        {liveRankings[selectedAgeGroup].slice(0, 10).map((player, index) => (
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
                                {selectedAgeGroup === 'all' && ` • ${player.age_group}`}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-blue-600 text-sm">
                                {player.weightedScore.toFixed(1)}
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
            ) : filteredPlayers.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">🔍 No Matching Players</h3>
                <p className="text-gray-600 mb-3">
                  No players found matching "{searchTerm}". Try a different search term.
                </p>
                <button
                  onClick={() => setSearchTerm('')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition"
                >
                  Clear Search
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">📊 Players Added, Scores Coming Soon</h3>
                <p className="text-gray-600">
                  {filteredPlayers.length} players {searchTerm ? `matching "${searchTerm}" ` : ''}are registered for this event. Rankings will appear once drill scores are recorded!
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
                    {/* Search & Filter Controls */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-cmf-primary" />
                          Player Management & Prospect Rankings
                        </h2>
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                          ⚡ Real-Time
                        </span>
                      </div>
                      
                      {/* Search Input */}
                      <div className="mb-3">
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Search players by name, number, or age group..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cmf-primary focus:border-cmf-primary"
                          />
                          <Users className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                          {searchTerm && (
                            <button
                              onClick={() => setSearchTerm('')}
                              className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        {searchTerm && (
                          <p className="text-xs text-cmf-primary mt-1">
                            Found {filteredPlayers.length} player{filteredPlayers.length !== 1 ? 's' : ''} matching "{searchTerm}"
                          </p>
                        )}
                      </div>
                      
                      {/* Age Group Filter */}
                      <div className="flex items-center gap-3">
                        <Filter className="w-5 h-5 text-cmf-primary flex-shrink-0" />
                        <select
                          value={selectedAgeGroup}
                          onChange={e => setSelectedAgeGroup(e.target.value)}
                          className="flex-1 rounded-lg border border-gray-300 p-2 text-sm focus:ring-2 focus:ring-cmf-primary focus:border-cmf-primary"
                        >
                          <option value="all">All Players ({filteredPlayers.length} total)</option>
                          {Object.keys(grouped).map(group => (
                            <option key={group} value={group}>{group} ({grouped[group].length} players)</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {liveRankings[selectedAgeGroup] && liveRankings[selectedAgeGroup].length > 0 ? (
                      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
                        {/* Compact Weight Controls */}
                        <div className="bg-gradient-to-r from-cmf-primary to-cmf-secondary text-white p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <TrendingUp className="w-4 h-4" />
                              <span className="font-semibold text-sm">Top Prospects: {selectedAgeGroup}</span>
                            </div>
                            <span className="bg-white/20 px-2 py-1 rounded-full text-xs">
                              {WEIGHT_PRESETS[activePreset]?.name || 'Custom'}
                            </span>
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
                                      // Update weight immediately for smooth visual feedback
                                      const newWeight = parseInt(e.target.value, 10);
                                      setSliderWeights(prev => ({ ...prev, [drill.key]: newWeight }));
                                    }}
                                    onChange={(e) => {
                                      // Debounced calculation on change complete
                                      const newWeight = parseInt(e.target.value, 10);
                                      const newWeights = { ...sliderWeights, [drill.key]: newWeight };
                                      calculateLiveRankings(newWeights);
                                      setActivePreset('');
                                    }}
                                    className="w-full h-1 rounded cursor-pointer accent-white"
                                  />
                                  <div className="font-mono font-bold text-xs mt-1">
                                    {sliderWeights[drill.key] || 0}
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
                            {liveRankings[selectedAgeGroup].slice(0, 10).map((player, index) => (
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
                                    {selectedAgeGroup === 'all' && ` • ${player.age_group}`}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-cmf-primary text-sm">
                                    {player.weightedScore.toFixed(1)}
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
                        <h3 className="font-semibold text-gray-900 mb-2">🏃‍♂️ Ready for Analysis!</h3>
                        <p className="text-gray-600 mb-4">
                          Players in <strong>{selectedAgeGroup}</strong> need drill scores to generate rankings.
                        </p>
                        <Link to="/live-entry" className="inline-block bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition">
                          📊 Start Recording Scores
                        </Link>
                      </div>
                    )}

                    {/* Player Management Section */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                          👥 Manage Players ({selectedAgeGroup === 'all' ? 'All Players' : selectedAgeGroup})
                          <span className="text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                            {selectedAgeGroup === 'all' ? filteredPlayers.length : (grouped[selectedAgeGroup]?.length || 0)} players
                          </span>
                        </h3>
                      </div>
                      
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {(selectedAgeGroup === 'all' ? filteredPlayers : (grouped[selectedAgeGroup] || [])).map((player) => (
                          <div key={player.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <h4 className="font-semibold text-gray-900">{player.name}</h4>
                                <p className="text-sm text-gray-600">
                                  Player #{player.number || 'N/A'}
                                  {selectedAgeGroup === 'all' && ` • ${player.age_group}`}
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
                                <DrillInputForm playerId={player.id} onSuccess={() => { toggleForm(player.id); fetchPlayers(); }} />
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
                ) : filteredPlayers.length === 0 ? (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="font-semibold text-gray-900 mb-2">🔍 No Matching Players</h3>
                    <p className="text-gray-600 mb-3">
                      No players found matching "{searchTerm}". Try a different search term.
                    </p>
                    <button
                      onClick={() => setSearchTerm('')}
                      className="bg-cmf-primary hover:bg-cmf-secondary text-white px-4 py-2 rounded-lg text-sm transition"
                    >
                      Clear Search
                    </button>
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
                allPlayers={filteredPlayers} 
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
                allPlayers={filteredPlayers}
                onClose={() => setEditingPlayer(null)}
                onSave={fetchPlayers}
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
                    Export Rankings by Age Group
                  </h2>
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  {Object.keys(grouped).sort().map(ageGroup => {
                    const ageGroupPlayers = grouped[ageGroup].filter(p => p.composite_score != null);
                    const handleExportCsv = () => {
                      if (ageGroupPlayers.length === 0) return;
                      let csv = 'Rank,Name,Player Number,Composite Score,40-Yard Dash,Vertical Jump,Catching,Throwing,Agility\n';
                      ageGroupPlayers
                        .sort((a, b) => (b.composite_score || 0) - (a.composite_score || 0))
                        .forEach((player, index) => {
                          csv += `${index + 1},"${player.name}",${player.number || 'N/A'},${(player.composite_score || 0).toFixed(2)},${player["40m_dash"] || 'N/A'},${player.vertical_jump || 'N/A'},${player.catching || 'N/A'},${player.throwing || 'N/A'},${player.agility || 'N/A'}\n`;
                        });
                      const eventDate = selectedEvent ? new Date(selectedEvent.date).toISOString().slice(0,10) : 'event';
                      const filename = `rankings_${ageGroup}_${eventDate}.csv`;
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
                        <div className="text-sm opacity-75">({ageGroupPlayers.length} players)</div>
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
    </WelcomeLayout>
  );
}// Force rebuild Sat Jun 28 16:38:50 EDT 2025
