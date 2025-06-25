import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import DrillInputForm from "../components/DrillInputForm";
import SimpleSlider from "../components/SimpleSlider";
import { useEvent } from "../context/EventContext";
import { useAuth } from "../context/AuthContext";
import EventSelector from "../components/EventSelector";
import api from '../lib/api';
import { X, TrendingUp, Award, Edit, Settings, Users, BarChart3, Download, Filter } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { parseISO, isValid, format } from 'date-fns';

const DRILLS = [
  { key: "40m_dash", label: "40M Dash", unit: "sec" },
  { key: "vertical_jump", label: "Vertical Jump", unit: "in" },
  { key: "catching", label: "Catching", unit: "pts" },
  { key: "throwing", label: "Throwing", unit: "pts" },
  { key: "agility", label: "Agility", unit: "pts" },
];

const DRILL_WEIGHTS = {
  "40m_dash": 0.3,
  "vertical_jump": 0.2,
  "catching": 0.15,
  "throwing": 0.15,
  "agility": 0.2,
};

const WEIGHT_PRESETS = {
  balanced: {
    name: "Balanced",
    description: "Equal emphasis on all skills",
    weights: { "40m_dash": 20, "vertical_jump": 20, "catching": 20, "throwing": 20, "agility": 20 }
  },
  speed: {
    name: "Speed Focused",
    description: "Emphasizes speed and athleticism",
    weights: { "40m_dash": 50, "vertical_jump": 15, "catching": 10, "throwing": 10, "agility": 15 }
  },
  skills: {
    name: "Skills Focused", 
    description: "Emphasizes catching and throwing",
    weights: { "40m_dash": 10, "vertical_jump": 10, "catching": 35, "throwing": 35, "agility": 10 }
  },
  athletic: {
    name: "Athletic",
    description: "Emphasizes overall athleticism",
    weights: { "40m_dash": 30, "vertical_jump": 25, "catching": 10, "throwing": 10, "agility": 25 }
  }
};

const TABS = [
  { 
    id: 'players', 
    label: 'Player Management', 
    icon: Users,
    description: 'View, edit, and manage individual players'
  },
  { 
    id: 'rankings', 
    label: 'Rankings & Analysis', 
    icon: BarChart3,
    description: 'Age group rankings with weight adjustments'
  },
  { 
    id: 'exports', 
    label: 'Export & Reports', 
    icon: Download,
    description: 'Export data and view analytics'
  }
];



