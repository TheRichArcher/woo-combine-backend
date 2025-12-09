import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Skeleton from '../components/Skeleton';
import { Link, useNavigate } from 'react-router-dom';
import { useEvent } from '../context/EventContext';
import { useAuth } from '../context/AuthContext';
import { usePlayerDetails } from '../context/PlayerDetailsContext';
import { ArrowLeft, Users, Target, Settings, Plus, BarChart3, TrendingUp } from 'lucide-react';
import api from '../lib/api';
// PERFORMANCE OPTIMIZATION: Add caching and optimized scoring for LiveStandings
import { withCache } from '../utils/dataCache';
import { logger } from '../utils/logger';
import { calculateOptimizedRankings, calculateOptimizedRankingsAcrossAll } from '../utils/optimizedScoring';
import { getDrillsFromTemplate, getPresetsFromTemplate } from '../constants/drillTemplates';
import PlayerDetailsModal from '../components/Players/PlayerDetailsModal';
import PlayerDetailsPanel from '../components/Players/PlayerDetailsPanel';

export default function LiveStandings() {
  const { selectedEvent } = useEvent();
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const [activeSchema, setActiveSchema] = useState(null);
  
  // Responsive layout state
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Fetch schema for active event
  useEffect(() => {
    if (selectedEvent?.drillTemplate) {
      const fetchSchema = async () => {
        try {
          const res = await api.get(`/sports/${selectedEvent.drillTemplate}/schema`);
          if (res.data) {
            setActiveSchema(res.data);
          }
        } catch (err) {
          console.warn("Failed to fetch schema:", err);
        }
      };
      fetchSchema();
    }
  }, [selectedEvent?.drillTemplate]);

  // Compute drills
  const allDrills = useMemo(() => {
    if (!selectedEvent) return [];
    
    let baseDrills = [];
    if (activeSchema && activeSchema.drills) {
      // Use fetched schema
      baseDrills = activeSchema.drills.map(d => ({
        key: d.key,
        label: d.label,
        unit: d.unit,
        lowerIsBetter: d.lower_is_better,
        category: d.category,
        min: d.min_value,
        max: d.max_value,
        defaultWeight: d.default_weight
      }));
    } else {
      // Fallback to local templates
      baseDrills = getDrillsFromTemplate(selectedEvent.drillTemplate);
    }

    const disabled = selectedEvent.disabled_drills || [];
    const templateDrills = baseDrills.filter(d => !disabled.includes(d.key));
    
    const customDrills = selectedEvent.custom_drills || [];
    const formattedCustomDrills = customDrills.map(d => ({
      key: d.id,
      label: d.name,
      unit: d.unit,
      lowerIsBetter: d.lower_is_better,
      category: d.category || 'custom',
      isCustom: true
    }));
    return [...templateDrills, ...formattedCustomDrills];
  }, [selectedEvent, activeSchema]);

  // Compute presets
  const currentPresets = useMemo(() => {
    if (activeSchema && activeSchema.presets) {
      return activeSchema.presets;
    }
    return getPresetsFromTemplate(selectedEvent?.drillTemplate) || {};
  }, [activeSchema, selectedEvent]);
  
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weights, setWeights] = useState({});
  const [activePreset, setActivePreset] = useState('balanced');
  const [selectedAgeGroup, setSelectedAgeGroup] = useState('ALL');
  const [normalizeAcrossAll, setNormalizeAcrossAll] = useState(true);
  const [displayCount, setDisplayCount] = useState(3); // number of players to show in list (default 3; -1 means All)
  // const [selectedPlayer, setSelectedPlayer] = useState(null);
  const { selectedPlayer, openDetails, closeDetails } = usePlayerDetails();

  // Initialize weights when drills change
  useEffect(() => {
    if (allDrills.length > 0) {
        const initialWeights = {};
        allDrills.forEach(drill => {
            // Use default weight from schema if available (scale to 0-100)
            // If default_weight is < 1 (e.g. 0.2), multiply by 100. If > 1, use as is.
            const def = drill.defaultWeight !== undefined ? drill.defaultWeight : 0;
            initialWeights[drill.key] = def <= 1 ? def * 100 : def;
        });
        setWeights(initialWeights);
        
        // If we have a balanced preset, try to apply it by default if no specific defaults set
        // Actually, the logic above sets based on drill defaults.
        // Let's check if we should default to 'balanced' preset explicitly
        if (currentPresets['balanced']) {
             // We could force apply it, but setting based on default weights is usually safer/more generic
             // If we want to match the preset:
             // setActivePreset('balanced');
        }
    }
  }, [allDrills]); // Only re-run when drills definition changes

  // PERFORMANCE OPTIMIZATION: Cached fetch for LiveStandings
  const cachedFetchPlayersLive = withCache(
    async (eventId) => {
      const response = await api.get(`/players?event_id=${eventId}`);
      return response.data || [];
    },
    'live-players',
    15 * 1000 // 15s cache for live rankings data
  );

  // Fetch players
  const fetchPlayers = useCallback(async () => {
    if (!selectedEvent) return;
    
    try {
      setLoading(true);
      const playersData = await cachedFetchPlayersLive(selectedEvent.id);
      setPlayers(playersData);
    } catch (error) {
      logger.error('LIVE_STANDINGS', 'Failed to fetch players', error);
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, [selectedEvent]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  // PERFORMANCE OPTIMIZATION: Use optimized rankings calculation
  const ageGroups = useMemo(() => {
    const groups = new Set();
    players.forEach(p => { if (p.age_group) groups.add(p.age_group); });
    return ['ALL', ...Array.from(groups).sort()];
  }, [players]);

  const filteredPlayers = useMemo(() => {
    if (selectedAgeGroup === 'ALL') return players;
    return players.filter(p => p.age_group === selectedAgeGroup);
  }, [players, selectedAgeGroup]);

  const liveRankings = useMemo(() => {
    if (!filteredPlayers.length) return [];
    const source = normalizeAcrossAll && selectedAgeGroup === 'ALL'
      ? calculateOptimizedRankingsAcrossAll(filteredPlayers, weights, allDrills)
      : calculateOptimizedRankings(filteredPlayers, weights, allDrills);
    // Include players even if composite score is 0 so the dropdown represents a max, not a minimum
    return source;
  }, [filteredPlayers, weights, normalizeAcrossAll, selectedAgeGroup, allDrills]);

  const displayLimit = useMemo(() => (displayCount === -1 ? liveRankings.length : displayCount), [displayCount, liveRankings.length]);

  // Handle weight changes
  const handleWeightChange = (drillKey, value) => {
    setWeights(prev => ({ ...prev, [drillKey]: value }));
    setActivePreset(''); // Clear preset when manually adjusting
  };

  // Apply preset weights
  const applyPreset = (presetKey) => {
    if (currentPresets[presetKey]) {
      const newWeights = {};
      Object.entries(currentPresets[presetKey].weights).forEach(([key, value]) => {
        newWeights[key] = value * 100; // Convert to percentage
      });
      setWeights(newWeights);
      setActivePreset(presetKey);
    }
  };

  if (!selectedEvent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Event Selected</h2>
          <p className="text-gray-600 mb-4">Please select an event to view standings.</p>
          <Link to="/dashboard" className="text-blue-600 hover:text-blue-700 underline">
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/live-entry" className="text-gray-600 hover:text-gray-900">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Live Standings</h1>
              <p className="text-sm text-gray-600">{selectedEvent.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs bg-semantic-success/10 text-semantic-success px-3 py-1 rounded-full font-medium">
              ✨ Live Updates
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Content Column */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">
        
        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link
              to="/live-entry"
              className="flex items-center gap-2 p-3 bg-semantic-success/10 hover:bg-semantic-success/20 rounded-lg border border-semantic-success/20 transition"
            >
              <Target className="w-4 h-4 text-semantic-success" />
              <span className="text-sm font-medium text-semantic-success">Continue Recording</span>
            </Link>
            <Link
              to="/players/rankings"
              className="flex items-center gap-2 p-3 bg-brand-light/20 hover:bg-brand-light/30 rounded-lg border border-brand-primary/20 transition"
            >
              <Users className="w-4 h-4 text-brand-primary" />
              <span className="text-sm font-medium text-brand-secondary">Full Player View</span>
            </Link>
          </div>
        </div>

        {/* Filters & Weight Controls */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-gray-600" />
              <h2 className="font-semibold text-gray-900">Ranking Controls</h2>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={normalizeAcrossAll}
                  onChange={(e) => setNormalizeAcrossAll(e.target.checked)}
                />
                Normalize across all players
              </label>
              <select
                value={selectedAgeGroup}
                onChange={(e) => setSelectedAgeGroup(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1"
              >
                {ageGroups.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Adjust drill importance for live ranking calculations
          </p>
          
          {/* Preset Buttons */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {Object.entries(currentPresets).map(([key, preset]) => (
              <button 
                key={key}
                onClick={() => applyPreset(key)} 
                className={`p-3 text-left rounded-lg border-2 transition-all ${
                  activePreset === key 
                    ? 'border-brand-primary bg-brand-primary/10 text-brand-secondary' 
                    : 'border-gray-200 hover:border-brand-primary/50 bg-white text-gray-700'
                }`}
              >
                <div className="font-medium text-sm">{preset.name}</div>
                <div className="text-xs opacity-75">{preset.description}</div>
              </button>
            ))}
          </div>

          {/* Weight Sliders */}
          <div className="space-y-3">
            {allDrills.map((drill) => (
              <div key={drill.key} className="flex items-center justify-between">
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-700">{drill.label}</label>
                  <div className="text-xs text-gray-500">{drill.unit}</div>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={weights[drill.key] || 0}
                    onChange={(e) => handleWeightChange(drill.key, parseInt(e.target.value))}
                    className="w-24 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-primary"
                  />
                  <span className="text-sm font-mono text-brand-primary bg-brand-primary/10 px-2 py-1 rounded min-w-[40px] text-center">
                    {Math.round(weights[drill.key] || 0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Rankings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Current Rankings</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">Show</span>
              <select
                value={displayCount === -1 ? 'all' : String(displayCount)}
                onChange={(e) => setDisplayCount(e.target.value === 'all' ? -1 : parseInt(e.target.value, 10))}
                className="text-xs bg-brand-primary/10 text-brand-primary px-2 py-1 rounded-full border border-brand-primary/20"
              >
                <option value="3">3</option>
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="all">All</option>
              </select>
              <span className="text-xs text-gray-400">of {liveRankings.length}</span>
            </div>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : liveRankings.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-500 mb-2">No rankings yet</div>
              <div className="text-sm text-gray-400">Start recording drill results to see live standings</div>
            </div>
          ) : (
            <div className="space-y-2">
              {liveRankings.slice(0, displayLimit).map((player, index) => (
                <div 
                  key={player.id} 
                  onClick={() => openDetails(player, { suppressGlobalModal: isDesktop })}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:shadow-md transition-shadow ${
                    index === 0 ? 'bg-semantic-success/10 border-semantic-success/20' :
                    index < 3 ? 'bg-yellow-50 border-yellow-200' :
                    'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      index === 0 ? 'bg-semantic-success text-white' :
                      index < 3 ? 'bg-yellow-500 text-white' :
                      'bg-gray-500 text-white'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{player.name}</div>
                      <div className="text-sm text-gray-600">#{player.number}</div>
                      <div className="text-xs mt-1">
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/live-entry?player=${encodeURIComponent(player.number || '')}`);
                          }}
                          className="text-brand-primary hover:text-brand-secondary underline cursor-pointer"
                        >
                          Record this player
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-brand-primary">{player.compositeScore.toFixed(1)}</div>
                    <div className="text-xs text-gray-500">score</div>
                  </div>
                </div>
              ))}
              
              {liveRankings.length > displayLimit && (
                <div className="text-center pt-2">
                  <Link 
                    to="/players/rankings"
                    className="text-brand-primary hover:text-brand-secondary text-sm font-medium"
                  >
                    View all {liveRankings.length} players →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Access to Advanced Features */}
        {(userRole === 'organizer' || userRole === 'coach') && liveRankings.length >= 3 && (
          <div className="bg-brand-primary/5 border border-brand-primary/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="text-brand-secondary">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-brand-secondary mb-1">Advanced Tools Available</h3>
                <p className="text-gray-600 text-sm mb-3">
                  You have enough data to use advanced features
                </p>
                <div className="flex gap-2">
                  <Link
                    to="/team-formation"
                    className="text-xs bg-white text-brand-secondary px-3 py-1.5 rounded-lg border border-brand-secondary/20 hover:bg-brand-secondary/5 transition font-medium"
                  >
                    Create Teams
                  </Link>
                  <Link
                    to="/analytics"
                    className="text-xs bg-white text-brand-secondary px-3 py-1.5 rounded-lg border border-brand-secondary/20 hover:bg-brand-secondary/5 transition font-medium"
                  >
                    Full Analytics
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>

        {/* Sidebar Column (Desktop Only) */}
        <div className="hidden lg:block lg:col-span-5 xl:col-span-4">
           <div className="sticky top-6">
              {selectedPlayer ? (
                 <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-[calc(100vh-8rem)]">
                    <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                       <div>
                          <h3 className="font-bold text-gray-900">{selectedPlayer.name}</h3>
                          <p className="text-xs text-gray-500">#{selectedPlayer.number}</p>
                       </div>
                       <div className="text-right">
                          <div className="text-sm font-bold text-brand-primary">
                             {(selectedPlayer.compositeScore || 0).toFixed(1)} pts
                          </div>
                       </div>
                    </div>
                    <div className="h-full overflow-y-auto">
                      <PlayerDetailsPanel 
                        player={selectedPlayer} 
                        allPlayers={players} 
                        persistedWeights={weights}
                        sliderWeights={weights}
                        persistSliderWeights={setWeights}
                        handleWeightChange={handleWeightChange}
                        activePreset={activePreset}
                        applyPreset={applyPreset}
                        drills={allDrills}
                        presets={currentPresets}
                      />
                    </div>
                 </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center h-64 flex flex-col items-center justify-center text-gray-400">
                   <TrendingUp className="w-12 h-12 mb-3 opacity-20" />
                   <p className="font-medium">Select a player to view detailed stats</p>
                   <p className="text-sm mt-1 opacity-70">Click on any player in the rankings list</p>
                </div>
              )}
           </div>
        </div>
      </div>

      {/* Player Details Modal logic is now handled by Global Context (for mobile) */}
    </div>
  );
}