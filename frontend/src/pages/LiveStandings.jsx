import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Skeleton from '../components/Skeleton';
import { Link, useNavigate } from 'react-router-dom';
import { useEvent } from '../context/EventContext';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Users, Target, Settings, Plus, BarChart3, TrendingUp } from 'lucide-react';
import { DRILLS, WEIGHT_PRESETS } from '../constants/players';
import api from '../lib/api';
// PERFORMANCE OPTIMIZATION: Add caching and optimized scoring for LiveStandings
import { withCache } from '../utils/dataCache';
import { calculateOptimizedRankings, calculateOptimizedRankingsAcrossAll } from '../utils/optimizedScoring';

export default function LiveStandings() {
  const { selectedEvent } = useEvent();
  const { userRole } = useAuth();
  const navigate = useNavigate();
  
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weights, setWeights] = useState(() => {
    // Default balanced weights
    const defaultWeights = {};
    DRILLS.forEach(drill => {
      defaultWeights[drill.key] = 20; // Equal 20% weighting
    });
    return defaultWeights;
  });
  const [activePreset, setActivePreset] = useState('balanced');
  const [selectedAgeGroup, setSelectedAgeGroup] = useState('ALL');
  const [normalizeAcrossAll, setNormalizeAcrossAll] = useState(true);

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
      console.error('Failed to fetch players:', error);
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
      ? calculateOptimizedRankingsAcrossAll(filteredPlayers, weights)
      : calculateOptimizedRankings(filteredPlayers, weights);
    return source.filter(player => player.compositeScore > 0);
  }, [filteredPlayers, weights, normalizeAcrossAll, selectedAgeGroup]);

  // Handle weight changes
  const handleWeightChange = (drillKey, value) => {
    setWeights(prev => ({ ...prev, [drillKey]: value }));
    setActivePreset(''); // Clear preset when manually adjusting
  };

  // Apply preset weights
  const applyPreset = (presetKey) => {
    if (WEIGHT_PRESETS[presetKey]) {
      const newWeights = {};
      Object.entries(WEIGHT_PRESETS[presetKey].weights).forEach(([key, value]) => {
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
            <div className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
              ✨ Live Updates
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        
        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link
              to="/live-entry"
              className="flex items-center gap-2 p-3 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition"
            >
              <Target className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-900">Continue Recording</span>
            </Link>
            <Link
              to="/players"
              className="flex items-center gap-2 p-3 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition"
            >
              <Users className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Full Player View</span>
            </Link>
          </div>
        </div>

        {/* Filters & Weight Controls (match Players page gradient style) */}
        <div className="bg-gradient-to-r from-brand-primary to-brand-secondary text-white rounded-xl shadow-sm p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span className="font-semibold text-sm">Explore Rankings</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-white/20 px-2 py-1 rounded-full text-xs">
                {WEIGHT_PRESETS[activePreset]?.name || 'Custom'}
              </span>
              <label className="flex items-center gap-1 text-xs bg-white/10 px-2 py-1 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={normalizeAcrossAll}
                  onChange={(e) => setNormalizeAcrossAll(e.target.checked)}
                />
                Normalize across all
              </label>
              <select
                value={selectedAgeGroup}
                onChange={(e) => setSelectedAgeGroup(e.target.value)}
                className="text-xs bg-white/20 text-white rounded px-2 py-1"
              >
                {ageGroups.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
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
                    min={0}
                    max={100}
                    step={5}
                    value={weights[drill.key] || 0}
                    onChange={(e) => handleWeightChange(drill.key, parseInt(e.target.value))}
                    className="w-full h-1 rounded cursor-pointer accent-white"
                  />
                  <div className="font-mono font-bold text-xs mt-1">
                    {(weights[drill.key] || 0).toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-xs text-white/80 mt-2 text-center">
            Adjust weights to see how rankings change with different priorities
          </div>
        </div>

        {/* Live Rankings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Current Rankings</h2>
            <div className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
              {liveRankings.length} players
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
              {liveRankings.slice(0, 10).map((player, index) => (
                <div 
                  key={player.id} 
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    index === 0 ? 'bg-yellow-50 border-yellow-200' :
                    index < 3 ? 'bg-green-50 border-green-200' :
                    'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      index === 0 ? 'bg-yellow-500 text-white' :
                      index < 3 ? 'bg-green-500 text-white' :
                      'bg-gray-500 text-white'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{player.name}</div>
                      <div className="text-sm text-gray-600">#{player.number}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-blue-600">{player.compositeScore.toFixed(1)}</div>
                    <div className="text-xs text-gray-500">score</div>
                  </div>
                </div>
              ))}
              
              {liveRankings.length > 10 && (
                <div className="text-center pt-2">
                  <Link 
                    to="/players"
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
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
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="text-purple-600">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-purple-900 mb-1">Advanced Tools Available</h3>
                <p className="text-purple-700 text-sm mb-3">
                  You have enough data to use advanced features
                </p>
                <div className="flex gap-2">
                  <Link
                    to="/team-formation"
                    className="text-xs bg-white text-purple-800 px-3 py-1.5 rounded-lg border border-purple-200 hover:bg-purple-50 transition font-medium"
                  >
                    Create Teams
                  </Link>
                  <Link
                    to="/players"
                    className="text-xs bg-white text-purple-800 px-3 py-1.5 rounded-lg border border-purple-200 hover:bg-purple-50 transition font-medium"
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