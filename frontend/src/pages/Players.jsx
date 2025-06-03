import React, { useEffect, useState } from "react";
import DrillInputForm from "../components/DrillInputForm";
import { useEvent } from "../context/EventContext";
import { useAuth } from "../context/AuthContext";
import EventSelector from "../components/EventSelector";
import api from '../lib/api';

export default function Players() {
  const { selectedEvent } = useEvent();
  const { user, selectedLeagueId, userRole } = useAuth();
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
    if (!selectedEvent || !user || !selectedLeagueId) {
      console.log('[Players] No event/user/league selected, skipping player fetch.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/players?event_id=${selectedEvent.id}&league_id=${selectedLeagueId}`);
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
          <a href="#player-upload-section" className="bg-cmf-primary text-white font-bold px-4 py-2 rounded shadow hover:bg-cmf-secondary transition">Upload CSV</a>
          <a href="#player-upload-section" className="bg-cmf-secondary text-white font-bold px-4 py-2 rounded shadow hover:bg-cmf-primary transition">Add Player</a>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto py-8">
      <EventSelector />
      <div className="mb-4 text-lg font-semibold flex items-center gap-2">
        <span role="img" aria-label="event">🏷️</span>
        Managing: {selectedEvent.name} – {selectedEvent.date && !isNaN(Date.parse(selectedEvent.date)) ? new Date(selectedEvent.date).toLocaleDateString() : "Invalid Date"}
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
                          {userRole === 'organizer' && (
                            <button
                              onClick={() => toggleForm(player.id)}
                              className="text-cmf-primary underline text-sm font-bold hover:text-cmf-secondary transition"
                            >
                              {expandedPlayerIds[player.id] ? "Hide Form" : "Add Result"}
                            </button>
                          )}
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
  );
} 