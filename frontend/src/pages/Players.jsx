import React, { useEffect, useState } from "react";
import DrillInputForm from "../components/DrillInputForm";
import { useEvent } from "../context/EventContext";

const API = import.meta.env.VITE_API_URL;

export default function Players() {
  const { selectedEvent } = useEvent();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedPlayerIds, setExpandedPlayerIds] = useState({});

  // Onboarding callout
  const OnboardingCallout = () => (
    <div className="bg-cmf-primary/10 border-l-4 border-cmf-primary text-cmf-primary px-4 py-3 mb-6 rounded">
      <strong>Tip:</strong> Select an event to manage players and record results.
    </div>
  );

  const fetchPlayers = async () => {
    if (!selectedEvent) {
      console.log('[Players] No event selected, skipping player fetch.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/players?event_id=${selectedEvent.id}`);
      if (!res.ok) throw new Error("Failed to fetch players");
      const data = await res.json();
      setPlayers(data);
    } catch (err) {
      setError(err.message);
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

  if (!selectedEvent) return (
    <div className="flex flex-col items-center justify-center min-h-[40vh]">
      <OnboardingCallout />
      <div className="text-center text-cmf-secondary text-xl font-semibold py-8">No event selected.<br/>Please choose an event to view players.</div>
    </div>
  );
  if (loading) return <div>Loading players...</div>;
  if (error) return <div className="text-red-500">Error: {error}</div>;
  if (players.length === 0) return <div>No players found.</div>;

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="mb-4 text-lg font-semibold flex items-center gap-2">
        <span role="img" aria-label="event">🏷️</span>
        Managing: {selectedEvent.name} – {new Date(selectedEvent.date).toLocaleDateString()}
      </div>
      <h1 className="text-3xl font-extrabold mb-6 text-center text-cmf-primary drop-shadow">Woo-Combine: Players</h1>
      {Object.keys(grouped).sort().map(ageGroup => {
        const sortedPlayers = grouped[ageGroup].slice().sort((a, b) => b.composite_score - a.composite_score);
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
                    <th className="py-2 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPlayers.map((player, index) => (
                    <React.Fragment key={player.id}>
                      <tr className="border-t">
                        <td className={`py-2 px-2 font-bold ${index === 0 ? "text-yellow-500" : index === 1 ? "text-gray-500" : index === 2 ? "text-orange-500" : ""}`}>
                          {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1}
                        </td>
                        <td className="py-2 px-2">{player.name}</td>
                        <td className="py-2 px-2">{player.number}</td>
                        <td className="py-2 px-2 font-mono">{player.composite_score.toFixed(2)}</td>
                        <td className="py-2 px-2">
                          <button
                            onClick={() => toggleForm(player.id)}
                            className="text-cmf-primary underline text-sm font-bold hover:text-cmf-secondary transition"
                          >
                            {expandedPlayerIds[player.id] ? "Hide Form" : "Add Result"}
                          </button>
                        </td>
                      </tr>
                      {expandedPlayerIds[player.id] && (
                        <tr>
                          <td colSpan={5} className="bg-cmf-light">
                            <DrillInputForm
                              playerId={player.id}
                              onSuccess={fetchPlayers}
                            />
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
  );
} 