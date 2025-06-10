import React, { useEffect, useState } from "react";
import DrillInputForm from "../components/DrillInputForm";
import { useEvent } from "../context/EventContext";
import { useAuth } from "../context/AuthContext";
import EventSelector from "../components/EventSelector";
import api from '../lib/api';
import { X, TrendingUp, Award } from 'lucide-react';

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
            <p className="text-cmf-light">Jersey #{player.number} • Age Group: {player.age_group}</p>
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
  );
  if (loading) return <div>Loading players...</div>;
  if (error) {
    if (error.includes('422')) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[40vh]">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-lg mx-auto text-center border-2 border-cmf-primary/30">
            <h2 className="text-2xl font-bold text-cmf-primary mb-4">No players found</h2>
            <p className="text-cmf-secondary mb-4">Use the Admin tab to upload or import players to get started.</p>
            <a href="/admin" className="bg-cmf-primary text-white font-bold px-4 py-2 rounded shadow hover:bg-cmf-secondary transition">Go to Admin</a>
          </div>
        </div>
      );
    }
    return <div className="text-red-500">Error: {error}</div>;
  }
  if (players.length === 0) return (
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
  );

  return (
    <>
      <div className="max-w-2xl mx-auto py-8">
        <EventSelector />
        <div className="mb-4 text-lg font-semibold flex items-center gap-2">
          <span role="img" aria-label="event">🏷️</span>
          Managing: {selectedEvent.name} – {selectedEvent.date && !isNaN(Date.parse(selectedEvent.date)) ? new Date(selectedEvent.date).toLocaleDateString() : "Invalid Date"}
        </div>
        <h1 className="text-3xl font-extrabold mb-6 text-center text-cmf-primary drop-shadow">Woo-Combine: Players</h1>
        {Object.keys(grouped).sort().map(ageGroup => {
          const sortedPlayers = grouped[ageGroup].slice().sort((a, b) => {
            // Handle null composite scores - put null values at the end
            const scoreA = a.composite_score || 0;
            const scoreB = b.composite_score || 0;
            return scoreB - scoreA;
          });
          return (
            <div key={ageGroup} className="mb-8">
              <h2 className="text-xl font-bold mb-2 text-cmf-secondary">Age Group: {ageGroup}</h2>
              <div className="bg-white rounded-xl shadow-lg p-4">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th className="py-2 px-2">Rank</th>
                      <th className="py-2 px-2">Name</th>
                      <th className="py-2 px-2">Jersey #</th>
                      <th className="py-2 px-2">Composite Score</th>
                      <th className="py-2 px-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPlayers.map((player, index) => (
                      <React.Fragment key={player.id}>
                        <tr className="border-t hover:bg-gray-50">
                          <td className={`py-2 px-2 font-bold ${index === 0 ? "text-yellow-500" : index === 1 ? "text-gray-500" : index === 2 ? "text-orange-500" : ""}`}>
                            {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1}
                          </td>
                          <td className="py-2 px-2">{player.name}</td>
                          <td className="py-2 px-2">{player.number}</td>
                          <td className="py-2 px-2 font-mono">
                            {player.composite_score != null ? player.composite_score.toFixed(2) : "No scores yet"}
                          </td>
                          <td className="py-2 px-2">
                            <div className="flex gap-2">
                              <button
                                onClick={() => setSelectedPlayer(player)}
                                className="text-blue-600 underline text-sm font-bold hover:text-blue-800 transition"
                                disabled={!player.composite_score}
                              >
                                View Stats
                              </button>
                              {userRole === 'organizer' && (
                                <button
                                  onClick={() => toggleForm(player.id)}
                                  className="text-cmf-primary underline text-sm font-bold hover:text-cmf-secondary transition"
                                >
                                  {expandedPlayerIds[player.id] ? "Hide Form" : "Add Result"}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {expandedPlayerIds[player.id] && (
                          <tr>
                            <td colSpan={5} className="bg-cmf-light">
                              {userRole === 'organizer' && (
                                <DrillInputForm
                                  playerId={player.id}
                                  onSuccess={fetchPlayers}
                                />
                              )}
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
        })}
      </div>

      {/* Player Details Modal */}
      {selectedPlayer && (
        <PlayerDetailsModal 
          player={selectedPlayer} 
          allPlayers={players}
          onClose={() => setSelectedPlayer(null)} 
        />
      )}
    </>
  );
} 