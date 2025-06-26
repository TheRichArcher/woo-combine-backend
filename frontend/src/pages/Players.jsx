import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import DrillInputForm from "../components/DrillInputForm";

import { useEvent } from "../context/EventContext";
import { useAuth } from "../context/AuthContext";
import EventSelector from "../components/EventSelector";
import api from '../lib/api';
import { X, TrendingUp, Award, Edit, Settings, Users, BarChart3, Download, Filter } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { parseISO, isValid, format } from 'date-fns';

const DRILLS = [
  { key: "40m_dash", label: "40-Yard Dash", unit: "sec" },
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
    label: 'Player Management & Rankings', 
    icon: Users,
    description: 'Manage players and analyze prospects with real-time weight adjustments'
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

function PlayerDetailsModal({ player, allPlayers, onClose, persistedWeights, sliderWeights, persistSliderWeights, activePreset, applyPreset }) {
  const modalSliderRefs = useRef({});
  const [modalLocalWeights, setModalLocalWeights] = useState(sliderWeights);
  
  // Sync local weights when sliderWeights change
  useEffect(() => {
    setModalLocalWeights(sliderWeights);
  }, [sliderWeights]);
  
  // Persist weights function for modal
  const persistModalWeights = useCallback(() => {
    persistSliderWeights(modalLocalWeights);
  }, [modalLocalWeights, persistSliderWeights]);
  
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
    
    // Calculate drill ranges for normalization (same age group only)
    const ageGroupPlayers = allPlayers.filter(p => 
      p && p.age_group === player.age_group && 
      DRILLS.some(drill => p[drill.key] != null && typeof p[drill.key] === 'number')
    );
    
    const drillRanges = {};
    DRILLS.forEach(drill => {
      const values = ageGroupPlayers
        .map(p => p[drill.key])
        .filter(val => val != null && typeof val === 'number');
      
      if (values.length > 0) {
        drillRanges[drill.key] = {
          min: Math.min(...values),
          max: Math.max(...values)
        };
      }
    });
    
    return DRILLS.map(drill => {
      try {
        const rawScore = player[drill.key] != null && typeof player[drill.key] === 'number' 
          ? player[drill.key] 
          : null;
        const weight = weights[drill.key] || 0;
        let weightedScore = 0;
        
        if (rawScore != null && drillRanges[drill.key]) {
          const range = drillRanges[drill.key];
          let normalizedScore = 0;
          
          if (range.max === range.min) {
            // All players have same score, give them all 50 (middle score)
            normalizedScore = 50;
          } else if (drill.key === "40m_dash") {
            // For 40-yard dash: lower time = better score (invert the scale)
            normalizedScore = ((range.max - rawScore) / (range.max - range.min)) * 100;
          } else {
            // For other drills: higher value = better score
            normalizedScore = ((rawScore - range.min) / (range.max - range.min)) * 100;
          }
          
          // Apply weight as percentage to normalized score
          weightedScore = normalizedScore * (weight / 100);
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
  }, [drillRankings, player, weights, allPlayers]);

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
      // Calculate drill ranges for normalized scoring
      const playersWithAnyScore = ageGroupPlayers.filter(p => 
        DRILLS.some(drill => p[drill.key] != null && typeof p[drill.key] === 'number')
      );
      
      const drillRanges = {};
      DRILLS.forEach(drill => {
        const values = playersWithAnyScore
          .map(p => p[drill.key])
          .filter(val => val != null && typeof val === 'number');
        
        if (values.length > 0) {
          drillRanges[drill.key] = {
            min: Math.min(...values),
            max: Math.max(...values)
          };
        }
      });
      
      const playersWithScores = ageGroupPlayers.map(p => {
        try {
          const score = DRILLS.reduce((sum, drill) => {
            const drillScore = p[drill.key] != null && typeof p[drill.key] === 'number' ? p[drill.key] : null;
            const weight = weights[drill.key] || 0;
            const range = drillRanges[drill.key];
            
            if (drillScore != null && range) {
              let normalizedScore = 0;
              
              if (range.max === range.min) {
                normalizedScore = 50;
              } else if (drill.key === "40m_dash") {
                normalizedScore = ((range.max - drillScore) / (range.max - range.min)) * 100;
              } else {
                normalizedScore = ((drillScore - range.min) / (range.max - range.min)) * 100;
              }
              
              return sum + (normalizedScore * (weight / 100));
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" style={{zIndex: 9999}} onClick={onClose}>
        <div className="bg-white rounded-xl shadow-2xl max-w-4xl lg:max-w-6xl w-full max-h-[95vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="bg-cmf-primary text-white px-6 py-3 rounded-t-xl flex justify-between items-center flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold">{player.name}</h2>
            <p className="text-cmf-light text-sm">Player #{player.number} • Age Group: {player.age_group}</p>
          </div>
          <div className="text-right mr-4">
            <div className="text-sm opacity-75">Overall Score</div>
            <div className="text-2xl font-bold text-white">{totalWeightedScore.toFixed(2)} pts</div>
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
          <div className="h-full flex flex-col lg:flex-row">
            {/* Main Content - Weight Controls */}
            <div className="flex-1 p-4 min-h-0">
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
                    <div key={drill.key} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="min-w-0 flex-1">
                            <h4 className="font-semibold text-gray-900 text-sm">{drill.label}</h4>
                            <div className="flex items-center gap-2 flex-wrap">
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
                        <div className="text-right ml-2">
                          <div className="text-xs text-gray-600">Contribution</div>
                          <div className="text-base font-bold text-cmf-secondary">{drill.weightedScore.toFixed(2)} pts</div>
                        </div>
                      </div>
                
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-600 hidden sm:block" style={{minWidth: '64px'}}>
                          Less important
                        </span>
                        <div className="touch-none flex-1">
                          <input
                            type="range"
                            ref={(el) => (modalSliderRefs.current[drill.key] = el)}
                            defaultValue={modalLocalWeights[drill.key] ?? 50}
                            min={0}
                            max={100}
                            step={1}
                            onInput={(e) => {
                              const newWeight = parseInt(e.target.value, 10);
                              setModalLocalWeights((prev) => ({ ...prev, [drill.key]: newWeight }));
                            }}
                            onPointerUp={persistModalWeights}
                            name={drill.key}
                            className="w-full h-8 rounded-lg cursor-pointer accent-cmf-primary"
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-600 text-right hidden sm:block" style={{minWidth: '64px'}}>
                          More important
                        </span>
                        <div className="text-sm font-bold text-cmf-primary min-w-[40px] text-center">
                          {modalLocalWeights[drill.key] || 0}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
          
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border-2 border-blue-200 flex-shrink-0">
                  <div className="text-center sm:text-left">
                    <span className="font-semibold text-gray-900 text-sm block sm:inline">Total Composite Score: </span>
                    <span className="text-lg font-bold text-cmf-primary block sm:inline">
                      {totalWeightedScore.toFixed(2)} pts (Rank #{currentRank})
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar - Weight Scenarios and Analysis */}
            <div className="w-full lg:w-80 bg-gray-50 p-4 border-t lg:border-t-0 lg:border-l border-gray-200 max-h-96 lg:max-h-full overflow-y-auto">
              <div className="h-full flex flex-col">
                <div className="mb-4">
                  <h3 className="text-base font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-cmf-primary" />
                    Weight Scenarios
                  </h3>
                  
                  <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
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
                  
                  <div className="space-y-2 text-sm overflow-y-auto">
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
                        {activePreset ? 'Using ' + WEIGHT_PRESETS[activePreset].name : 'Custom weights'}
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

  const [persistedWeights, setPersistedWeights] = useState({
    "40m_dash": 20,
    "vertical_jump": 20, 
    "catching": 20,
    "throwing": 20,
    "agility": 20
  });
  
  // Live slider values for smooth interaction
  const [sliderWeights, setSliderWeights] = useState(persistedWeights);
  
  const currentWeights = useRef({ ...persistedWeights }); // Track during drag
  const timer = useRef(null); // Timer for debouncing
  const [activePreset, setActivePreset] = useState('balanced');
  
  // Live ranking state
  const [liveRankings, setLiveRankings] = useState({});

  // Sync ref and sliderWeights when persisted weights change (from presets, etc.)
  useEffect(() => {
    currentWeights.current = { ...persistedWeights };
    setSliderWeights({ ...persistedWeights });
  }, [persistedWeights]);

  const [showCustomControls, setShowCustomControls] = useState(false);

  // Calculate grouped data for weight controls
  const grouped = useMemo(() => {
    return players.reduce((acc, player) => {
      const ageGroup = player.age_group || 'Unknown';
      if (!acc[ageGroup]) acc[ageGroup] = [];
      acc[ageGroup].push(player);
      return acc;
    }, {});
  }, [players]);

  // Helper function to calculate rankings for a group of players
  const calculateRankingsForGroup = useCallback((playersGroup, weights) => {
    // Filter players with at least one drill score
    const playersWithScores = playersGroup.filter(player => 
      DRILLS.some(drill => player[drill.key] != null && typeof player[drill.key] === 'number')
    );
    
    if (playersWithScores.length === 0) {
      return [];
    }
    
    // Calculate min/max for each drill for normalization
    const drillRanges = {};
    DRILLS.forEach(drill => {
      const values = playersWithScores
        .map(p => p[drill.key])
        .filter(val => val != null && typeof val === 'number');
      
      if (values.length > 0) {
        drillRanges[drill.key] = {
          min: Math.min(...values),
          max: Math.max(...values)
        };
      }
    });

    // Calculate normalized weighted scores for each player
    const rankedPlayers = playersWithScores.map(player => {
      let totalWeightedScore = 0;
      
      DRILLS.forEach(drill => {
        const rawScore = player[drill.key];
        const weight = weights[drill.key] || 0;
        const range = drillRanges[drill.key];
        
        if (rawScore != null && typeof rawScore === 'number' && range) {
          let normalizedScore = 0;
          
          if (range.max === range.min) {
            // All players have same score, give them all 50 (middle score)
            normalizedScore = 50;
          } else if (drill.key === "40m_dash") {
            // For 40-yard dash: lower time = better score (invert the scale)
            normalizedScore = ((range.max - rawScore) / (range.max - range.min)) * 100;
          } else {
            // For other drills: higher value = better score
            normalizedScore = ((rawScore - range.min) / (range.max - range.min)) * 100;
          }
          
          // Apply weight to normalized score
          totalWeightedScore += normalizedScore * (weight / 100);
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
    return rankedPlayers.map((player, index) => ({
      ...player,
      rank: index + 1
    }));
  }, []);

  // 🏆 Live ranking calculation function
  const calculateLiveRankings = useCallback((weightsToUse = null) => {
    const weights = weightsToUse || currentWeights.current;
    const newRankings = {};
    
    // Calculate "All Players" rankings first
    const allPlayersWithScores = players.filter(player => 
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
  }, [grouped]);

  // Persist slider weights function
  const persistSliderWeights = useCallback((weights) => {
    if (timer.current) clearTimeout(timer.current);
    
    timer.current = setTimeout(() => {
      // Persist to state
      setPersistedWeights({ ...weights });
      
      // Clear active preset after calculation
      setActivePreset('');
      
      // 🏆 Trigger live ranking recalculation
      calculateLiveRankings(weights);
    }, 100);
  }, [calculateLiveRankings]);

  function handleWeightChange(name, value) {
    // Update ref immediately (no re-render, no lag during drag)
    currentWeights.current[name] = value;

    // Cancel previous timer
    if (timer.current) clearTimeout(timer.current);

    // Debounce persistence to avoid snapback
    timer.current = setTimeout(() => {
      // Persist to state (this causes re-render but after drag ends)
      setPersistedWeights({ ...currentWeights.current });
      
      // Clear active preset after calculation
      setActivePreset('');
      
      // 🏆 Trigger live ranking recalculation
      calculateLiveRankings(currentWeights.current);
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
  }, [selectedEvent, user, selectedLeagueId]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  // Calculate initial live rankings when players or weights change
  useEffect(() => {
    if (players.length > 0) {
      calculateLiveRankings();
    }
  }, [players, calculateLiveRankings]);

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
    
    // Sync local weights when sliderWeights change
    useEffect(() => {
      setLocalWeights(sliderWeights);
    }, [sliderWeights]);
    
    // Persist weights function
    const persistWeights = useCallback(() => {
      persistSliderWeights(localWeights);
    }, [localWeights, persistSliderWeights]);
    
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
          /* Viewer-only interface - Read-only player list */
          <div className="space-y-4">
            {players.length > 0 ? (
              <>
                {/* Age Group Filter for Viewers */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center gap-3">
                    <Filter className="w-5 h-5 text-cmf-primary flex-shrink-0" />
                    <select
                      value={selectedAgeGroup || 'all'}
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

                {/* Read-only Player List */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    👥 Event Participants
                    <span className="text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                      {selectedAgeGroup === 'all' ? players.length : (grouped[selectedAgeGroup]?.length || 0)} players
                    </span>
                  </h3>
                  
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {(selectedAgeGroup === 'all' ? players : (grouped[selectedAgeGroup] || [])).map((player) => (
                      <div key={player.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold text-gray-900">{player.name}</h4>
                            <p className="text-sm text-gray-600">
                              Player #{player.number || 'N/A'}
                              {selectedAgeGroup === 'all' && ` • ${player.age_group}`}
                            </p>
                          </div>
                          <div className="text-right">
                            {player.composite_score != null ? (
                              <div className="text-sm font-bold text-cmf-primary">
                                {player.composite_score.toFixed(1)} pts
                              </div>
                            ) : (
                              <div className="text-xs text-gray-500">No scores yet</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Info box for viewers */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-blue-600 text-sm">ℹ️</span>
                    </div>
                    <div>
                      <p className="text-blue-800 font-medium text-sm mb-1">Viewer Access</p>
                      <p className="text-blue-700 text-sm">
                        You have read-only access to view event participants and scores. 
                        Contact your event organizer if you need additional access.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">No Participants Yet</h3>
                <p className="text-gray-600">
                  Players haven't been added to this event yet. Check back later!
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
                          Player Management & Prospect Rankings
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

                    {liveRankings[selectedAgeGroup] && liveRankings[selectedAgeGroup].length > 0 ? (
                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
    </div>
  );
}