import React, { useEffect, useState } from "react";
import WelcomeLayout from "../components/layouts/WelcomeLayout";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import api from '../lib/api';
import { MoreVertical } from 'lucide-react';

export default function SelectLeague() {
  const { user, selectedLeagueId, setSelectedLeagueId } = useAuth();
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const navigate = useNavigate();
  const [menuLeagueId, setMenuLeagueId] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [detailsLeague, setDetailsLeague] = useState(null);

  useEffect(() => {
    if (!user) {
      console.error('[SelectLeague] No user found in context.');
      setFetchError('No user found. Please log in again.');
      return;
    }
    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await api.get('/leagues/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setLeagues(res.data.leagues || []);
        if (!res.data.leagues || res.data.leagues.length === 0) {
          setFetchError('No leagues linked to this account. Try creating a new one.');
        } else {
          setFetchError(null);
        }
      } catch (err) {
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

  const handleMenu = (league, e) => {
    e.stopPropagation();
    setMenuLeagueId(league.id);
  };
  const handleCloseMenu = () => setMenuLeagueId(null);
  const handleRename = (league) => {/* TODO: Implement rename logic */ handleCloseMenu(); };
  const handleDelete = (league) => {/* TODO: Implement delete logic */ handleCloseMenu(); };
  const handleViewDetails = (league) => { setDetailsLeague(league); setShowDetails(true); handleCloseMenu(); };
  const handleCloseDetails = () => setShowDetails(false);

  return (
    <WelcomeLayout hideHeader={true} showOverlay={false} contentClassName="min-h-[70vh]">
      <div className="w-full max-w-lg mx-auto bg-white rounded-2xl shadow-2xl p-4 sm:p-8 flex flex-col items-center relative">
        <h2 className="text-2xl font-extrabold text-center text-cyan-700 mb-6">Select League</h2>
        {loading ? (
          <div>Loading...</div>
        ) : fetchError ? (
          <div className="text-center text-cyan-700 font-semibold mb-8">{fetchError}</div>
        ) : leagues.length === 0 ? (
          <div className="text-center text-cyan-700 font-semibold mb-8">No leagues found. Create or join a league below.</div>
        ) : (
          <div className="w-full flex flex-col gap-4 mb-24 max-h-[50vh] overflow-y-auto pr-2">
            {leagues.map(league => (
              <div
                key={league.id}
                className={`rounded-2xl p-5 flex flex-col relative shadow-lg cursor-pointer border-2 transition-all duration-150 ${selectedLeagueId === league.id ? 'border-cyan-600 bg-cyan-50' : 'border-gray-200 bg-white'} group`}
                onClick={() => handleSelect(league)}
              >
                {/* Subtle background icon */}
                <div className="absolute right-4 top-4">
                  {selectedLeagueId === league.id && (
                    <span className="text-green-600 text-2xl font-bold">✅</span>
                  )}
                  {/* Bell badge placeholder */}
                  {league.hasPending && (
                    <span className="ml-2 text-yellow-500 text-xl">🔔</span>
                  )}
                  <button className="ml-2 p-1 rounded-full hover:bg-gray-100" onClick={e => handleMenu(league, e)}>
                    <MoreVertical size={20} />
                  </button>
                  {menuLeagueId === league.id && (
                    <div className="absolute right-0 mt-2 w-40 bg-white border rounded shadow-lg z-20">
                      <button className="block w-full text-left px-4 py-2 hover:bg-gray-100" onClick={() => handleRename(league)}>Rename</button>
                      <button className="block w-full text-left px-4 py-2 hover:bg-gray-100" onClick={() => handleDelete(league)}>Delete</button>
                      <button className="block w-full text-left px-4 py-2 hover:bg-gray-100" onClick={() => handleViewDetails(league)}>View Details</button>
                      <button className="block w-full text-left px-4 py-2 text-gray-400 hover:bg-gray-50" onClick={handleCloseMenu}>Cancel</button>
                    </div>
                  )}
                </div>
                <div className="text-cyan-700 text-xl font-bold mb-1">{league.name}</div>
                <div className="text-cyan-600 text-base font-semibold mb-1">{league.season || ''}</div>
                <div className="bg-cyan-100 text-cyan-700 font-mono text-xs px-3 py-1 rounded-full border border-cyan-200 inline-block w-fit">League Code: {league.code || league.id}</div>
              </div>
            ))}
          </div>
        )}
        {/* Fixed bottom buttons */}
        <div className="fixed left-0 right-0 bottom-0 flex flex-col gap-3 items-center bg-white py-4 z-10 border-t border-gray-200">
          <button
            className="w-11/12 max-w-lg bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-lg py-3 rounded-full shadow mb-1"
            onClick={() => navigate('/create-league')}
          >
            Create a League
          </button>
          <button
            className="w-11/12 max-w-lg border-2 border-cyan-700 text-cyan-700 font-bold text-lg py-3 rounded-full shadow"
            onClick={() => navigate('/join-league')}
          >
            Join a League
          </button>
        </div>
        {/* Details Modal */}
        {showDetails && detailsLeague && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
            <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-sm relative">
              <button onClick={handleCloseDetails} className="absolute top-2 right-2 text-gray-400 hover:text-cyan-700 text-2xl font-bold">×</button>
              <h3 className="text-xl font-bold mb-2 text-cyan-700">League Details</h3>
              <div className="mb-2"><span className="font-semibold">Name:</span> {detailsLeague.name}</div>
              <div className="mb-2"><span className="font-semibold">Season:</span> {detailsLeague.season || ''}</div>
              <div className="mb-2"><span className="font-semibold">Code:</span> {detailsLeague.code || detailsLeague.id}</div>
              {/* Add more details as needed */}
              <button className="mt-4 bg-cyan-700 text-white rounded-full px-5 py-2 text-sm font-medium shadow-sm hover:bg-cyan-800 transition w-full" onClick={handleCloseDetails}>Close</button>
            </div>
          </div>
        )}
      </div>
    </WelcomeLayout>
  );
} 