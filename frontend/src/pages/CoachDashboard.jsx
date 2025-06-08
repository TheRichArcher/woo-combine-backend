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
  { key: "40m_dash", label: "40M Dash" },
  { key: "vertical_jump", label: "Vertical Jump" },
  { key: "catching", label: "Catching" },
  { key: "throwing", label: "Throwing" },
  { key: "agility", label: "Agility" },
];

export default function CoachDashboard() {
  const { selectedEvent, noLeague, LeagueFallback } = useEvent();
  const { user, selectedLeagueId, userRole, leagues } = useAuth();
  const [selectedAgeGroup, setSelectedAgeGroup] = useState("");
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [players, setPlayers] = useState([]); // for age group list only
  const [weights, setWeights] = useState({ ...DRILL_WEIGHTS });
  const [weightError, setWeightError] = useState("");
  const navigate = useNavigate();

  // Fetch all players to get available age groups
  useEffect(() => {
    async function fetchPlayers() {
      if (!selectedEvent || !user || !selectedLeagueId) return;
      try {
        const { data } = await api.get(`/players?event_id=${selectedEvent.id}&league_id=${selectedLeagueId}`);
        setPlayers(data);
      } catch (error) {
        console.log('[CoachDashboard] Players API response:', error.response?.status, error.response?.data?.detail);
        if (error.response?.status === 404) {
          // 404 means no players found yet - normal for new events
          console.log('[CoachDashboard] No players found for event yet (normal for new events)');
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

  // Fetch rankings when age group changes (with default weights)
  useEffect(() => {
    if (!selectedAgeGroup || !user || !selectedLeagueId) {
      setRankings([]);
      return;
    }
    setLoading(true);
    setError(null);
    setWeights({ ...DRILL_WEIGHTS }); // Reset weights to default on age group change
    api.get(`/rankings?age_group=${encodeURIComponent(selectedAgeGroup)}&user_id=${user.uid}&league_id=${selectedLeagueId}`)
      .then(res => {
        setRankings(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.log('[CoachDashboard] Rankings API response:', err.response?.status, err.response?.data?.detail);
        if (err.response?.status === 404) {
          // 404 means no rankings found yet - normal for new events or age groups
          console.log('[CoachDashboard] No rankings found for age group yet (normal for new events)');
          setError(null); // Don't show as error, just empty state
          setRankings([]);
        } else {
          // Other errors are actual problems
          console.error('[CoachDashboard] Rankings fetch error:', err);
          setError(err.message);
        }
        setLoading(false);
      });
  }, [selectedAgeGroup, user, selectedLeagueId]);

  // Handle slider change
  const handleSlider = (key, value) => {
    setWeights(w => ({ ...w, [key]: value }));
  };

  // Reset to default weights
  const handleReset = () => {
    setWeights({ ...DRILL_WEIGHTS });
    setWeightError("");
  };

  // Validate weights and fetch rankings
  const handleUpdateRankings = () => {
    const vals = DRILLS.map(d => parseFloat(weights[d.key]));
    const sum = vals.reduce((a, b) => a + b, 0);
    if (vals.some(v => isNaN(v) || v < 0 || v > 1)) {
      setWeightError("All weights must be between 0 and 1.");
      return;
    }
    if (Math.abs(sum - 1.0) > 1e-6) {
      setWeightError("Weights must sum to 1.00");
      return;
    }
    setWeightError("");
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ age_group: selectedAgeGroup, league_id: selectedLeagueId });
    params.append("weight_40m_dash", weights["40m_dash"]);
    params.append("weight_vertical_jump", weights["vertical_jump"]);
    params.append("weight_catching", weights["catching"]);
    params.append("weight_throwing", weights["throwing"]);
    params.append("weight_agility", weights["agility"]);
    api.get(`/rankings?${params.toString()}`)
      .then(res => {
        setRankings(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.log('[CoachDashboard] Custom weights rankings API response:', err.response?.status, err.response?.data?.detail);
        if (err.response?.status === 404) {
          // 404 means no rankings found yet - normal for new events or age groups
          console.log('[CoachDashboard] No rankings found for custom weights yet (normal for new events)');
          setError(null); // Don't show as error, just empty state
          setRankings([]);
        } else {
          // Other errors are actual problems
          console.error('[CoachDashboard] Custom weights rankings fetch error:', err);
          setError(err.message);
        }
        setLoading(false);
      });
  };

  // CSV Export logic
  const handleExportCsv = () => {
    if (!selectedAgeGroup || rankings.length === 0) return;
    let csv = 'Rank,Name,Jersey Number,Composite Score\n';
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
          <div className="bg-white rounded-2xl shadow-lg p-8 max-w-lg mx-auto text-center border-2 border-cyan-200">
            <h2 className="text-2xl font-bold text-cyan-700 mb-4">Welcome to Woo-Combine!</h2>
            <p className="text-cyan-700 mb-2">It looks like you haven't created a league yet. That's totally normal for new organizers!</p>
            <p className="text-gray-700 mb-4">To get started, create your first league below:</p>
            <CreateLeagueForm onCreated={() => navigate('/onboarding/event')} />
          </div>
        </div>
      );
    }
    // If user has leagues, show Import Players for organizers
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] mt-20">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-lg mx-auto text-center border-2 border-cyan-200">
          <h2 className="text-2xl font-bold text-cyan-700 mb-4">Welcome to Woo-Combine!</h2>
          <p className="text-cyan-700 mb-2">It looks like you haven't added any players yet. That's totally normal for new leagues!</p>
          <p className="text-gray-700 mb-4">To get started, you can:</p>
          <div className="flex flex-col gap-3 items-center">
            {userRole === 'organizer' ? (
              <button onClick={handleImport} className="bg-cyan-700 text-white font-bold px-4 py-2 rounded shadow hover:bg-cyan-800 transition w-full max-w-xs">📥 Import Players</button>
            ) : (
              <span className="text-gray-500">Waiting for organizer to import players.</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (noLeague) return <LeagueFallback />;

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
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-cyan-600 focus:border-cyan-600 sm:text-sm"
          >
            <option value="">Select Age Group</option>
            {ageGroups.map(group => (
              <option key={group} value={group}>{group}</option>
            ))}
          </select>
        </div>
        {/* Drill Weight Controls */}
        {userRole === 'organizer' && (
          <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-5 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="w-4 h-4 text-cyan-600" />
              <h2 className="text-sm font-medium text-gray-800">Adjust Drill Weighting</h2>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {DRILLS.map(drill => (
                <div key={drill.key}>
                  <label className="block text-sm text-gray-700 mb-1">{drill.label}</label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={weights[drill.key]}
                    onChange={e => handleSlider(drill.key, parseFloat(e.target.value))}
                    className="w-full accent-cyan-600 h-2 rounded-lg bg-gray-100"
                  />
                  <span className="block text-right font-mono text-cyan-700 text-xs mt-1">{parseFloat(weights[drill.key]).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-4 justify-center mt-6">
              <button
                onClick={handleReset}
                className="rounded-full bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2 text-sm font-medium shadow-sm transition"
              >
                Reset to Default
              </button>
              <button
                onClick={handleUpdateRankings}
                className="rounded-full bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2 text-sm font-medium shadow-sm transition"
              >
                Update Rankings
              </button>
            </div>
            {weightError && <div className="text-red-500 mt-2 text-sm">{weightError}</div>}
          </div>
        )}
        {/* Rankings Table and Loading/Error States remain unchanged, but inside the new container */}
        {loading ? (
          <div>Loading rankings...</div>
        ) : error ? (
          <div className="text-red-500">Error: {error}</div>
        ) : selectedAgeGroup === "" ? (
          <div className="text-gray-500">Please select an age group to view rankings.</div>
        ) : rankings.length === 0 ? (
          <div>No players found for this age group.</div>
        ) : (
          <div className="bg-white rounded shadow p-6 overflow-x-auto">
            <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
              <h2 className="text-xl font-semibold">Rankings ({selectedAgeGroup})</h2>
              <button
                onClick={handleExportCsv}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-700"
                disabled={rankings.length === 0}
                style={{ display: rankings.length === 0 ? 'none' : 'inline-block' }}
              >
                Export Rankings as CSV
              </button>
            </div>
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="py-2 px-2">Rank</th>
                  <th className="py-2 px-2">Name</th>
                  <th className="py-2 px-2">Jersey #</th>
                  <th className="py-2 px-2">Score</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((player) => (
                  <tr key={player.player_id} className="border-t">
                    <td className={`py-2 px-2 font-bold ${player.rank === 1 ? "text-yellow-500" : player.rank === 2 ? "text-gray-500" : player.rank === 3 ? "text-orange-500" : ""}`}>
                      {player.rank === 1 ? "🥇" : player.rank === 2 ? "🥈" : player.rank === 3 ? "🥉" : player.rank}
                    </td>
                    <td className="py-2 px-2">{player.name}</td>
                    <td className="py-2 px-2">{player.number}</td>
                    <td className="py-2 px-2 font-mono">{player.composite_score.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
} 