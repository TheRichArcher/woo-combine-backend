import React, { useEffect, useState } from "react";
import { useEvent } from "../context/EventContext";

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
  const { selectedEvent } = useEvent();
  const [selectedAgeGroup, setSelectedAgeGroup] = useState("");
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [players, setPlayers] = useState([]); // for age group list only
  const [weights, setWeights] = useState({ ...DRILL_WEIGHTS });
  const [weightError, setWeightError] = useState("");

  // Fetch all players to get available age groups
  useEffect(() => {
    async function fetchPlayers() {
      if (!selectedEvent) return;
      try {
        const res = await fetch(`/players?event_id=${selectedEvent.id}`);
        if (!res.ok) throw new Error("Failed to fetch players");
        const data = await res.json();
        setPlayers(data);
      } catch (err) {
        setPlayers([]);
      }
    }
    fetchPlayers();
  }, [selectedEvent]);

  // Get unique age groups from players
  const ageGroups = [...new Set(players.map(p => p.age_group))].sort();

  // Fetch rankings when age group changes (with default weights)
  useEffect(() => {
    if (!selectedAgeGroup) {
      setRankings([]);
      return;
    }
    setLoading(true);
    setError(null);
    setWeights({ ...DRILL_WEIGHTS }); // Reset weights to default on age group change
    fetch(`/rankings?age_group=${encodeURIComponent(selectedAgeGroup)}`)
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch rankings");
        return res.json();
      })
      .then(data => {
        setRankings(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setRankings([]);
        setLoading(false);
      });
  }, [selectedAgeGroup]);

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
    const params = new URLSearchParams({ age_group: selectedAgeGroup });
    params.append("weight_40m_dash", weights["40m_dash"]);
    params.append("weight_vertical_jump", weights["vertical_jump"]);
    params.append("weight_catching", weights["catching"]);
    params.append("weight_throwing", weights["throwing"]);
    params.append("weight_agility", weights["agility"]);
    fetch(`/rankings?${params.toString()}`)
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch rankings");
        return res.json();
      })
      .then(data => {
        setRankings(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setRankings([]);
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

  return (
    <div className="min-h-screen bg-cmf-light text-cmf-contrast font-sans">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 container space-y-6">
        {/* PHASE 3 TAILWIND TEST BANNER */}
        <div className="bg-cmf-primary/10 text-center text-xl p-4 rounded font-bold mb-6 text-cmf-primary">
          🏗️ Woo-Combine UI Build: Phase 3 (Tailwind Styling In Progress)
        </div>
        {/* Header & Title Block */}
        <header className="space-y-1 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-cmf-primary drop-shadow">Woo Combine: Coach Dashboard</h1>
          <p className="text-base text-cmf-secondary">
            {selectedEvent ? `${selectedEvent.name} – ${new Date(selectedEvent.date).toLocaleDateString()}` : "No event selected"}
          </p>
        </header>
        {/* Age Group Dropdown */}
        <section className="bg-white rounded-xl shadow-lg p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div>
              <label className="block text-sm font-bold text-cmf-contrast mb-1">Select Age Group</label>
              <select
                value={selectedAgeGroup}
                onChange={e => setSelectedAgeGroup(e.target.value)}
                className="mt-1 block w-full rounded-md border-cmf-secondary shadow-sm focus:ring-cmf-primary focus:border-cmf-primary sm:text-sm"
              >
                <option value="">Select Age Group</option>
                {ageGroups.map(group => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </div>
            {/* Placeholder for future filters */}
            <div></div>
          </div>
        </section>
        {/* Drill Weight Controls */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4 text-cmf-secondary">Adjust Drill Weighting</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {DRILLS.map(drill => (
              <div key={drill.key} className="flex items-center gap-4">
                <label className="w-40 font-semibold text-cmf-contrast">{drill.label}</label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={weights[drill.key]}
                  onChange={e => handleSlider(drill.key, parseFloat(e.target.value))}
                  className="flex-1 accent-cmf-primary h-2 rounded-lg bg-cmf-secondary/20"
                />
                <span className="w-12 text-right font-mono text-cmf-primary">{parseFloat(weights[drill.key]).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-4 mt-6">
            <button
              onClick={handleReset}
              className="bg-cmf-secondary text-white font-bold px-4 py-2 rounded-lg shadow hover:bg-cmf-primary focus:outline-none focus:ring-2 focus:ring-cmf-primary transition"
            >
              Reset to Default
            </button>
            <button
              onClick={handleUpdateRankings}
              className="bg-cmf-primary text-white font-bold px-4 py-2 rounded-lg shadow hover:bg-cmf-secondary focus:outline-none focus:ring-2 focus:ring-cmf-secondary transition"
            >
              Update Rankings
            </button>
          </div>
          {weightError && <div className="text-red-500 mt-2">{weightError}</div>}
        </div>
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