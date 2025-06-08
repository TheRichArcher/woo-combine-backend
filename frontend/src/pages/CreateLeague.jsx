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
    console.log('[CreateLeague] Form submit triggered!', e);
    console.log('[CreateLeague] League name:', leagueName);
    console.log('[CreateLeague] User:', user);
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      console.log('[CreateLeague] About to make API call to /leagues');
      const { data } = await api.post('/leagues', {
        name: leagueName,
        user_id: user?.uid,
        email: user?.email,
      });
      console.log('[CreateLeague] API call successful, response:', data);
      
      if (addLeague) {
        addLeague({ id: data.league_id, name: leagueName, role: 'organizer' });
      }
      if (onCreated) onCreated(data.league_id);
      
      // Redirect to event creation/selection page
      console.log('[CreateLeague] Redirecting to onboarding event page');
      navigate('/onboarding/event');
    } catch (err) {
      console.error('[CreateLeague] API call failed:', err);
      setError(err.message || 'Error creating league');
    } finally {
      setLoading(false);
      console.log('[CreateLeague] Form submission completed');
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
          onClick={(e) => {
            console.log('[CreateLeague] Button clicked!', e);
            console.log('[CreateLeague] Button disabled:', loading);
            console.log('[CreateLeague] League name at click:', leagueName);
          }}
        >
          {loading ? 'Creating...' : 'Create League & Continue'}
        </button>
        {error && <div className="text-red-500 text-sm mt-2">{error}</div>}
      </form>
    </div>
  );
}

export default function CreateLeague() {
  console.log('[CreateLeague] Component rendering');
  console.log('[CreateLeague] Current location:', window.location.pathname);
  
  return (
    <div>
      <div className="text-xs text-gray-500 mb-4">
        Debug: CreateLeague component loaded successfully
      </div>
      <CreateLeagueForm />
    </div>
  );
} 