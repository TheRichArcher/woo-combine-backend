import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import WelcomeLayout from '../components/layouts/WelcomeLayout';
import OnboardingCard from '../components/OnboardingCard';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

export function CreateLeagueForm({ onCreated }) {
  const { user, addLeague, setSelectedLeagueId } = useAuth();
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
      
      const newLeagueId = data.league_id;
      
      if (addLeague) {
        addLeague({ id: newLeagueId, name: leagueName, role: 'organizer' });
      }
      
      if (setSelectedLeagueId) {
        setSelectedLeagueId(newLeagueId);
      }
      
      if (onCreated) onCreated(newLeagueId);
      
      // Redirect to event creation/selection page and replace history
      navigate('/onboarding/event', { replace: true });
    } catch (err) {
      setError(err.message || 'Error creating league');
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingCard title="Create a New League" subtitle="Create your league and start evaluating players.">
      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        <Input
          type="text"
          placeholder="League Name"
          value={leagueName}
          onChange={e => setLeagueName(e.target.value)}
          required
          className="py-3"
        />
        <Button type="submit" size="lg" disabled={loading} className="w-full">
          {loading ? 'Creating...' : 'Create League & Continue'}
        </Button>
        {error && <div className="text-red-500 text-sm mt-2">{error}</div>}
      </form>
    </OnboardingCard>
  );
}

export default function CreateLeague() {
  return (
    <WelcomeLayout contentClassName="min-h-screen" hideHeader={true} showOverlay={false} backgroundColor="bg-surface-subtle">
      <CreateLeagueForm />
    </WelcomeLayout>
  );
}