import React, { useEffect, useState } from "react";
import DrillInputForm from "../components/DrillInputForm";
import { useEvent } from "../context/EventContext";
import { useAuth } from "../context/AuthContext";
import EventSelector from "../components/EventSelector";
import api from '../lib/api';
import { X, TrendingUp, Award, Edit } from 'lucide-react';

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

// Player Details Modal Component
function PlayerDetailsModal({ player, allPlayers, onClose }) {
  if (!player) return null;

  // Calculate individual drill rankings
  const drillRankings = {};
  DRILLS.forEach(drill => {
    const drillRanks = allPlayers
      .filter(p => p[drill.key] != null && p.age_group === player.age_group)
      .map(p => ({ player_id: p.id, score: p[drill.key] }))
      .sort((a, b) => b.score - a.score);
    const rank = drillRanks.findIndex(p => p.player_id === player.id) + 1;
    drillRankings[drill.key] = rank > 0 ? rank : null;
  });

  // Calculate weighted score breakdown
  const weightedBreakdown = DRILLS.map(drill => {
    const rawScore = player[drill.key] || 0;
    const weight = DRILL_WEIGHTS[drill.key];
    const weightedScore = rawScore * weight;
    return {
      ...drill,
      rawScore,
      weight,
      weightedScore,
      rank: drillRankings[drill.key]
    };
  });

  const totalWeightedScore = weightedBreakdown.reduce((sum, item) => sum + item.weightedScore, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-cmf-primary text-white p-6 rounded-t-xl flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">{player.name}</h2>
            <p className="text-cmf-light">Player #{player.number} • Age Group: {player.age_group}</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Overall Score */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-4 mb-4">
            <Award className="w-8 h-8 text-yellow-500" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Overall Ranking</h3>
              <p className="text-2xl font-bold text-cmf-primary">
                {player.composite_score ? player.composite_score.toFixed(2) : 'N/A'} points
              </p>
            </div>
          </div>
          
          {/* Age Group Rank */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Age Group Rank:</span>
              <span className="text-lg font-bold text-cmf-secondary">
                #{allPlayers
                  .filter(p => p.age_group === player.age_group && p.composite_score != null)
                  .sort((a, b) => (b.composite_score || 0) - (a.composite_score || 0))
                  .findIndex(p => p.id === player.id) + 1} 
                of {allPlayers.filter(p => p.age_group === player.age_group).length}
              </span>
            </div>
          </div>
        </div>

        {/* Individual Drill Results */}
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-cmf-primary" />
            <h3 className="text-lg font-semibold text-gray-900">Drill Performance</h3>
          </div>
          
          <div className="space-y-4">
            {weightedBreakdown.map(drill => (
              <div key={drill.key} className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-semibold text-gray-900">{drill.label}</h4>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-lg font-bold text-cmf-primary">
                        {drill.rawScore || 'No score'} {drill.rawScore && drill.unit}
                      </span>
                      {drill.rank && (
                        <span className="bg-cmf-primary text-white px-2 py-1 rounded-full text-xs font-medium">
                          Rank #{drill.rank}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Weight and Contribution */}
                <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                  <div>
                    <span className="text-gray-600">Weight: </span>
                    <span className="font-medium">{(drill.weight * 100).toFixed(0)}%</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Contribution: </span>
                    <span className="font-medium">{drill.weightedScore.toFixed(2)} pts</span>
                  </div>
                </div>
                
                {/* Visual Progress Bar */}
                <div className="mt-3">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-cmf-primary h-2 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${Math.min((drill.weightedScore / Math.max(...weightedBreakdown.map(d => d.weightedScore))) * 100, 100)}%` 
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Total Calculation */}
          <div className="mt-6 p-4 bg-cmf-primary/10 rounded-lg border-2 border-cmf-primary/20">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-900">Total Composite Score:</span>
              <span className="text-xl font-bold text-cmf-primary">
                {totalWeightedScore.toFixed(2)} pts
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              Calculated using current drill weights
            </p>
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

  // Onboarding callout
  const OnboardingCallout = () => (
    <div className="bg-cmf-primary/10 border-l-4 border-cmf-primary text-cmf-primary px-4 py-3 mb-6 rounded">
      <strong>Tip:</strong> Select an event to manage players and record results.
    </div>
  );

  const fetchPlayers = async () => {
    if (!selectedEvent || !user || !selectedLeagueId) {
      console.log('[Players] No event/user/league selected, skipping player fetch.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/players?event_id=${selectedEvent.id}`);
      setPlayers(data);
    } catch (err) {
      console.log('[Players] API response:', err.response?.status, err.response?.data?.detail);
      if (err.response?.status === 404) {
        // 404 means no players found yet - normal for new events
        console.log('[Players] No players found for event yet (normal for new events)');
        setError(null); // Don't show as error, just empty state
        setPlayers([]);
      } else {
        // Other errors are actual problems
        console.error('[Players] Fetch error:', err);
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
    // eslint-disable-next-line
  }, [selectedEvent]);

  const toggleForm = (id) => {
    setExpandedPlayerIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Group players by age_group
  const grouped = players.reduce((acc, player) => {
    acc[player.age_group] = acc[player.age_group] || [];
    acc[player.age_group].push(player);
    return acc;
  }, {});

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
              <a href="/admin" className="bg-cmf-primary text-white font-bold px-4 py-2 rounded shadow hover:bg-cmf-secondary transition">Go to Admin</a>
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
            <a href="/admin#player-upload-section" className="bg-cmf-primary text-white font-bold px-4 py-2 rounded shadow hover:bg-cmf-secondary transition">Upload CSV</a>
            <a href="/admin#player-upload-section" className="bg-cmf-secondary text-white font-bold px-4 py-2 rounded shadow hover:bg-cmf-primary transition">Add Player</a>
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
        <div className="text-xs uppercase font-bold text-gray-500 tracking-wide mb-1">WooCombine: Players</div>
        <h1 className="text-lg font-semibold text-gray-900 mb-4">
          Managing: {selectedEvent.name} – {new Date(selectedEvent.event_date).toLocaleDateString()}
        </h1>

                 {/* Player Stats Modals */}
         {selectedPlayer && (
           <PlayerStatsModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
         )}
         {editingPlayer && (
           <EditPlayerModal
             player={editingPlayer}
             onClose={() => setEditingPlayer(null)}
             onUpdate={fetchPlayers}
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
                  <div className="overflow-hidden rounded-lg border border-gray-200">
                    <table className="min-w-full bg-white">
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
                                   <DrillEntryForm player={player} onSuccess={() => { toggleForm(player.id); fetchPlayers(); }} />
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