import React, { useEffect, useState } from "react";
import { useEvent } from "../context/EventContext";

const DRILLS = [
  { key: "40m_dash", label: "40M Dash" },
  { key: "vertical_jump", label: "Vertical Jump" },
  { key: "catching", label: "Catching" },
  { key: "throwing", label: "Throwing" },
  { key: "agility", label: "Agility" },
];

export default function CoachDashboard() {
  const { selectedEvent } = useEvent();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [weights, setWeights] = useState({
    "40m_dash": 0.3,
    "vertical_jump": 0.2,
    "catching": 0.15,
    "throwing": 0.15,
    "agility": 0.2,
  });
  const [selectedAgeGroup, setSelectedAgeGroup] = useState("");

  useEffect(() => {
    async function fetchPlayers() {
      if (!selectedEvent) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/players?event_id=${selectedEvent.id}`);
        if (!res.ok) throw new Error("Failed to fetch players");
        const data = await res.json();
        setPlayers(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchPlayers();
  }, [selectedEvent]);

  // Get unique age groups from players
  const ageGroups = [...new Set(players.map(p => p.age_group))].sort();

  // Filter players by selected age group
  const filteredPlayers = players.filter(p => p.age_group === selectedAgeGroup);

  // Recalculate composite score for each player using current weights
  const rankedPlayers = filteredPlayers.map(player => {
    let score = 0;
    for (const drill of DRILLS) {
      const value = player[drill.key] ?? 0;
      score += value * weights[drill.key];
    }
    return { ...player, recalculated_score: score };
  }).sort((a, b) => b.recalculated_score - a.recalculated_score);

  const handleSlider = (key, value) => {
    setWeights(w => ({ ...w, [key]: value / 100 }));
  };

  // CSV Export logic
  const handleExportCsv = () => {
    if (!selectedAgeGroup || rankedPlayers.length === 0) return;
    let csv = "Rank,Name,Jersey #,Score\n";
    rankedPlayers.forEach((player, idx) => {
      csv += `${idx + 1},"${player.name}",${player.number},${player.recalculated_score.toFixed(2)}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rankings-${selectedAgeGroup}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-3xl mx-auto py-8">
      <div className="mb-4 text-lg font-semibold flex items-center gap-2">
        <span role="img" aria-label="event">🏷️</span>
        Managing: {selectedEvent?.name} – {selectedEvent ? new Date(selectedEvent.date).toLocaleDateString() : ""}
      </div>
      <h1 className="text-3xl font-bold mb-6 text-center">Coach Dashboard</h1>
      <div className="bg-white rounded shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Adjust Drill Weights</h2>
        {DRILLS.map(drill => (
          <div key={drill.key} className="mb-4 flex items-center">
            <label className="w-40 font-medium">{drill.label}</label>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(weights[drill.key] * 100)}
              onChange={e => handleSlider(drill.key, Number(e.target.value))}
              className="mx-4 flex-1"
            />
            <span className="w-12 text-right">{Math.round(weights[drill.key] * 100)}%</span>
          </div>
        ))}
      </div>
      <div className="bg-white rounded shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Select Age Group</h2>
        <select
          value={selectedAgeGroup}
          onChange={e => setSelectedAgeGroup(e.target.value)}
          className="border rounded px-3 py-2 w-full max-w-xs"
        >
          <option value="">Select Age Group</option>
          {ageGroups.map(group => (
            <option key={group} value={group}>{group}</option>
          ))}
        </select>
      </div>
      {loading ? (
        <div>Loading players...</div>
      ) : error ? (
        <div className="text-red-500">Error: {error}</div>
      ) : selectedAgeGroup === "" ? (
        <div className="text-gray-500">Please select an age group to view rankings.</div>
      ) : rankedPlayers.length === 0 ? (
        <div>No players found for this age group.</div>
      ) : (
        <div className="bg-white rounded shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Rankings ({selectedAgeGroup})</h2>
            <button
              onClick={handleExportCsv}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              Export CSV
            </button>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="py-2 px-2">Rank</th>
                <th className="py-2 px-2">Name</th>
                <th className="py-2 px-2">Jersey #</th>
                <th className="py-2 px-2">Score</th>
              </tr>
            </thead>
            <tbody>
              {rankedPlayers.map((player, index) => (
                <tr key={player.id} className="border-t">
                  <td className={`py-2 px-2 font-bold ${index === 0 ? "text-yellow-500" : index === 1 ? "text-gray-500" : index === 2 ? "text-orange-500" : ""}`}>
                    {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1}
                  </td>
                  <td className="py-2 px-2">{player.name}</td>
                  <td className="py-2 px-2">{player.number}</td>
                  <td className="py-2 px-2 font-mono">{player.recalculated_score.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
} 