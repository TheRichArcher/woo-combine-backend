import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

export function CreateLeagueForm({ onCreated }) {
  const { user, addLeague } = useAuth();
  const navigate = useNavigate();
  const [leagueName, setLeagueName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/leagues', {
        name: leagueName,
        user_id: user?.uid,
        email: user?.email,
      });
      
      if (addLeague) {
        addLeague({ id: data.league_id, name: leagueName, role: 'organizer' });
      }
      if (onCreated) onCreated(data.league_id);
      
      // Redirect to event creation/selection page
      navigate('/onboarding/event');
    } catch (err) {
      setError(err.message || 'Error creating league');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md text-center mx-auto">
      <h1 className="text-2xl font-bold mb-4">Create a New League</h1>
      <p className="text-gray-600 mb-6">Create your league and then set up your first combine event.</p>
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
          {loading ? 'Creating...' : 'Create League & Continue'}
        </button>
        {error && <div className="text-red-500 text-sm mt-2">{error}</div>}
      </form>
    </div>
  );
}

export default function CreateLeague() {
  return (
    <div>
      <CreateLeagueForm />
    </div>
  );
} 