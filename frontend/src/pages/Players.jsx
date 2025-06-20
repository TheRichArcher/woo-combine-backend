import React, { useEffect, useState, useCallback } from "react";
import DrillInputForm from "../components/DrillInputForm";
import { useEvent } from "../context/EventContext";
import { useAuth } from "../context/AuthContext";
import EventSelector from "../components/EventSelector";
import api from '../lib/api';
import { X, TrendingUp, Award, Edit, Settings, Users, BarChart3, Download, Filter } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

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

// Preset weight configurations for individual player analysis
const WEIGHT_PRESETS = {
  balanced: {
    name: "Balanced",
    description: "Equal emphasis on all skills",
    weights: { "40m_dash": 0.2, "vertical_jump": 0.2, "catching": 0.2, "throwing": 0.2, "agility": 0.2 }
  },
  speed: {
    name: "Speed Focused",
    description: "Emphasizes speed and athleticism",
    weights: { "40m_dash": 0.4, "vertical_jump": 0.3, "catching": 0.1, "throwing": 0.1, "agility": 0.1 }
  },
  skills: {
    name: "Skills Focused", 
    description: "Emphasizes catching and throwing",
    weights: { "40m_dash": 0.1, "vertical_jump": 0.1, "catching": 0.35, "throwing": 0.35, "agility": 0.1 }
  },
  athletic: {
    name: "Athletic",
    description: "Default weighting system",
    weights: { "40m_dash": 0.3, "vertical_jump": 0.2, "catching": 0.15, "throwing": 0.15, "agility": 0.2 }
  }
};

// Tab configuration
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

