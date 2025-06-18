import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import WelcomeLayout from '../components/layouts/WelcomeLayout';

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
    <div className="w-full max-w-md text-center">
      {/* Logo */}
      <div className="text-center mb-6">
        <img
          src="/favicon/woocombine-logo.png"
          alt="Woo-Combine Logo"
          className="w-16 h-16 mx-auto mb-4"
          style={{ objectFit: 'contain' }}
        />
      </div>

      <h1 className="text-2xl font-bold mb-4 text-gray-900">Create a New League</h1>
      <p className="text-gray-600 mb-6">Create your league and start evaluating players.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          className="w-full px-4 py-3 border border-cmf-primary/30 rounded-xl focus:ring-2 focus:ring-cmf-primary focus:border-cmf-primary transition"
          placeholder="League Name"
          value={leagueName}
          onChange={e => setLeagueName(e.target.value)}
          required
        />
        <button
          type="submit"
          className="w-full bg-cmf-primary hover:bg-cmf-secondary text-white font-semibold py-4 rounded-xl shadow-lg transition-all duration-200 transform hover:scale-[1.02]"
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
    <WelcomeLayout
      contentClassName="min-h-[70vh]"
      hideHeader={true}
      showOverlay={false}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 sm:p-10 flex flex-col items-center">
        <CreateLeagueForm />
      </div>
    </WelcomeLayout>
  );
} 