import React, { useEffect, useState } from "react";
import WelcomeLayout from "../components/layouts/WelcomeLayout";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import api from '../lib/api';

export default function SelectLeague() {
  const { user, selectedLeagueId, setSelectedLeagueId } = useAuth();
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      console.error('[SelectLeague] No user found in context.');
      setFetchError('No user found. Please log in again.');
      return;
    }
    console.log('[SelectLeague] Fetching leagues for user:', user.uid);
    (async () => {
      try {
        const res = await api.get(`/leagues/me`);
        setLeagues(res.data.leagues || []);
        if (!res.data.leagues || res.data.leagues.length === 0) {
          setFetchError('No leagues linked to this account. Try creating a new one.');
        } else {
          setFetchError(null);
        }
      } catch (err) {
        console.error('[SelectLeague] Fetch error:', err.message, err.stack, err.response?.data);
        setLeagues([]);
        setFetchError('Could not fetch leagues. Please try again later.');
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const handleSelect = (league) => {
    localStorage.setItem('selectedLeagueId', league.id);
    setSelectedLeagueId(league.id);
    navigate('/dashboard');
  };

  return (
    <WelcomeLayout hideHeader={true} showOverlay={false} contentClassName="min-h-[70vh]">
      <div className="w-full max-w-lg mx-auto bg-white rounded-2xl shadow-2xl p-4 sm:p-8 flex flex-col items-center relative">
        <h2 className="text-2xl font-extrabold text-center text-cyan-700 mb-6">Select Team</h2>
        {loading ? (
          <div>Loading...</div>
        ) : fetchError ? (
          <div className="text-center text-cyan-700 font-semibold mb-8">{fetchError}</div>
        ) : leagues.length === 0 ? (
          <div className="text-center text-cyan-700 font-semibold mb-8">No teams found. Create or join a team below.</div>
        ) : (
          <div className="w-full flex flex-col gap-4 mb-24">
            {leagues.map(league => (
              <div
                key={league.id}
                className={`rounded-2xl p-5 flex flex-col relative shadow-lg cursor-pointer border-2 ${selectedLeagueId === league.id ? 'border-cyan-500' : 'border-transparent'} bg-gradient-to-br from-pink-500 to-fuchsia-500`}
                onClick={() => handleSelect(league)}
              >
                <div className="flex flex-row justify-between items-center mb-2">
                  <span className="bg-white/80 text-cyan-700 font-mono text-xs px-3 py-1 rounded-full border border-cyan-200">Team Code<br/>{league.code || league.id}</span>
                  {selectedLeagueId === league.id && (
                    <span className="ml-2 text-green-600 text-xl font-bold">&#10003;</span>
                  )}
                </div>
                <div className="text-white text-xl font-bold mb-1">{league.name}</div>
                <div className="text-white/90 text-base font-semibold">{league.season || league.event || ''}</div>
              </div>
            ))}
          </div>
        )}
        {/* Fixed bottom buttons */}
        <div className="fixed left-0 right-0 bottom-0 flex flex-col gap-3 items-center bg-white py-4 z-10 border-t border-gray-200">
          <button
            className="w-11/12 max-w-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg py-3 rounded-full shadow mb-1"
            onClick={() => navigate('/create-league')}
          >
            Create a Team
          </button>
          <button
            className="w-11/12 max-w-lg border-2 border-blue-600 text-blue-700 font-bold text-lg py-3 rounded-full shadow"
            onClick={() => navigate('/join-league')}
          >
            Join a Team
          </button>
        </div>
      </div>
    </WelcomeLayout>
  );
} 