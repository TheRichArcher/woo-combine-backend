import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL;

export default function JoinLeague() {
  const { user, addLeague } = useAuth();
  const navigate = useNavigate();
  const { code: urlCode } = useParams();
  const [joinCode, setJoinCode] = useState(urlCode || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [leagueName, setLeagueName] = useState('');

  useEffect(() => {
    if (urlCode) setJoinCode(urlCode);
  }, [urlCode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);
    try {
      const res = await fetch(`${API}/leagues/join/${joinCode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user?.uid,
          email: user?.email,
        }),
      });
      if (!res.ok) throw new Error('Failed to join league');
      const data = await res.json();
      setLeagueName(data.league_name);
      setSuccess(true);
      if (addLeague) addLeague({ id: joinCode, name: data.league_name, role: 'coach' });
    } catch (err) {
      setError(err.message || 'Error joining league');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-cmf-light">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md text-center">
        <h1 className="text-2xl font-bold mb-4">Join a League</h1>
        {!success ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              className="border rounded px-3 py-2 w-full"
              placeholder="Enter Join Code"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              required
            />
            <button
              type="submit"
              className="bg-cmf-primary text-white px-4 py-2 rounded w-full font-semibold"
              disabled={loading}
            >
              {loading ? 'Joining...' : 'Join League'}
            </button>
            {error && <div className="text-red-500 text-sm mt-2">{error}</div>}
          </form>
        ) : (
          <div>
            <div className="mb-4 text-green-600 font-semibold">Successfully joined league!</div>
            <div className="mb-2">Welcome to <span className="font-bold">{leagueName}</span></div>
            <button
              className="bg-cmf-primary text-white px-4 py-2 rounded font-semibold mt-4"
              onClick={() => navigate('/dashboard')}
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 