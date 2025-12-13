import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Skeleton from '../components/Skeleton';
import { Link, useNavigate } from 'react-router-dom';
import { useEvent } from '../context/EventContext';
import { useAuth } from '../context/AuthContext';
import { usePlayerDetails } from '../context/PlayerDetailsContext';
import { ArrowLeft, Users, Target, Settings, Plus, BarChart3, TrendingUp, ChevronDown, ChevronRight, Filter } from 'lucide-react';
import api from '../lib/api';
// PERFORMANCE OPTIMIZATION: Add caching and optimized scoring for LiveStandings
import { withCache } from '../utils/dataCache';
import { logger } from '../utils/logger';
import { calculateOptimizedRankings, calculateOptimizedRankingsAcrossAll } from '../utils/optimizedScoring';
import { getDrillsFromTemplate, getPresetsFromTemplate } from '../constants/drillTemplates';

export default function LiveStandings() {
  const { selectedEvent } = useEvent();
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const [activeSchema, setActiveSchema] = useState(null);
  
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
  const [displayCount, setDisplayCount] = useState(10); // Default to 10
  const { selectedPlayer, openDetails, closeDetails } = usePlayerDetails();
  const [showControls, setShowControls] = useState(false);
  const [showCompactSliders, setShowCompactSliders] = useState(false);

  // Initialize weights when drills change
  useEffect(() => {
    if (allDrills.length > 0) {
        const initialWeights = {};
        allDrills.forEach(drill => {
            // Use default weight from schema if available (scale to 0-100)
            const def = drill.defaultWeight !== undefined ? drill.defaultWeight : 0;
            initialWeights[drill.key] = def <= 1 ? def * 100 : def;
        });
        setWeights(initialWeights);
    }
  }, [allDrills]); 

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
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
        
        {/* Header Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-4 border-2 border-blue-200">
          <div className="flex items-center justify-between mb-4">
             <Link to="/live-entry" className="text-gray-500 hover:text-gray-700">
               <ArrowLeft className="w-6 h-6" />
             </Link>
             <div className="text-xs bg-semantic-success/10 text-semantic-success px-3 py-1 rounded-full font-medium">
               ✨ Live Updates
             </div>
          </div>
          
          <h1 className="text-2xl font-bold text-cmf-secondary mb-2">
            Live Standings
          </h1>
          <p className="text-gray-600 mb-4">{selectedEvent.name}</p>
          
          <div className="grid grid-cols-2 gap-2">
            <Link
              to="/live-entry"
              className="flex items-center justify-center gap-2 p-3 bg-semantic-success/10 hover:bg-semantic-success/20 rounded-xl border border-semantic-success/20 transition text-semantic-success font-medium"
            >
              <Target className="w-4 h-4" />
              <span>Record</span>
            </Link>
            <Link
              to="/players/rankings"
              className="flex items-center justify-center gap-2 p-3 bg-brand-light/20 hover:bg-brand-light/30 rounded-xl border border-brand-primary/20 transition text-brand-secondary font-medium"
            >
              <Users className="w-4 h-4 text-brand-primary" />
              <span>Players</span>
            </Link>
          </div>
        </div>

        {/* Controls & Filters (Collapsible) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-4 overflow-hidden">
           <button 
            onClick={() => setShowControls(!showControls)}
            className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <span className="font-semibold text-gray-900 flex items-center gap-2">
              {showControls ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
              Ranking Controls
            </span>
            {!showControls && <span className="text-xs text-gray-500">Tap to adjust weights</span>}
          </button>
          
          {showControls && (
            <div className="p-4 border-t border-gray-200">
              <div className="flex items-center justify-between gap-2 mb-4">
                 <div className="flex items-center gap-2 w-full">
                    <Filter className="w-4 h-4 text-gray-500" />
                    <select
                        value={selectedAgeGroup}
                        onChange={(e) => setSelectedAgeGroup(e.target.value)}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                        {ageGroups.map(g => (
                        <option key={g} value={g}>{g === 'ALL' ? 'All Ages' : g}</option>
                        ))}
                    </select>
                 </div>
              </div>
              
              <div className="mb-4">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer p-2 bg-gray-50 rounded-lg">
                    <input
                      type="checkbox"
                      checked={normalizeAcrossAll}
                      onChange={(e) => setNormalizeAcrossAll(e.target.checked)}
                      className="rounded text-brand-primary focus:ring-brand-primary"
                    />
                    <span>Normalize scores across all players</span>
                  </label>
              </div>

              {/* Presets */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {Object.entries(currentPresets).map(([key, preset]) => (
                  <button 
                    key={key}
                    onClick={() => applyPreset(key)} 
                    className={`p-3 text-left rounded-lg border transition-all ${
                      activePreset === key 
                        ? 'border-brand-primary bg-brand-primary/10 text-brand-secondary' 
                        : 'border-gray-200 hover:border-brand-primary/50 bg-white text-gray-700'
                    }`}
                  >
                    <div className="font-medium text-sm">{preset.name}</div>
                  </button>
                ))}
              </div>

               {/* Weight Sliders */}
               <button
                  onClick={() => setShowCompactSliders((v) => !v)}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium mb-3"
                >
                  {showCompactSliders ? 'Hide Advanced Weights' : 'Show Advanced Weights'}
                </button>

                {showCompactSliders && (
                    <div className="space-y-4 bg-gray-50 p-3 rounded-lg">
                        {allDrills.map((drill) => (
                        <div key={drill.key}>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="font-medium text-gray-700">{drill.label}</span>
                                <span className="text-brand-primary font-mono">{Math.round(weights[drill.key] || 0)}%</span>
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                step={5}
                                value={weights[drill.key] || 0}
                                onChange={(e) => handleWeightChange(drill.key, parseInt(e.target.value))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-primary"
                            />
                        </div>
                        ))}
                    </div>
                )}
            </div>
          )}
        </div>

        {/* Live Rankings List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
             <h2 className="font-semibold text-gray-900 flex items-center gap-2">
               <TrendingUp className="w-5 h-5 text-brand-primary" />
               Current Standings
             </h2>
             <select
                value={displayCount === -1 ? 'all' : String(displayCount)}
                onChange={(e) => setDisplayCount(e.target.value === 'all' ? -1 : parseInt(e.target.value, 10))}
                className="text-xs bg-white border border-gray-300 text-gray-700 px-2 py-1 rounded-lg"
              >
                <option value="10">Top 10</option>
                <option value="25">Top 25</option>
                <option value="50">Top 50</option>
                <option value="all">Show All</option>
              </select>
          </div>

          <div className="p-2">
            {loading ? (
                <div className="space-y-2 p-2">
                {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
                </div>
            ) : liveRankings.length === 0 ? (
                <div className="text-center py-12">
                <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Users className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-gray-900 font-medium mb-1">No Rankings Yet</h3>
                <p className="text-sm text-gray-500">
                    Start recording drill results to see live standings
                </p>
                </div>
            ) : (
                <div className="space-y-2">
                {liveRankings.slice(0, displayLimit).map((player, index) => (
                    <div 
                    key={player.id} 
                    onClick={() => openDetails(player, { suppressGlobalModal: false })}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:shadow-md transition-shadow ${
                        index === 0 ? 'bg-yellow-50 border-yellow-200' :
                        index === 1 ? 'bg-gray-50 border-gray-200' :
                        index === 2 ? 'bg-orange-50 border-orange-200' :
                        'bg-white border-gray-100 hover:bg-gray-50'
                    }`}
                    >
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold shadow-sm ${
                        index === 0 ? 'bg-yellow-400 text-white' :
                        index === 1 ? 'bg-gray-400 text-white' :
                        index === 2 ? 'bg-orange-400 text-white' :
                        'bg-gray-100 text-gray-500'
                        }`}>
                        {index + 1}
                        </div>
                        <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate">{player.name}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                             <span>#{player.number}</span>
                             {player.age_group && <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px]">{player.age_group}</span>}
                        </div>
                        </div>
                    </div>
                    
                    <div className="text-right flex-shrink-0 pl-2">
                        <div className="font-bold text-brand-primary text-lg">
                            {(player.compositeScore || 0).toFixed(1)}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Score</div>
                    </div>
                    </div>
                ))}
                
                {liveRankings.length > displayLimit && (
                    <button 
                        onClick={() => setDisplayCount(prev => prev + 10)}
                        className="w-full py-3 text-sm text-brand-primary font-medium hover:bg-brand-primary/5 rounded-lg transition"
                    >
                        Show More
                    </button>
                )}
                </div>
            )}
          </div>
        </div>

        {/* Access to Advanced Features */}
        {(userRole === 'organizer' || userRole === 'coach') && liveRankings.length >= 3 && (
          <div className="mt-6 bg-brand-primary/5 border border-brand-primary/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="text-brand-secondary bg-white p-2 rounded-lg border border-brand-primary/10 shadow-sm">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-brand-secondary mb-1">Advanced Tools</h3>
                <p className="text-gray-600 text-sm mb-3">
                  You have enough data to use advanced features
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to="/team-formation"
                    className="text-xs bg-white text-center text-brand-secondary px-3 py-2 rounded-lg border border-brand-secondary/20 hover:bg-brand-secondary/5 transition font-medium"
                  >
                    Create Teams
                  </Link>
                  <Link
                    to="/analytics"
                    className="text-xs bg-white text-center text-brand-secondary px-3 py-2 rounded-lg border border-brand-secondary/20 hover:bg-brand-secondary/5 transition font-medium"
                  >
                    Full Analytics
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}