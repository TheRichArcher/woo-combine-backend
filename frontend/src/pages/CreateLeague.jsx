import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import QRCode from 'qrcode.react';

export default function CreateLeague() {
  const { user } = useAuth();
  const [leagueName, setLeagueName] = useState('');
  const [joinCode, setJoinCode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setJoinCode(null);
    try {
      const res = await fetch('/leagues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: leagueName,
          user_id: user?.uid,
          email: user?.email,
        }),
      });
      if (!res.ok) throw new Error('Failed to create league');
      const data = await res.json();
      setJoinCode(data.join_code);
    } catch (err) {
      setError(err.message || 'Error creating league');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-cmf-light">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md text-center">
        <h1 className="text-2xl font-bold mb-4">Create a New League</h1>
        {!joinCode ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              className="border rounded px-3 py-2 w-full"
              placeholder="League Name"
              value={leagueName}
              onChange={e => setLeagueName(e.target.value)}
              required
            />
            <button
              type="submit"
              className="bg-cmf-primary text-white px-4 py-2 rounded w-full font-semibold"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create League'}
            </button>
            {error && <div className="text-red-500 text-sm mt-2">{error}</div>}
          </form>
        ) : (
          <div>
            <div className="mb-4">
              <div className="font-semibold">League Join Code:</div>
              <div className="text-2xl font-mono bg-gray-100 rounded p-2 inline-block mt-1">{joinCode}</div>
            </div>
            <div className="mb-4">
              <QRCode value={`https://woo-combine.com/join/${joinCode}`} size={180} />
              <div className="text-xs mt-2">Scan to join: <br />https://woo-combine.com/join/{joinCode}</div>
            </div>
            <div className="text-green-600 font-semibold">Share this code or QR with coaches to join your league!</div>
          </div>
        )}
      </div>
    </div>
  );
} 