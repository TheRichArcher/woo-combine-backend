import React, { useEffect, useState } from "react";
import { useEvent } from "../context/EventContext";
import { useAuth } from "../context/AuthContext";
import EventSelector from "../components/EventSelector";
import api from '../lib/api';
import { Settings } from 'lucide-react';
import { useNavigate } from "react-router-dom";
import { CreateLeagueForm } from './CreateLeague';

const DRILL_WEIGHTS = {
  "40m_dash": 0.3,
  "vertical_jump": 0.2,
  "catching": 0.15,
  "throwing": 0.15,
  "agility": 0.2,
};

const DRILLS = [
  { key: "40m_dash", label: "40-Yard Dash" },
  { key: "vertical_jump", label: "Vertical Jump" },
  { key: "catching", label: "Catching" },
  { key: "throwing", label: "Throwing" },
  { key: "agility", label: "Agility" },
];

// Preset weight configurations
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
    description: "Emphasizes physical abilities",
    weights: { "40m_dash": 0.25, "vertical_jump": 0.25, "catching": 0.15, "throwing": 0.15, "agility": 0.2 }
  }
};

export default function CoachDashboard() {
  const { selectedEvent, noLeague, LeagueFallback } = useEvent();
  const { user, selectedLeagueId, userRole, leagues } = useAuth();
  const [selectedAgeGroup, setSelectedAgeGroup] = useState("");
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [players, setPlayers] = useState([]); // for age group list only
  const [weights, setWeights] = useState({ ...DRILL_WEIGHTS });
  const [activePreset, setActivePreset] = useState("athletic"); // Default preset
  const navigate = useNavigate();

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

  // Fetch all players to get available age groups
  useEffect(() => {
    async function fetchPlayers() {
      if (!selectedEvent || !user || !selectedLeagueId) return;
      try {
        const { data } = await api.get(`/players?event_id=${selectedEvent.id}`);
        setPlayers(data);
      } catch (error) {
        if (error.response?.status === 404) {
          // 404 means no players found yet - normal for new events
          setPlayers([]);
        } else {
          // Other errors are actual problems
          console.error('[CoachDashboard] Players fetch error:', error);
          setPlayers([]);
        }
      }
    }
    fetchPlayers();
  }, [selectedEvent, user, selectedLeagueId]);

  // Get unique age groups from players
  const ageGroups = [...new Set(players.map(p => p.age_group))].sort();

  // Auto-update rankings when weights or age group changes
  useEffect(() => {
    const updateRankings = async () => {
      if (!selectedAgeGroup || !user || !selectedLeagueId || !selectedEvent) {
        setRankings([]);
        return;
      }
      
      setLoading(true);
      setError(null);
      
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
          setError(null);
          setRankings([]);
        } else {
          console.error('[CoachDashboard] Rankings fetch error:', err);
          setError(err.message);
        }
      } finally {
        setLoading(false);
      }
    };

    // Debounce the API call to avoid too many requests
    const timeoutId = setTimeout(updateRankings, 300);
    return () => clearTimeout(timeoutId);
  }, [selectedAgeGroup, weights, user, selectedLeagueId, selectedEvent]);

  // CSV Export logic
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

  // Format event date
  const formattedDate = selectedEvent && selectedEvent.date && !isNaN(Date.parse(selectedEvent.date)) ? new Date(selectedEvent.date).toLocaleDateString() : 'Invalid Date';

  // Scroll to import section if hash is present
  useEffect(() => {
    const anchor = window.location.hash;
    if (anchor) {
      const el = document.querySelector(anchor);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, []);

  // If no players, show onboarding/fallback actions
  if (players.length === 0) {
    const handleImport = () => {
      navigate('/admin#player-upload-section');
    };
    // If user has no leagues, show inline CreateLeagueForm
    if (!leagues || leagues.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[40vh] mt-20">
                  <div className="bg-white rounded-2xl shadow-lg p-8 max-w-lg mx-auto text-center border-2 border-cmf-primary/30">
          <h2 className="text-2xl font-bold text-cmf-secondary mb-4">Welcome to Woo-Combine!</h2>
          <p className="text-cmf-secondary mb-2">It looks like you haven't created a league yet. That's totally normal for new organizers!</p>
            <p className="text-gray-700 mb-4">To get started, create your first league below:</p>
            <CreateLeagueForm onCreated={() => navigate('/onboarding/event')} />
          </div>
        </div>
      );
    }
    // If user has leagues, show Import Players for organizers
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] mt-20">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-lg mx-auto text-center border-2 border-cmf-primary/30">
          <h2 className="text-2xl font-bold text-cmf-secondary mb-4">Welcome to Woo-Combine!</h2>
          <p className="text-cmf-secondary mb-2">It looks like you haven't added any players yet. That's totally normal for new leagues!</p>
          <p className="text-gray-700 mb-4">To get started, you can:</p>
          <div className="flex flex-col gap-3 items-center">
            {userRole === 'organizer' ? (
              <button onClick={handleImport} className="bg-cmf-secondary text-white font-bold px-4 py-2 rounded shadow hover:bg-cmf-primary transition w-full max-w-xs">📥 Import Players</button>
            ) : (
              <span className="text-gray-500">Waiting for organizer to import players.</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (noLeague) return <LeagueFallback />;

  const percentages = getPercentages();

  return (
    <div className="min-h-screen bg-gray-50 text-cmf-contrast font-sans">
      <div className="max-w-lg mx-auto px-4 sm:px-6 mt-20">
        <EventSelector />
        {/* Header & Title Block */}
        <div className="text-xs uppercase font-bold text-gray-500 tracking-wide mb-1">Coach Dashboard</div>
        <h1 className="text-lg font-semibold text-gray-900 mb-4">
          {selectedEvent ? `${selectedEvent.name} – ${formattedDate}` : "No event selected"}
        </h1>
        {/* Age Group Dropdown */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
          <label className="block text-sm font-bold text-gray-700 mb-1">Select Age Group</label>
          <select
            value={selectedAgeGroup}
            onChange={e => setSelectedAgeGroup(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-cmf-primary focus:border-cmf-primary sm:text-sm"
          >
            <option value="">Select Age Group</option>
            {ageGroups.map(group => (
              <option key={group} value={group}>{group}</option>
            ))}
          </select>
        </div>
        
        {/* Improved Drill Weight Controls */}
        {userRole === 'organizer' && (
          <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-5 mb-6">
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
                          onInput={e => updateWeightsFromPercentage(drill.key, parseInt(e.target.value))}
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
        
        {/* Rankings Table and Loading/Error States */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="animate-spin inline-block w-6 h-6 border-2 border-gray-300 border-t-cmf-primary rounded-full mb-2"></div>
            <div className="text-gray-500">Updating rankings...</div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
            <strong>Error:</strong> {error}
          </div>
        ) : selectedAgeGroup === "" ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center text-gray-500">
            Please select an age group to view rankings.
          </div>
        ) : rankings.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center text-yellow-700">
            No players found for this age group.
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 overflow-x-auto">
            <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
              <h2 className="text-xl font-semibold">Rankings ({selectedAgeGroup})</h2>
              <button
                onClick={handleExportCsv}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-700 text-sm"
                disabled={rankings.length === 0}
              >
                Export as CSV
              </button>
            </div>
            {/* Mobile-First Card Layout */}
            <div className="sm:hidden">
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
                  <div key={player.player_id} className="bg-gray-50 rounded-lg p-4 mb-3 border">
                    {/* Player Header */}
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`font-bold text-lg ${player.rank === 1 ? "text-yellow-500" : player.rank === 2 ? "text-gray-500" : player.rank === 3 ? "text-orange-500" : ""}`}>
                            {player.rank === 1 ? "🥇" : player.rank === 2 ? "🥈" : player.rank === 3 ? "🥉" : `#${player.rank}`}
                          </span>
                          <span className="font-semibold">{player.name}</span>
                        </div>
                        <div className="text-sm text-gray-600">Player #{player.number}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500">Overall Score</div>
                        <div className="font-mono font-bold text-lg text-cmf-primary">{player.composite_score.toFixed(2)}</div>
                      </div>
                    </div>
                    
                    {/* Drill Results Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {DRILLS.map(drill => (
                        <div key={drill.key} className="bg-white rounded p-2">
                          <div className="font-medium text-gray-700">{drill.label}</div>
                          {player[drill.key] != null ? (
                            <div>
                              <span className="font-mono">{player[drill.key]}</span>
                              <span className="text-gray-500 ml-1">#{drillRankings[drill.key] || '-'}</span>
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

            {/* Desktop Table Layout */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="py-3 px-2">Rank</th>
                    <th className="py-3 px-2">Name</th>
                    <th className="py-3 px-2">Player #</th>
                    <th className="py-3 px-2">Overall Score</th>
                                                <th className="py-3 px-2 text-center">40-Yard Dash</th>
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
        )}
      </div>
    </div>
  );
} 