// Edit Player Modal Component
function EditPlayerModal({ player, allPlayers, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: player?.name || '',
    number: player?.number || '',
    age_group: player?.age_group || ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Get existing age groups from all players for suggestions
  const existingAgeGroups = [...new Set(
    allPlayers
      .map(p => p.age_group)
      .filter(ag => ag && ag.trim() !== '')
  )].sort();

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(''); // Clear error when user types
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

      await api.put(`/players/${player.id}?event_id=${player.event_id}`, updateData);
      onSave(); // Refresh the players list
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
        {/* Header */}
        <div className="bg-cmf-primary text-white p-6 rounded-t-xl flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Edit className="w-5 h-5" />
            <h2 className="text-xl font-bold">Edit Player</h2>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

          {/* Player Name */}
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

          {/* Player Number */}
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

          {/* Age Group - Flexible Input */}
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
            {/* Datalist for suggestions based on existing age groups */}
            <datalist id="age-group-suggestions">
              {existingAgeGroups.map(ageGroup => (
                <option key={ageGroup} value={ageGroup} />
              ))}
              {/* Common format suggestions */}
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

          {/* Action Buttons */}
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

// Player Details Modal Component with Interactive Weight Controls
function PlayerDetailsModal({ player, allPlayers, onClose }) {
  const [weights, setWeights] = useState({ ...DRILL_WEIGHTS });
  const [activePreset, setActivePreset] = useState("athletic");

  if (!player || !allPlayers || allPlayers.length === 0) return null;

  // Convert weights to percentages for display
  const getPercentages = () => {
    const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    if (total === 0) return {}; // Prevent division by zero
    const percentages = {};
    DRILLS.forEach(drill => {
      percentages[drill.key] = Math.round((weights[drill.key] / total) * 100);
    });
    return percentages;
  };

  // Convert percentage back to normalized weights
  const updateWeightsFromPercentage = (drillKey, percentage) => {
    const newPercentages = { ...getPercentages(), [drillKey]: percentage };
    const total = Object.values(newPercentages).reduce((sum, pct) => sum + pct, 0);
    
    if (total === 0) return; // Prevent division by zero
    
    // Normalize to sum to 1.0
    const newWeights = {};
    DRILLS.forEach(drill => {
      newWeights[drill.key] = newPercentages[drill.key] / total;
    });
    
    setWeights(newWeights);
    setActivePreset(null); // Clear preset when manually adjusted
  };

  // Apply a preset
  const applyPreset = (presetKey) => {
    setWeights({ ...WEIGHT_PRESETS[presetKey].weights });
    setActivePreset(presetKey);
  };

  // FIXED: Calculate individual drill rankings with robust error handling
  const drillRankings = {};
  DRILLS.forEach(drill => {
    try {
      // Ensure we have valid players with the same age group and drill scores
      const validPlayers = allPlayers.filter(p => 
        p && 
        p.id && 
        p.age_group === player.age_group && 
        p[drill.key] != null && 
        typeof p[drill.key] === 'number'
      );
      
      if (validPlayers.length === 0) {
        drillRankings[drill.key] = null;
        return;
      }
      
      // Sort players by drill score (descending for most drills, ascending for 40m_dash)
      const sortedPlayers = validPlayers.sort((a, b) => {
        if (drill.key === "40m_dash") {
          return a[drill.key] - b[drill.key]; // Lower time is better
        }
        return b[drill.key] - a[drill.key]; // Higher score is better
      });
      
      // Find this player's rank (using consistent id comparison)
      const rank = sortedPlayers.findIndex(p => p.id === player.id) + 1;
      drillRankings[drill.key] = rank > 0 ? rank : null;
          } catch {
        drillRankings[drill.key] = null;
    }
  });

  // FIXED: Calculate weighted score breakdown with better error handling
  const weightedBreakdown = DRILLS.map(drill => {
    try {
      const rawScore = player[drill.key] != null && typeof player[drill.key] === 'number' 
        ? player[drill.key] 
        : null;
      const weight = weights[drill.key] || 0;
      const weightedScore = rawScore != null ? rawScore * weight : 0;
      
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

  const totalWeightedScore = weightedBreakdown.reduce((sum, item) => sum + (item.weightedScore || 0), 0);
  const percentages = getPercentages();

  // FIXED: Calculate overall ranking with robust error handling
  let currentRank = 1;
  let ageGroupPlayers = [];
  
  try {
    // Filter age group players with better validation
    ageGroupPlayers = allPlayers.filter(p => 
      p && 
      p.id && 
      p.age_group === player.age_group
    );
    
    if (ageGroupPlayers.length > 0) {
      // Calculate scores for all players with error handling
      const playersWithScores = ageGroupPlayers.map(p => {
        try {
          const score = DRILLS.reduce((sum, drill) => {
            const drillScore = p[drill.key] != null && typeof p[drill.key] === 'number' ? p[drill.key] : 0;
            const weight = weights[drill.key] || 0;
            return sum + (drillScore * weight);
          }, 0);
          return { ...p, currentScore: score };
        } catch {
          return { ...p, currentScore: 0 };
        }
      }).sort((a, b) => (b.currentScore || 0) - (a.currentScore || 0));
      
      // Find this player's rank
      const rankIndex = playersWithScores.findIndex(p => p.id === player.id);
      currentRank = rankIndex >= 0 ? rankIndex + 1 : 1;
    }
  } catch {
    currentRank = 1;
    ageGroupPlayers = [player]; // Fallback to just this player
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[95vh] flex flex-col">
        {/* Compact Header */}
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
            className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Content - Scrollable Areas */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full flex">
            {/* Left Column: Drill Results */}
            <div className="flex-1 p-4">
              <div className="h-full flex flex-col">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cmf-primary" />
                  Drill Performance & Weight Control
                </h3>
          
                <div className="grid grid-cols-1 gap-2 flex-1 overflow-y-auto">
            {weightedBreakdown.map(drill => (
                    <div key={drill.key} className="bg-gray-50 rounded-lg p-2 border border-gray-200">
                      {/* Compact Drill Row */}
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="min-w-0">
                            <h4 className="font-semibold text-gray-900 text-sm">{drill.label}</h4>
                            <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-cmf-primary">
                        {drill.rawScore != null ? `${drill.rawScore} ${drill.unit}` : 'No score'}
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
                
                      {/* Weight Slider Row */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-600 w-16">
                          {percentages[drill.key]}%
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={percentages[drill.key]}
                          onChange={e => updateWeightsFromPercentage(drill.key, parseInt(e.target.value))}
                          className="flex-1 accent-cmf-primary h-2 rounded-lg"
                        />
                        {/* Visual Impact Indicator */}
                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                            className="h-full bg-gradient-to-r from-cmf-primary to-cmf-secondary transition-all duration-300"
                      style={{ 
                        width: `${Math.min((drill.weightedScore / Math.max(...weightedBreakdown.map(d => d.weightedScore))) * 100, 100)}%` 
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
                {/* Total Score at Bottom */}
                <div className="mt-2 p-2 bg-cmf-primary/10 rounded-lg border-2 border-cmf-primary/20 flex-shrink-0">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-900 text-sm">Total Composite Score:</span>
              <span className="text-lg font-bold text-cmf-primary">
                      {totalWeightedScore.toFixed(2)} pts (Rank #{currentRank})
              </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Weight Presets & Analysis */}
            <div className="w-80 bg-gray-50 p-4 border-l border-gray-200 overflow-y-auto">
              <div className="h-full flex flex-col">
                {/* Quick Presets */}
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
                            ? 'border-cmf-primary bg-cmf-primary/5 text-cmf-primary' 
                            : 'border-gray-200 hover:border-gray-300 text-gray-700'
                        }`}
                      >
                        <div className="font-medium text-sm">{preset.name}</div>
                        <div className="text-xs text-gray-500">{preset.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Real-time Ranking Analysis */}
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
                        {activePreset ? `Using ${WEIGHT_PRESETS[activePreset].name} preset` : 'Using custom weights'}
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

// MOBILE-OPTIMIZED WEIGHT CONTROLS COMPONENT
const MobileWeightControls = ({ showSliders = false }) => {
  const [showCustomControls, setShowCustomControls] = useState(showSliders);
  
  return (
    <div className="bg-gradient-to-r from-cmf-primary/10 to-cmf-secondary/10 rounded-xl border-2 border-cmf-primary/30 p-4 mb-6">
      <div className="flex items-center gap-2 mb-2">
        <Settings className="w-5 h-5 text-cmf-primary" />
        <h2 className="text-lg font-semibold text-cmf-secondary">Weight Controls</h2>
      </div>
      <p className="text-cmf-primary text-sm mb-3">
        Adjust ranking priorities to see how player rankings change in real-time.
        <span className="block text-xs mt-1 opacity-75">
          Currently: <strong>{WEIGHT_PRESETS[activePreset]?.name || 'Custom'}</strong>
        </span>
      </p>
      
      {/* Preset Buttons - Mobile-First Design */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {Object.entries(WEIGHT_PRESETS).map(([key, preset]) => (
          <button 
            key={key}
            onClick={() => applyPreset(key)} 
            className={`p-3 text-left rounded-lg border-2 transition-all touch-manipulation ${
              activePreset === key 
                ? 'border-cmf-primary bg-cmf-primary text-white' 
                : 'border-gray-200 hover:border-cmf-primary bg-white text-gray-700'
            }`}
          >
            <div className="font-medium text-sm">{preset.name}</div>
            <div className="text-xs opacity-75 mt-1">{preset.description}</div>
          </button>
        ))}
      </div>

      {/* Toggle for Custom Controls */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-700">Custom Adjustments</span>
        <button
          onClick={() => setShowCustomControls(!showCustomControls)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            showCustomControls 
              ? 'bg-cmf-primary text-white' 
              : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
          }`}
        >
          {showCustomControls ? 'Hide' : 'Show'} Sliders
        </button>
      </div>

      {/* Custom Weight Sliders - Mobile Optimized */}
      {showCustomControls && (
        <div className="space-y-4">
          {(() => {
            const percentages = getPercentages();
            return DRILLS.map(drill => (
              <div key={drill.key} className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">{drill.label}</label>
                  <span className="text-sm font-mono text-cmf-primary bg-cmf-primary/10 px-2 py-1 rounded">
                    {percentages[drill.key]}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={percentages[drill.key]}
                  onChange={e => updateWeightsFromPercentage(drill.key, parseInt(e.target.value))}
                  className="w-full h-8 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-thumb"
                  style={{
                    background: `linear-gradient(to right, #14b8a6 0%, #14b8a6 ${percentages[drill.key]}%, #e5e7eb ${percentages[drill.key]}%, #e5e7eb 100%)`
                  }}
                />
              </div>
            ));
          })()}
          
          <div className="text-xs text-gray-500 text-center bg-blue-50 p-2 rounded">
            💡 Rankings update automatically as you adjust priorities
          </div>
        </div>
      )}
    </div>
  );
};

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

  // NEW: Tabbed interface state
  const [activeTab, setActiveTab] = useState('players');
  
  // NEW: Detect URL parameters for tab selection
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam && ['players', 'rankings', 'exports'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [location.search]);
  
  // NEW: Rankings & Analysis state (from CoachDashboard)
  const [selectedAgeGroup, setSelectedAgeGroup] = useState("");
  const [rankings, setRankings] = useState([]);
  const [rankingsLoading, setRankingsLoading] = useState(false);
  const [rankingsError, setRankingsError] = useState(null);

  // UNIFIED WEIGHT CONTROLS: Use single state for both tabs to ensure consistency
  const [weights, setWeights] = useState(DRILL_WEIGHTS);
  const [activePreset, setActivePreset] = useState('balanced');

  const getPercentages = () => {
    const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    const percentages = {};
    DRILLS.forEach(drill => {
      percentages[drill.key] = total > 0 ? Math.round((weights[drill.key] / total) * 100) : 0;
    });
    return percentages;
  };

  const updateWeightsFromPercentage = (drillKey, percentage) => {
    const newWeights = { ...weights };
    const otherDrills = DRILLS.filter(d => d.key !== drillKey);
    const remainingPercentage = 100 - percentage;
    const currentOtherTotal = otherDrills.reduce((sum, drill) => sum + newWeights[drill.key], 0);
    
    // Set the target drill weight
    newWeights[drillKey] = percentage;
    
    // Distribute remaining percentage proportionally among other drills
    if (currentOtherTotal > 0 && remainingPercentage > 0) {
      otherDrills.forEach(drill => {
        const proportion = newWeights[drill.key] / currentOtherTotal;
        newWeights[drill.key] = Math.round(remainingPercentage * proportion);
      });
    }
    
    setWeights(newWeights);
    setActivePreset(''); // Clear preset when manually adjusting
  };

  const applyPreset = (presetKey) => {
    if (WEIGHT_PRESETS[presetKey]) {
      setWeights(WEIGHT_PRESETS[presetKey].weights);
      setActivePreset(presetKey);
    }
  };

  // NEW: Client-side ranking calculation for Player Management tab
  const calculateWeightedScore = (player, weights) => {
    try {
      let totalScore = 0;
      let totalWeightUsed = 0;
      
      DRILLS.forEach(drill => {
        const drillScore = player[drill.key];
        const weight = weights[drill.key] || 0;
        
        // Only include drills that have actual scores (not null, not 0, not empty)
        if (drillScore != null && typeof drillScore === 'number' && drillScore !== 0) {
          // For 40m dash, lower is better, so we need to invert it
          if (drill.key === "40m_dash") {
            // Using same scale as backend: 30 - time
            const invertedScore = Math.max(0, 30 - drillScore);
            totalScore += invertedScore * weight;
          } else {
            // For other drills, higher is better
            totalScore += drillScore * weight;
          }
          totalWeightUsed += weight;
        }
      });
      
      // If no valid scores, return 0
      if (totalWeightUsed === 0) {
        return 0;
      }
      
      // Normalize by the total weight used to maintain fair comparison
      const totalPossibleWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
      const normalizedScore = (totalScore / totalWeightUsed) * totalPossibleWeight;
      
      return normalizedScore;
    } catch {
      return 0;
    }
  };

  const getSortedPlayersWithWeights = (ageGroupPlayers, weights) => {
    try {
      // Calculate weighted scores for all players
      const playersWithScores = ageGroupPlayers.map(player => ({
        ...player,
        weightedScore: calculateWeightedScore(player, weights)
      }));

      // Sort by weighted score descending, then by name
      return playersWithScores.sort((a, b) => {
        if (a.weightedScore !== b.weightedScore) {
          return b.weightedScore - a.weightedScore;
        }
        return a.name.localeCompare(b.name);
      });
    } catch {
      // Fallback to original sorting
      return ageGroupPlayers.sort((a, b) => {
        if (a.composite_score !== b.composite_score) {
          return (b.composite_score || 0) - (a.composite_score || 0);
        }
        return a.name.localeCompare(b.name);
      });
    }
  };

  // Interactive onboarding callout
  const OnboardingCallout = () => (
    <div className="bg-cmf-primary/10 border-l-4 border-cmf-primary text-cmf-primary px-4 py-3 mb-6 rounded cursor-pointer hover:bg-cmf-primary/15 transition"
         onClick={() => {
           // Scroll to event selector to help users find it
           const eventSelector = document.querySelector('[class*="EventSelector"]') || 
                                 document.querySelector('select') ||
                                 document.querySelector('[data-event-selector]');
           if (eventSelector) {
             eventSelector.scrollIntoView({ behavior: 'smooth', block: 'center' });
             eventSelector.focus();
           }
         }}>
      <div className="flex items-center gap-2">
        <span className="text-lg">💡</span>
        <div>
          <strong>Tip:</strong> Select an event above to manage players and record results.
          <div className="text-sm opacity-75 mt-1">👆 Click here or scroll up to find the event selector</div>
        </div>
      </div>
    </div>
  );

  const fetchPlayers = useCallback(async () => {
    if (!selectedEvent || !user || !selectedLeagueId) {
      setPlayers([]); // Ensure players is always an array
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const { data } = await api.get(`/players?event_id=${selectedEvent.id}`);
      setPlayers(data);
      
      // CRITICAL FIX: Update selectedPlayer data if modal is open
      if (selectedPlayer) {
        const updatedPlayer = data.find(p => p.id === selectedPlayer.id);
        if (updatedPlayer) {
          setSelectedPlayer(updatedPlayer);
        }
      }
    } catch (err) {
      if (err.response?.status === 404) {
        // 404 means no players found yet - normal for new events
        setError(null); // Don't show as error, just empty state
        setPlayers([]);
      } else {
        // Other errors are actual problems
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedEvent, user, selectedLeagueId, selectedPlayer]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  // NEW: Fetch rankings when weights or age group changes
  useEffect(() => {
    const updateRankings = async () => {
      if (!selectedAgeGroup || !user || !selectedLeagueId || !selectedEvent || activeTab !== 'rankings') {
        setRankings([]);
        return;
      }
      
      setRankingsLoading(true);
      setRankingsError(null);
      
      try {
        const params = new URLSearchParams({ 
          age_group: selectedAgeGroup, 
          event_id: selectedEvent.id 
        });
        
        // Add weight parameters
        params.append("weight_40m_dash", weights["40m_dash"]);
        params.append("weight_vertical_jump", weights["vertical_jump"]);
        params.append("weight_catching", weights["catching"]);
        params.append("weight_throwing", weights["throwing"]);
        params.append("weight_agility", weights["agility"]);
        
        const res = await api.get(`/rankings?${params.toString()}`);
        setRankings(res.data);
      } catch (err) {
        if (err.response?.status === 404) {
          setRankingsError(null);
          setRankings([]);
        } else {
          setRankingsError(err.message);
        }
      } finally {
        setRankingsLoading(false);
      }
    };

    // Debounce the API call to avoid too many requests
    const timeoutId = setTimeout(updateRankings, 300);
    return () => clearTimeout(timeoutId);
  }, [selectedAgeGroup, weights, user, selectedLeagueId, selectedEvent, activeTab]);

  // Get unique age groups from players
  const ageGroups = [...new Set(players.map(p => p.age_group))].sort();

  const toggleForm = (id) => {
    setExpandedPlayerIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Group players by age_group
  const grouped = (players || []).reduce((acc, player) => {
    const ageGroup = player.age_group || 'Unassigned';
    acc[ageGroup] = acc[ageGroup] || [];
    acc[ageGroup].push(player);
    return acc;
  }, {});

  if (!selectedEvent || !selectedEvent.id) return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center border-2 border-cmf-primary/30">
          <div className="w-16 h-16 bg-cmf-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
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
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center border-2 border-cmf-primary/30">
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
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center border-2 border-cmf-primary/30">
          <div className="w-16 h-16 bg-cmf-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
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
        {/* Welcome Header - matching dashboard style */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border-2 border-cmf-primary/30">
          <h1 className="text-2xl font-bold text-cmf-secondary mb-2">
            WooCombine: Players & Rankings
          </h1>
          <p className="text-gray-600 mb-4">
            Managing: <strong>{selectedEvent.name}</strong> - {(() => {
              if (selectedEvent.date && !isNaN(Date.parse(selectedEvent.date))) {
                return new Date(selectedEvent.date).toLocaleDateString();
              } else if (selectedEvent.event_date && !isNaN(Date.parse(selectedEvent.event_date))) {
                return new Date(selectedEvent.event_date).toLocaleDateString();
              }
              return 'Date TBD';
            })()}
          </p>
          
          {/* Quick Actions */}
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

        {/* NEW: Tab Navigation */}
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
          
          {/* Tab Description */}
          <div className="px-4 py-2 bg-gray-50 text-xs text-gray-600">
            {TABS.find(tab => tab.id === activeTab)?.description}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'players' && (
          <>
            {/* Weight Adjustment Section - Organizers Only */}
            {userRole === 'organizer' && Object.keys(grouped).length > 0 && (
              <MobileWeightControls />
            )}

            {/* Player Stats Modals */}
            {selectedPlayer && (
              <PlayerDetailsModal player={selectedPlayer} allPlayers={players} onClose={() => setSelectedPlayer(null)} />
            )}
            {editingPlayer && (
              <EditPlayerModal
                player={editingPlayer}
                allPlayers={players}
                onClose={() => setEditingPlayer(null)}
                onSave={fetchPlayers}
              />
            )}

            {/* Age Group Sections */}
            {Object.keys(grouped).length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
                <p className="text-gray-500">No players found for this event.</p>
              </div>
            ) : (
              Object.entries(grouped)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([ageGroup, ageGroupPlayers]) => {
                  // NEW: Sort using weighted rankings based on current Player Management tab weights
                  const sortedPlayers = getSortedPlayersWithWeights(ageGroupPlayers, weights);

                  return (
                    <div key={ageGroup} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
                      <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        🏆 Age Group: {ageGroup}
                      </h2>
                      
                      {/* Mobile-friendly player cards */}
                      <div className="space-y-2">
                        {sortedPlayers.map((player, index) => (
                          <React.Fragment key={player.id}>
                            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                              {/* Player Header */}
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                  <span className={`font-bold text-lg ${index === 0 ? "text-yellow-500" : index === 1 ? "text-gray-500" : index === 2 ? "text-orange-500" : "text-gray-400"}`}>
                                    {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                                  </span>
                                  <div>
                                    <h3 className="font-semibold text-gray-900">{player.name}</h3>
                                    <p className="text-sm text-gray-600">
                                      Player #{player.number || 'N/A'} • Weighted Score: {player.weightedScore != null ? player.weightedScore.toFixed(2) : "No scores yet"}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Action Buttons */}
                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={() => setSelectedPlayer(player)}
                                  className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded-md text-sm font-medium transition"
                                  disabled={userRole !== 'organizer' && !player.composite_score && !Object.values(player).some(val => typeof val === 'number' && val > 0)}
                                >
                                  {userRole === 'organizer' ? 'View Stats & Weights' : 'View Stats'}
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
                            
                            {/* Drill Entry Form */}
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
            {/* Age Group Selection */}
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
                {ageGroups.map(group => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </div>
            
            {/* Drill Weight Controls - Enhanced for better visibility */}
            {userRole === 'organizer' && (
              <MobileWeightControls />
            )}
            
            {/* Rankings Display */}
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
                
                {/* Individual Player Cards - Mobile-First Design */}
                <div className="space-y-3">
                  {rankings.map((player) => {
                    // Calculate individual drill rankings for real-time updates
                    const drillRankings = {};
                    DRILLS.forEach(drill => {
                      const drillRanks = rankings
                        .filter(p => p[drill.key] != null)
                        .map(p => ({ player_id: p.player_id, score: p[drill.key] }))
                        .sort((a, b) => {
                          // 40m dash is time-based (lower is better), others are score-based (higher is better)
                          return drill.key === "40m_dash" ? a.score - b.score : b.score - a.score;
                        });
                      const rank = drillRanks.findIndex(p => p.player_id === player.player_id) + 1;
                      drillRankings[drill.key] = rank > 0 ? rank : null;
                    });

                    return (
                      <div key={player.player_id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        {/* Player Header */}
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
                        
                        {/* Drill Results - Compact Grid */}
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
            {/* Rankings Export Section */}
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

            {/* Analytics Summary */}
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