function EditPlayerModal({ player, allPlayers, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: player?.name || '',
    number: player?.number || '',
    age_group: player?.age_group || ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const existingAgeGroups = [...new Set(
    allPlayers
      .map(p => p.age_group)
      .filter(ag => ag && ag.trim() !== '')
  )].sort();

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Player name is required');
      return;
    }

    setSaving(true);
    setError('');
    
    try {
      const updateData = {
        name: formData.name.trim(),
        number: formData.number ? parseInt(formData.number) : null,
        age_group: formData.age_group.trim() || null
      };

      const apiUrl = `/players/${player.id}?event_id=${player.event_id}`;
      await api.put(apiUrl, updateData);
      onSave();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update player');
    } finally {
      setSaving(false);
    }
  };

  if (!player) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="bg-cmf-primary text-white p-6 rounded-t-xl flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Edit className="w-5 h-5" />
            <h2 className="text-xl font-bold">Edit Player</h2>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Player Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cmf-primary focus:border-cmf-primary"
              placeholder="Enter player name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Player Number
            </label>
            <input
              type="number"
              value={formData.number}
              onChange={(e) => handleInputChange('number', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cmf-primary focus:border-cmf-primary"
              placeholder="Enter player number"
              min="1"
              max="999"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Age Group
            </label>
            <input
              type="text"
              list="age-group-suggestions"
              value={formData.age_group}
              onChange={(e) => handleInputChange('age_group', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cmf-primary focus:border-cmf-primary"
              placeholder="e.g., 6U, U8, 7-8, 9-10 years old"
            />
            <datalist id="age-group-suggestions">
              {existingAgeGroups.map(ageGroup => (
                <option key={ageGroup} value={ageGroup} />
              ))}
              <option value="6U" />
              <option value="U6" />
              <option value="8U" />
              <option value="U8" />
              <option value="10U" />
              <option value="U10" />
              <option value="12U" />
              <option value="U12" />
              <option value="5-6" />
              <option value="7-8" />
              <option value="9-10" />
              <option value="11-12" />
              <option value="13-14" />
              <option value="15-16" />
              <option value="17-18" />
            </datalist>
            <p className="text-xs text-gray-500 mt-1">
              Type any format your league uses (6U, U8, 7-8 years old, etc.)
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 rounded-lg transition"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-cmf-primary hover:bg-cmf-secondary text-white font-medium py-2 rounded-lg transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayerDetailsModal({ player, allPlayers, onClose, persistedWeights, handleWeightChange, activePreset, applyPreset }) {
  // Use persisted weights for calculations
  const weights = persistedWeights;

  const drillRankings = useMemo(() => {
    if (!player || !allPlayers || allPlayers.length === 0) return {};
    
    const rankings = {};
    DRILLS.forEach(drill => {
      try {
        const validPlayers = allPlayers.filter(p => 
          p && 
          p.id && 
          p.age_group === player.age_group && 
          p[drill.key] != null && 
          typeof p[drill.key] === 'number'
        );
        
        if (validPlayers.length === 0) {
          rankings[drill.key] = null;
          return;
        }
        
        const sortedPlayers = validPlayers.sort((a, b) => {
          if (drill.key === "40m_dash") {
            return a[drill.key] - b[drill.key];
          }
          return b[drill.key] - a[drill.key];
        });
        
        const rank = sortedPlayers.findIndex(p => p.id === player.id) + 1;
        rankings[drill.key] = rank > 0 ? rank : null;
      } catch {
        rankings[drill.key] = null;
      }
    });
    return rankings;
  }, [allPlayers, player]);

  const weightedBreakdown = useMemo(() => {
    if (!player || !allPlayers || allPlayers.length === 0) return [];
    
    return DRILLS.map(drill => {
      try {
        const rawScore = player[drill.key] != null && typeof player[drill.key] === 'number' 
          ? player[drill.key] 
          : null;
        const weight = weights[drill.key] || 0;
        let weightedScore = 0;
        
        if (rawScore != null) {
          if (drill.key === "40m_dash") {
            const invertedScore = Math.max(0, 30 - rawScore);
            weightedScore = invertedScore * weight;
          } else {
            weightedScore = rawScore * weight;
          }
        }
        
        return {
          ...drill,
          rawScore,
          weight,
          weightedScore,
          rank: drillRankings[drill.key]
        };
      } catch {
        return {
          ...drill,
          rawScore: null,
          weight: weights[drill.key] || 0,
          weightedScore: 0,
          rank: null
        };
      }
    });
  }, [drillRankings, player, weights]);

  // Return null after all hooks if conditions aren't met
  if (!player || !allPlayers || allPlayers.length === 0) return null;

  const totalWeightedScore = weightedBreakdown.reduce((sum, item) => sum + (item.weightedScore || 0), 0);

  let currentRank = 1;
  let ageGroupPlayers = [];
  
  try {
    ageGroupPlayers = allPlayers.filter(p => 
      p && 
      p.id && 
      p.age_group === player.age_group
    );
    
    if (ageGroupPlayers.length > 0) {
      const playersWithScores = ageGroupPlayers.map(p => {
        try {
          const score = DRILLS.reduce((sum, drill) => {
            const drillScore = p[drill.key] != null && typeof p[drill.key] === 'number' ? p[drill.key] : 0;
            const weight = weights[drill.key] || 0;
            
            if (drillScore > 0) {
              if (drill.key === "40m_dash") {
                const invertedScore = Math.max(0, 30 - drillScore);
                return sum + (invertedScore * weight);
              } else {
                return sum + (drillScore * weight);
              }
            }
            return sum;
          }, 0);
          return { ...p, currentScore: score };
        } catch {
          return { ...p, currentScore: 0 };
        }
      }).sort((a, b) => (b.currentScore || 0) - (a.currentScore || 0));
      
      const rankIndex = playersWithScores.findIndex(p => p.id === player.id);
      currentRank = rankIndex >= 0 ? rankIndex + 1 : 1;
    }
  } catch {
    currentRank = 1;
    ageGroupPlayers = [player];
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[95vh] flex flex-col">
        <div className="bg-cmf-primary text-white px-6 py-3 rounded-t-xl flex justify-between items-center flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold">{player.name}</h2>
            <p className="text-cmf-light text-sm">Player #{player.number} • Age Group: {player.age_group}</p>
          </div>
          <div className="text-right mr-4">
            <div className="text-sm opacity-75">Overall Score</div>
            <div className="text-2xl font-bold text-cmf-primary">{totalWeightedScore.toFixed(2)} pts</div>
            <div className="text-xs opacity-75">Rank #{currentRank} of {ageGroupPlayers.length}</div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="h-full flex">
            <div className="flex-1 p-4">
              <div className="h-full flex flex-col">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-cmf-primary" />
                  Ranking Weight Controls
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Set drill priorities for ranking calculations. Higher values = more important to you.
                </p>
          
                <div className="grid grid-cols-1 gap-2 flex-1 overflow-y-auto">
                  {weightedBreakdown.map(drill => (
                    <div key={drill.key} className="bg-gray-50 rounded-lg p-2 border border-gray-200">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="min-w-0">
                            <h4 className="font-semibold text-gray-900 text-sm">{drill.label}</h4>
                            <div className="flex items-center gap-2">
                              <span className="text-base font-bold text-cmf-primary">
                                {drill.rawScore != null ? drill.rawScore + ' ' + drill.unit : 'No score'}
                              </span>
                              {drill.rank && (
                                <span className="bg-cmf-primary text-white px-1.5 py-0.5 rounded-full text-xs font-medium">
                                  #{drill.rank}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-600">Contribution</div>
                          <div className="text-base font-bold text-cmf-secondary">{drill.weightedScore.toFixed(2)} pts</div>
                        </div>
                      </div>
                
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium w-16 text-gray-600">
                          Less important
                        </span>
                        <div className="touch-none flex-1">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            key={`modal-${drill.key}-${weights[drill.key] || 0}`}
                            defaultValue={weights[drill.key] || 0}
                            onInput={(e) => {
                              console.log("💡 Weight changed:", e.target.value);
                              handleWeightChange(e.target.name, Number(e.target.value));
                            }}
                            name={drill.key}
                            className="w-full h-6 rounded-lg cursor-pointer accent-cmf-primary"
                          />
                        </div>
                        <span className="text-xs font-medium w-16 text-gray-600 text-right">
                          More important
                        </span>
                        <div className="text-sm font-bold text-cmf-primary min-w-[40px] text-center">
                          {weights[drill.key] || 0}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
          
                <div className="mt-2 p-2 bg-blue-50 rounded-lg border-2 border-blue-200 flex-shrink-0">
                  <span className="font-semibold text-gray-900 text-sm">Total Composite Score: </span>
                  <span className="text-lg font-bold text-cmf-primary">
                    {totalWeightedScore.toFixed(2)} pts (Rank #{currentRank})
                  </span>
                </div>
              </div>
            </div>

            <div className="w-80 bg-gray-50 p-4 border-l border-gray-200 overflow-y-auto">
              <div className="h-full flex flex-col">
                <div className="mb-4">
                  <h3 className="text-base font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-cmf-primary" />
                    Weight Scenarios
                  </h3>
                  
                  <div className="grid grid-cols-1 gap-1">
                    {Object.entries(WEIGHT_PRESETS).map(([key, preset]) => (
                      <button
                        key={key}
                        onClick={() => applyPreset(key)}
                        className={`p-2 text-left rounded-lg border-2 transition-all ${
                          activePreset === key 
                            ? 'border-cmf-primary bg-cmf-primary bg-opacity-5 text-cmf-primary' 
                            : 'border-gray-200 hover:border-gray-300 text-gray-700'
                        }`}
                      >
                        <div className="font-medium text-sm">{preset.name}</div>
                        <div className="text-xs text-gray-500">{preset.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="bg-white rounded-lg p-3 border border-gray-200 flex-1 min-h-0">
                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <Award className="w-4 h-4 text-yellow-500" />
                    Ranking Analysis
                  </h4>
                  
                  <div className="space-y-2 text-sm overflow-y-auto max-h-96">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Age Group Rank:</span>
                      <span className="font-bold text-cmf-primary">#{currentRank} of {ageGroupPlayers.length}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-600">Overall Score:</span>
                      <span className="font-bold text-cmf-secondary">{totalWeightedScore.toFixed(2)} pts</span>
                    </div>
                    
                    <div className="pt-2 border-t border-gray-200">
                      <div className="text-xs text-gray-500 mb-2">Score Breakdown:</div>
                      {weightedBreakdown.map(drill => (
                        <div key={drill.key} className="flex justify-between text-xs">
                          <span className="text-gray-600">{drill.label}:</span>
                          <span className="font-mono">{drill.weightedScore.toFixed(2)} pts</span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="pt-2 border-t border-gray-200">
                      <div className="text-xs text-gray-500">
                        {activePreset ? 'Using ' + WEIGHT_PRESETS[activePreset].name : 'weights'}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-2 text-xs text-gray-500 text-center flex-shrink-0">
                  💡 Adjust sliders for real-time changes
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  const [rankings, setRankings] = useState([]);
  const rankingsLoading = false;
  const rankingsError = null;

  // ✅ WORKING SOLUTION: defaultValue + onInput + setTimeout to persist
  const [persistedWeights, setPersistedWeights] = useState({
    "40m_dash": 20,
    "vertical_jump": 20, 
    "catching": 20,
    "throwing": 20,
    "agility": 20
  });
  const currentWeights = useRef({ ...persistedWeights }); // Track during drag
  const timer = useRef(null); // Timer for debouncing
  const [activePreset, setActivePreset] = useState('balanced');
  
  // Live ranking state
  const [liveRankings, setLiveRankings] = useState({});
  const [rankingUpdateBanner, setRankingUpdateBanner] = useState(false);

  // Sync ref when persisted weights change (from presets, etc.)
  useEffect(() => {
    currentWeights.current = { ...persistedWeights };
  }, [persistedWeights]);

  const [showCustomControls, setShowCustomControls] = useState(false);

  // ✅ TEMPORAL DEAD ZONE FIX: Calculate grouped data BEFORE useCallback that uses it
  const grouped = (players || []).reduce((acc, player) => {
    const group = player.age_group || "No Age Group";
    if (!acc[group]) acc[group] = [];
    acc[group].push(player);
    return acc;
  }, {});

  // 🏆 Live ranking calculation function
  const calculateLiveRankings = useCallback((weightsToUse = null) => {
    const weights = weightsToUse || currentWeights.current;
    const newRankings = {};
    
    // Process each age group
    Object.entries(grouped).forEach(([ageGroup, ageGroupPlayers]) => {
      // Filter players with at least one drill score
      const playersWithScores = ageGroupPlayers.filter(player => 
        DRILLS.some(drill => player[drill.key] != null && typeof player[drill.key] === 'number')
      );
      
      if (playersWithScores.length === 0) {
        newRankings[ageGroup] = [];
        return;
      }
      
      // Calculate weighted scores for each player
      const rankedPlayers = playersWithScores.map(player => {
        let totalWeightedScore = 0;
        
        DRILLS.forEach(drill => {
          const rawScore = player[drill.key];
          const weight = weights[drill.key] || 0;
          
          if (rawScore != null && typeof rawScore === 'number') {
            if (drill.key === "40m_dash") {
              // Invert 40m dash (lower time = better)
              const invertedScore = Math.max(0, 30 - rawScore);
              totalWeightedScore += invertedScore * weight;
            } else {
              totalWeightedScore += rawScore * weight;
            }
          }
        });
        
        return {
          ...player,
          weightedScore: totalWeightedScore
        };
      });
      
      // Sort by weighted score (highest first)
      rankedPlayers.sort((a, b) => b.weightedScore - a.weightedScore);
      
      // Add rank numbers
      newRankings[ageGroup] = rankedPlayers.map((player, index) => ({
        ...player,
        rank: index + 1
      }));
    });
    
    console.log('🏆 Live Rankings Updated:', newRankings);
    setLiveRankings(newRankings);
    
    // Show update banner briefly
    setRankingUpdateBanner(true);
    setTimeout(() => setRankingUpdateBanner(false), 2000);
    
    return newRankings;
  }, [grouped]);

  function handleWeightChange(name, value) {
    // Update ref immediately (no re-render, no lag during drag)
    currentWeights.current[name] = value;

    // Cancel previous timer
    if (timer.current) clearTimeout(timer.current);

    // Debounce persistence to avoid snapback
    timer.current = setTimeout(() => {
      console.log('🏁 Persisting weights:', currentWeights.current);
      
      // Persist to state (this causes re-render but after drag ends)
      setPersistedWeights({ ...currentWeights.current });
      
      // Clear active preset after calculation
      setActivePreset('');
      
      // 🏆 Trigger live ranking recalculation
      calculateLiveRankings(currentWeights.current);
      
      // Force backend rankings recalculation
      setRankings([]);
    }, 300);
  }

  const applyPreset = (presetKey) => {
    if (WEIGHT_PRESETS[presetKey]) {
      const newWeights = { ...WEIGHT_PRESETS[presetKey].weights };
      
      // Update both ref and persisted state immediately for presets
      currentWeights.current = newWeights;
      setPersistedWeights(newWeights);
      setActivePreset(presetKey);
      
      // Trigger immediate recalculation for presets
      if (timer.current) clearTimeout(timer.current);
      
      // 🏆 Trigger immediate live ranking recalculation
      calculateLiveRankings(newWeights);
      
      setRankings([]); // Force backend rankings recalculation
    }
  };



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
  }, [selectedEvent, user, selectedLeagueId, selectedPlayer]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  // Calculate initial live rankings when players or weights change
  useEffect(() => {
    if (players.length > 0) {
      calculateLiveRankings();
    }
  }, [players, calculateLiveRankings]);

  // Toggle dropdown visibility
  const toggleForm = (id) => {
    setExpandedPlayerIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // MobileWeightControls component for weight adjustments
  const MobileWeightControls = ({ showSliders = false }) => {
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
                    {persistedWeights[drill.key]}
                  </span>
                </div>
                
                <div className="touch-none">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    key={`${drill.key}-${persistedWeights[drill.key]}`}
                    defaultValue={persistedWeights[drill.key]}
                    onInput={(e) => {
                      handleWeightChange(e.target.name, Number(e.target.value));
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
  };

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
          
          <div className="flex gap-2 flex-wrap">
            <Link
              to="/live-entry"
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2"
            >
              🚀 Live Entry
            </Link>
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

        {/* 🏆 Ranking Update Banner */}
        {rankingUpdateBanner && (
          <div className="bg-gradient-to-r from-green-500 to-blue-500 text-white px-4 py-3 rounded-lg mb-6 shadow-lg animate-pulse">
            <div className="flex items-center gap-2">
              <span className="text-lg">🏆</span>
              <span className="font-medium">Rankings updated with new weight priorities!</span>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 overflow-hidden">
          <div className="flex border-b border-gray-200">
            {TABS.map((tab) => {
              const Icon = tab.icon;
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

        {activeTab === 'players' && (
          <>
            {(userRole === 'organizer' || userRole === 'coach') && (
              <div className="mb-6">
                <MobileWeightControls />
                {Object.keys(grouped).length === 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-2">
                    <p className="text-yellow-700 text-sm">
                      💡 Weight controls are ready! They'll affect player rankings once you add players to your event.
                    </p>
                  </div>
                )}
              </div>
            )}

            {selectedPlayer && (
              <PlayerDetailsModal 
                player={selectedPlayer} 
                allPlayers={players} 
                onClose={() => setSelectedPlayer(null)}
                persistedWeights={persistedWeights}
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
                onSave={fetchPlayers}
              />
            )}

            {Object.keys(grouped).length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
                <p className="text-gray-500">No players found for this event.</p>
              </div>
            ) : (
              Object.entries(grouped)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([ageGroup, ageGroupPlayers]) => {
                  // Use live rankings if available, otherwise fall back to original order
                  const rankedPlayers = liveRankings[ageGroup] || ageGroupPlayers;
                  const hasRankings = liveRankings[ageGroup] && liveRankings[ageGroup].length > 0;
                  
                  return (
                    <div key={ageGroup} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                          👥 Age Group: {ageGroup}
                        </h2>
                        {hasRankings && (
                          <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                            ⚡ Live Rankings
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        {/* eslint-disable-next-line no-unused-vars */}
                        {rankedPlayers.map((player, _index) => (
                          <React.Fragment key={player.id}>
                            <div className={`bg-gray-50 rounded-lg p-3 border border-gray-200 transition-all duration-300 ${
                              hasRankings ? 'shadow-sm' : ''
                            }`}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                  {hasRankings && player.rank && (
                                    <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                                      player.rank === 1 ? 'bg-yellow-100 text-yellow-700' :
                                      player.rank === 2 ? 'bg-gray-100 text-gray-700' :
                                      player.rank === 3 ? 'bg-orange-100 text-orange-700' :
                                      'bg-blue-100 text-blue-700'
                                    }`}>
                                      {player.rank === 1 ? '🥇' : 
                                       player.rank === 2 ? '🥈' : 
                                       player.rank === 3 ? '🥉' : 
                                       `#${player.rank}`}
                                    </div>
                                  )}
                                  <div>
                                    <h3 className="font-semibold text-gray-900">{player.name}</h3>
                                    <p className="text-sm text-gray-600">
                                      Player #{player.number || 'N/A'}
                                      {hasRankings && player.weightedScore && (
                                        <span className="ml-2 text-blue-600 font-mono">
                                          Score: {player.weightedScore.toFixed(1)}
                                        </span>
                                      )}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={() => setSelectedPlayer(player)}
                                  className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded-md text-sm font-medium transition"
                                  disabled={userRole !== 'organizer' && !player.composite_score && !Object.values(player).some(val => typeof val === 'number' && val > 0)}
                                >
                                  {(userRole === 'organizer' || userRole === 'coach') ? 'View Stats & Weights' : 'View Stats'}
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
                            </div>
                            
                            {expandedPlayerIds[player.id] && (
                              <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200 ml-4">
                                <DrillInputForm playerId={player.id} onSuccess={() => { toggleForm(player.id); fetchPlayers(); }} />
                              </div>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  );
                })
            )}
          </>
        )}

        {activeTab === 'rankings' && (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Filter className="w-5 h-5 text-cmf-primary" />
                Select Age Group
              </h2>
              <select
                value={selectedAgeGroup}
                onChange={e => setSelectedAgeGroup(e.target.value)}
                className="w-full rounded-lg border border-gray-300 p-3 focus:ring-2 focus:ring-cmf-primary focus:border-cmf-primary"
              >
                <option value="">Choose an age group to view rankings</option>
                {Object.keys(grouped).map(group => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </div>
            
            {(userRole === 'organizer' || userRole === 'coach') && (
              <div className="mb-6">
                <MobileWeightControls showSliders={true} />
                {!selectedAgeGroup && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
                    <p className="text-blue-700 text-sm">
                      💡 Select an age group above to view rankings with your current weight settings.
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {rankingsLoading ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
                <div className="animate-spin inline-block w-6 h-6 border-2 border-gray-300 border-t-cmf-primary rounded-full mb-2"></div>
                <div className="text-gray-500">Updating rankings...</div>
              </div>
            ) : rankingsError ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
                <strong>Error:</strong> {rankingsError}
              </div>
            ) : selectedAgeGroup === "" ? (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center text-gray-500">
                👆 Please select an age group above to view rankings and adjust weights.
              </div>
            ) : rankings.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center text-yellow-700">
                No players found for the <strong>{selectedAgeGroup}</strong> age group. Players may not have drill scores yet.
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Rankings ({selectedAgeGroup})</h2>
                  <button
                    onClick={() => {
                      if (!selectedAgeGroup || rankings.length === 0) return;
                      let csv = 'Rank,Name,Player Number,Composite Score\n';
                      rankings.forEach(player => {
                        csv += `${player.rank},"${player.name}",${player.number},${player.composite_score.toFixed(2)}\n`;
                      });
                      const eventDate = selectedEvent ? new Date(selectedEvent.date).toISOString().slice(0,10) : 'event';
                      const filename = `rankings_${selectedAgeGroup}_${eventDate}.csv`;
                      const blob = new Blob([csv], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = filename;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm"
                    disabled={rankings.length === 0}
                  >
                    Export as CSV
                  </button>
                </div>
                
                <div className="space-y-3">
                  {rankings.map((player) => {
                    const drillRankings = {};
                    DRILLS.forEach(drill => {
                      const drillRanks = rankings
                        .filter(p => p[drill.key] != null)
                        .map(p => ({ player_id: p.player_id, score: p[drill.key] }))
                        .sort((a, b) => {
                          return drill.key === "40m_dash" ? a.score - b.score : b.score - a.score;
                        });
                      const rank = drillRanks.findIndex(p => p.player_id === player.player_id) + 1;
                      drillRankings[drill.key] = rank > 0 ? rank : null;
                    });

                    return (
                      <div key={player.player_id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-3">
                            <span className={`font-bold text-lg ${player.rank === 1 ? "text-yellow-500" : player.rank === 2 ? "text-gray-500" : player.rank === 3 ? "text-orange-500" : "text-gray-400"}`}>
                              {player.rank === 1 ? "🥇" : player.rank === 2 ? "🥈" : player.rank === 3 ? "🥉" : `#${player.rank}`}
                            </span>
                            <div>
                              <h3 className="font-semibold text-gray-900">{player.name}</h3>
                              <p className="text-sm text-gray-600">Player #{player.number}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-gray-500">Overall Score</div>
                            <div className="font-mono font-bold text-lg text-cmf-primary">{player.composite_score.toFixed(2)}</div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                          {DRILLS.map(drill => (
                            <div key={drill.key} className="bg-white rounded p-2 text-center">
                              <div className="font-medium text-gray-700 mb-1">{drill.label}</div>
                              {player[drill.key] != null ? (
                                <div>
                                  <div className="font-mono text-sm">{player[drill.key]}</div>
                                  <div className="text-xs text-gray-500">#{drillRankings[drill.key] || '-'}</div>
                                </div>
                              ) : (
                                <span className="text-gray-400">No score</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
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
                      let csv = 'Rank,Name,Player Number,Composite Score,40M Dash,Vertical Jump,Catching,Throwing,Agility\n';
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
    </div>
  );
}