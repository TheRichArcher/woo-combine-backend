import React, { useEffect, useState, useCallback, useRef } from "react";
import DrillInputForm from "../components/DrillInputForm";
import { useEvent } from "../context/EventContext";
import { useAuth } from "../context/AuthContext";
import EventSelector from "../components/EventSelector";
import api from '../lib/api';
import { X, TrendingUp, Award, Edit, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

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
      console.error('Error updating player:', err);
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

  if (!player) return null;

  // Convert weights to percentages for display
  const getPercentages = () => {
    const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
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

  // Calculate individual drill rankings (same age group only)
  const drillRankings = {};
  DRILLS.forEach(drill => {
    const drillRanks = allPlayers
      .filter(p => p[drill.key] != null && p.age_group === player.age_group)
      .map(p => ({ player_id: p.id, score: p[drill.key] }))
      .sort((a, b) => b.score - a.score);
    const rank = drillRanks.findIndex(p => p.player_id === player.id) + 1;
    drillRankings[drill.key] = rank > 0 ? rank : null;
  });

  // Calculate weighted score breakdown with current weights
  const weightedBreakdown = DRILLS.map(drill => {
    const rawScore = player[drill.key] != null ? player[drill.key] : null;
    const weight = weights[drill.key];
    const weightedScore = (rawScore != null ? rawScore : 0) * weight;
    return {
      ...drill,
      rawScore,
      weight,
      weightedScore,
      rank: drillRankings[drill.key]
    };
  });

  const totalWeightedScore = weightedBreakdown.reduce((sum, item) => sum + item.weightedScore, 0);
  const percentages = getPercentages();

  // Calculate this player's rank with current weights among same age group players
  const ageGroupPlayers = allPlayers.filter(p => p.age_group === player.age_group);
  const playersWithScores = ageGroupPlayers.map(p => {
    const score = DRILLS.reduce((sum, drill) => {
      return sum + (p[drill.key] || 0) * weights[drill.key];
    }, 0);
    return { ...p, currentScore: score };
  }).sort((a, b) => b.currentScore - a.currentScore);
  
  const currentRank = playersWithScores.findIndex(p => p.id === player.id) + 1;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[95vh] flex flex-col">
                {/* Compact Header */}
        <div className="bg-cmf-primary text-white px-3 py-1.5 rounded-t-xl flex justify-between items-center flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold">{player.name}</h2>
            <p className="text-cmf-light text-xs">Player #{player.number} • Age Group: {player.age_group}</p>
          </div>
          <div className="text-right mr-3">
            <div className="text-xs opacity-75">Overall Score</div>
            <div className="text-lg font-bold">{totalWeightedScore.toFixed(2)} pts</div>
            <div className="text-xs opacity-75">#{currentRank} of {ageGroupPlayers.length}</div>
          </div>
          <button 
            onClick={onClose}
            className="w-7 h-7 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Content - Scrollable Areas */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full flex">
            {/* Left Column: Drill Results */}
            <div className="flex-1 p-2">
              <div className="h-full flex flex-col">
                <h3 className="text-base font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cmf-primary" />
                  Drill Performance & Weight Control
                </h3>
          
                <div className="grid grid-cols-1 gap-1.5 flex-1 overflow-y-auto min-h-0">
            {weightedBreakdown.map(drill => (
                    <div key={drill.key} className="bg-gray-50 rounded-lg p-1.5 border border-gray-200">
                      {/* Compact Drill Row */}
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1.5">
                          <div className="min-w-0">
                            <h4 className="font-semibold text-gray-900 text-sm">{drill.label}</h4>
                            <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-cmf-primary">
                        {drill.rawScore != null ? `${drill.rawScore} ${drill.unit}` : 'No score'}
                      </span>
                      {drill.rank && (
                                <span className="bg-cmf-primary text-white px-1 py-0.5 rounded-full text-xs font-medium">
                          #{drill.rank}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-600">Contribution</div>
                          <div className="text-sm font-bold text-cmf-secondary">{drill.weightedScore.toFixed(2)} pts</div>
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
                <div className="mt-1.5 p-1.5 bg-cmf-primary/10 rounded-lg border-2 border-cmf-primary/20 flex-shrink-0">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-900 text-xs">Total Composite Score:</span>
              <span className="text-base font-bold text-cmf-primary">
                      {totalWeightedScore.toFixed(2)} pts (#{currentRank})
              </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Weight Presets & Analysis */}
            <div className="w-64 bg-gray-50 p-2 border-l border-gray-200 flex flex-col">
              <div className="flex-1 overflow-y-auto">
                {/* Quick Presets */}
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1.5 flex items-center gap-2">
                    <Settings className="w-3 h-3 text-cmf-primary" />
                    Weight Scenarios
                  </h3>
                  
                  <div className="grid grid-cols-1 gap-1">
                    {Object.entries(WEIGHT_PRESETS).map(([key, preset]) => (
                      <button
                        key={key}
                        onClick={() => applyPreset(key)}
                        className={`p-1.5 text-left rounded-lg border-2 transition-all ${
                          activePreset === key 
                            ? 'border-cmf-primary bg-cmf-primary/5 text-cmf-primary' 
                            : 'border-gray-200 hover:border-gray-300 text-gray-700'
                        }`}
                      >
                        <div className="font-medium text-xs">{preset.name}</div>
                        <div className="text-xs text-gray-500">{preset.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Real-time Ranking Analysis */}
                <div className="bg-white rounded-lg p-2 border border-gray-200 mt-3">
                  <h4 className="font-semibold text-gray-900 mb-1.5 flex items-center gap-1.5">
                    <Award className="w-3 h-3 text-yellow-500" />
                    <span className="text-sm">Ranking Analysis</span>
                  </h4>
                  
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Age Group Rank:</span>
                      <span className="font-bold text-cmf-primary">#{currentRank} of {ageGroupPlayers.length}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-600">Overall Score:</span>
                      <span className="font-bold text-cmf-secondary">{totalWeightedScore.toFixed(2)} pts</span>
                    </div>
                    
                    <div className="pt-1.5 border-t border-gray-200">
                      <div className="text-xs text-gray-500 mb-1">Score Breakdown:</div>
                      {weightedBreakdown.map(drill => (
                        <div key={drill.key} className="flex justify-between text-xs">
                          <span className="text-gray-600">{drill.label}:</span>
                          <span className="font-mono">{drill.weightedScore.toFixed(2)} pts</span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="pt-1.5 border-t border-gray-200">
                      <div className="text-xs text-gray-500">
                        {activePreset ? `Using ${WEIGHT_PRESETS[activePreset].name} preset` : 'Using custom weights'}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-2 text-xs text-gray-500 text-center">
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
  
  // NEW: Age group ranking controls state
  const [selectedAgeGroup, setSelectedAgeGroup] = useState("");
  const [rankings, setRankings] = useState([]);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [rankingError, setRankingError] = useState(null);
  const [weights, setWeights] = useState({ ...DRILL_WEIGHTS });
  const [activePreset, setActivePreset] = useState("athletic");
  
  // Ref to access current selectedPlayer value without triggering re-renders
  const selectedPlayerRef = useRef(null);
  selectedPlayerRef.current = selectedPlayer;

  // NEW: Convert weights to percentages for display
  const getPercentages = () => {
    const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    const percentages = {};
    DRILLS.forEach(drill => {
      percentages[drill.key] = Math.round((weights[drill.key] / total) * 100);
    });
    return percentages;
  };

  // NEW: Convert percentage back to normalized weights
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

  // NEW: Apply a preset
  const applyPreset = (presetKey) => {
    setWeights({ ...WEIGHT_PRESETS[presetKey].weights });
    setActivePreset(presetKey);
  };

  // NEW: CSV Export logic
  const handleExportCsv = () => {
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
      if (selectedPlayerRef.current) {
        const updatedPlayer = data.find(p => p.id === selectedPlayerRef.current.id);
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
  }, [selectedEvent, user, selectedLeagueId]);

  // NEW: Auto-update rankings when weights or age group changes
  useEffect(() => {
    const updateRankings = async () => {
      if (!selectedAgeGroup || !user || !selectedLeagueId || !selectedEvent) {
        setRankings([]);
        return;
      }
      
      setRankingLoading(true);
      setRankingError(null);
      
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
          setRankingError(null);
          setRankings([]);
        } else {
          console.error('[Players] Rankings fetch error:', err);
          setRankingError(err.message);
        }
      } finally {
        setRankingLoading(false);
      }
    };

    // Debounce the API call to avoid too many requests
    const timeoutId = setTimeout(updateRankings, 300);
    return () => clearTimeout(timeoutId);
  }, [selectedAgeGroup, weights, user, selectedLeagueId, selectedEvent]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

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

  // NEW: Get unique age groups from players for ranking controls
  const ageGroups = [...new Set(players.map(p => p.age_group))].sort();
  const percentages = getPercentages();

  if (!selectedEvent || !selectedEvent.id) return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex flex-col items-center justify-center min-h-[40vh]">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-lg mx-auto text-center border-2 border-cmf-primary/30">
          <h2 className="text-2xl font-bold text-cmf-primary mb-4">No event selected</h2>
          <p className="text-cmf-secondary mb-4">
            {userRole === "organizer"
              ? "Select or create an event to manage players and drills."
              : "Ask your league operator to assign you to an event."}
          </p>
          <div className="mb-4">
            <EventSelector />
          </div>
        </div>
      </div>
    </div>
  );
  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div>Loading players...</div>
    </div>
  );
  if (error) {
    if (error.includes('422')) {
      return (
        <div className="min-h-screen bg-gray-50">
          <div className="flex flex-col items-center justify-center min-h-[40vh]">
            <div className="bg-white rounded-xl shadow-lg p-8 max-w-lg mx-auto text-center border-2 border-cmf-primary/30">
              <h2 className="text-2xl font-bold text-cmf-primary mb-4">No players found</h2>
              <p className="text-cmf-secondary mb-4">Use the Admin tab to upload or import players to get started.</p>
              <Link to="/admin" className="bg-cmf-primary text-white font-bold px-4 py-2 rounded shadow hover:bg-cmf-secondary transition">Go to Admin</Link>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }
  if (players.length === 0) return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex flex-col items-center justify-center min-h-[40vh]">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-lg mx-auto text-center border-2 border-cmf-primary/30">
          <h2 className="text-2xl font-bold text-cmf-primary mb-4">No players found yet</h2>
          <p className="text-cmf-secondary mb-4">You can upload a CSV or add them manually to get started.</p>
          <div className="flex gap-4 justify-center">
            <Link to="/admin#player-upload-section" className="bg-cmf-primary text-white font-bold px-4 py-2 rounded shadow hover:bg-cmf-secondary transition">Upload CSV</Link>
            <Link to="/admin#player-upload-section" className="bg-cmf-secondary text-white font-bold px-4 py-2 rounded shadow hover:bg-cmf-primary transition">Add Player</Link>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 text-cmf-contrast font-sans">
      <div className="max-w-lg mx-auto px-4 sm:px-6 mt-20">
        <EventSelector />
        <OnboardingCallout />
        {/* Main Heading */}
        <div className="text-xs uppercase font-bold text-gray-500 tracking-wide mb-1">WooCombine: Players & Rankings</div>
        <h1 className="text-lg font-semibold text-gray-900 mb-4">
          Managing: {selectedEvent.name} – {new Date(selectedEvent.event_date).toLocaleDateString()}
        </h1>

        {/* NEW: Age Group Ranking Controls */}
        {ageGroups.length > 0 && (
          <>
            {/* Age Group Dropdown */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm max-w-md">
              <label className="block text-sm font-bold text-gray-700 mb-1">📊 View Rankings by Age Group</label>
              <select
                value={selectedAgeGroup}
                onChange={e => setSelectedAgeGroup(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-cmf-primary focus:border-cmf-primary sm:text-sm"
              >
                <option value="">Select Age Group for Rankings</option>
                {ageGroups.map(group => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </div>
            
            {/* Improved Drill Weight Controls - Only for organizers */}
            {userRole === 'organizer' && (
              <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-5 mb-6 max-w-2xl">
                <div className="flex items-center gap-2 mb-4">
                  <Settings className="w-4 h-4 text-cmf-primary" />
                  <h2 className="text-sm font-medium text-gray-800">Ranking Priorities</h2>
                </div>
                
                {/* Preset Buttons */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">Quick Presets:</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(WEIGHT_PRESETS).map(([key, preset]) => (
                      <button
                        key={key}
                        onClick={() => applyPreset(key)}
                        className={`p-3 text-left rounded-lg border-2 transition-all ${
                          activePreset === key 
                            ? 'border-cmf-primary bg-cmf-primary/5 text-cmf-primary' 
                            : 'border-gray-200 hover:border-gray-300 text-gray-700'
                        }`}
                      >
                        <div className="font-medium text-sm">{preset.name}</div>
                        <div className="text-xs text-gray-500 mt-1">{preset.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Adjustments */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Custom Adjustments:
                    {activePreset && (
                      <span className="ml-2 text-xs text-gray-500">
                        (Currently using {WEIGHT_PRESETS[activePreset].name})
                      </span>
                    )}
                  </label>
                  
                  <div className="space-y-4">
                    {DRILLS.map(drill => (
                      <div key={drill.key} className="flex items-center justify-between">
                        <div className="flex-1">
                          <label className="block text-sm text-gray-700 mb-1">{drill.label}</label>
                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={percentages[drill.key]}
                              onChange={e => updateWeightsFromPercentage(drill.key, parseInt(e.target.value))}
                              className="flex-1 accent-cmf-primary h-2 rounded-lg bg-gray-100"
                            />
                            <div className="w-12 text-right">
                              <span className="text-sm font-mono text-cmf-primary">
                                {percentages[drill.key]}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-4 text-xs text-gray-500 text-center">
                    Rankings update automatically as you adjust priorities
                  </div>
                </div>
              </div>
            )}
            
            {/* Rankings Display */}
            {selectedAgeGroup && (
              <>
                {rankingLoading ? (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center mb-6">
                    <div className="animate-spin inline-block w-6 h-6 border-2 border-gray-300 border-t-cmf-primary rounded-full mb-2"></div>
                    <div className="text-gray-500">Updating rankings...</div>
                  </div>
                ) : rankingError ? (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 mb-6">
                    <strong>Error:</strong> {rankingError}
                  </div>
                ) : rankings.length === 0 ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center text-yellow-700 mb-6">
                    No players found for this age group with complete drill results.
                  </div>
                ) : (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 -mx-4 sm:mx-0 sm:rounded-xl">
                    <div className="p-4 sm:p-6">
                      <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                        <h2 className="text-xl font-semibold">🏆 Rankings ({selectedAgeGroup})</h2>
                        <button
                          onClick={handleExportCsv}
                          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-700 text-sm"
                          disabled={rankings.length === 0}
                        >
                          📊 Export as CSV
                        </button>
                      </div>
                      
                      {/* Rankings Table */}
                      <div className="overflow-x-auto -mx-4 sm:mx-0">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="py-3 px-2">Rank</th>
                            <th className="py-3 px-2">Name</th>
                            <th className="py-3 px-2">Player #</th>
                            <th className="py-3 px-2">Overall Score</th>
                            <th className="py-3 px-2 text-center">40M Dash</th>
                            <th className="py-3 px-2 text-center">Vertical</th>
                            <th className="py-3 px-2 text-center">Catching</th>
                            <th className="py-3 px-2 text-center">Throwing</th>
                            <th className="py-3 px-2 text-center">Agility</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rankings.map((player) => {
                            // Calculate individual drill rankings
                            const drillRankings = {};
                            DRILLS.forEach(drill => {
                              const drillRanks = rankings
                                .filter(p => p[drill.key] != null)
                                .map(p => ({ player_id: p.player_id, score: p[drill.key] }))
                                .sort((a, b) => b.score - a.score);
                              const rank = drillRanks.findIndex(p => p.player_id === player.player_id) + 1;
                              drillRankings[drill.key] = rank > 0 ? rank : null;
                            });

                            return (
                              <tr key={player.player_id} className="border-t border-gray-100 hover:bg-gray-50">
                                <td className={`py-3 px-2 font-bold ${player.rank === 1 ? "text-yellow-500" : player.rank === 2 ? "text-gray-500" : player.rank === 3 ? "text-orange-500" : ""}`}>
                                  {player.rank === 1 ? "🥇" : player.rank === 2 ? "🥈" : player.rank === 3 ? "🥉" : player.rank}
                                </td>
                                <td className="py-3 px-2">{player.name}</td>
                                <td className="py-3 px-2">{player.number}</td>
                                <td className="py-3 px-2 font-mono font-bold">{player.composite_score.toFixed(2)}</td>
                                {DRILLS.map(drill => (
                                  <td key={drill.key} className="py-3 px-2 text-center">
                                    {player[drill.key] != null ? (
                                      <div className="flex flex-col">
                                        <span className="font-mono text-sm">{player[drill.key]}</span>
                                        <span className="text-xs text-gray-500">
                                          #{drillRankings[drill.key] || '-'}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-gray-400">-</span>
                                    )}
                                  </td>
                                ))}
                              </tr>
                            );
                                                    })}
                        </tbody>
                      </table>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Player Management Section */}
        <div className="border-t-2 border-gray-200 pt-8 mt-8">
          <div className="text-xs uppercase font-bold text-gray-500 tracking-wide mb-1">Player Management</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Individual Player Records & Drill Entry</h2>
        </div>

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
          <div className="text-center py-8 text-gray-500">No players found for this event.</div>
        ) : (
          Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([ageGroup, ageGroupPlayers]) => {
              // Sort by composite_score descending, then by name
              const sortedPlayers = ageGroupPlayers.sort((a, b) => {
                if (a.composite_score !== b.composite_score) {
                  return (b.composite_score || 0) - (a.composite_score || 0);
                }
                return a.name.localeCompare(b.name);
              });

              return (
                <div key={ageGroup} className="bg-white rounded-2xl shadow-sm border border-gray-200 py-4 px-5 mb-6">
                  <div className="text-xs font-bold text-gray-500 tracking-wide uppercase mb-1 flex items-center gap-2">
                    <span>Age Group: {ageGroup}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full bg-white border border-gray-200 rounded-lg">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                          <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                          <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Player #</th>
                          <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Composite Score</th>
                          <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {sortedPlayers.map((player, index) => (
                          <React.Fragment key={player.id}>
                            <tr className="border-t hover:bg-gray-50">
                              <td className={`py-2 px-2 font-bold ${index === 0 ? "text-yellow-500" : index === 1 ? "text-gray-500" : index === 2 ? "text-orange-500" : ""}`}>
                                {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1}
                              </td>
                              <td className="py-2 px-2">{player.name}</td>
                              <td className="py-2 px-2">{player.number || 'N/A'}</td>
                              <td className="py-2 px-2 font-mono">
                                {player.composite_score != null ? player.composite_score.toFixed(2) : "No scores yet"}
                              </td>
                              <td className="py-2 px-2">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => setSelectedPlayer(player)}
                                    className="text-blue-600 hover:text-blue-900 text-sm underline"
                                    disabled={!player.composite_score && !Object.values(player).some(val => typeof val === 'number' && val > 0)}
                                  >
                                    View Stats
                                  </button>
                                  <button
                                    onClick={() => setEditingPlayer(player)}
                                    className="text-green-600 hover:text-green-900 text-sm underline"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => toggleForm(player.id)}
                                    className="text-cyan-600 hover:text-cyan-900 text-sm underline"
                                  >
                                    Add Result
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {/* Drill Entry Form Row */}
                            {expandedPlayerIds[player.id] && (
                                                             <tr className="bg-blue-50">
                                 <td colSpan="5" className="py-4 px-2">
                                   <DrillInputForm playerId={player.id} onSuccess={() => { toggleForm(player.id); fetchPlayers(); }} />
                                 </td>
                               </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
        )}
      </div>
    </div>
  );
} 