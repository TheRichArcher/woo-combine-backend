/**
 * Draft hooks for managing draft state
 * Uses backend API polling instead of direct Firestore subscriptions
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../lib/api';

// Polling interval for real-time updates (ms)
const POLL_INTERVAL = 2000;

/**
 * Hook to fetch and poll a draft's state
 */
export function useDraft(draftId) {
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  const fetchDraft = useCallback(async () => {
    if (!draftId) {
      setLoading(false);
      return;
    }

    try {
      const res = await api.get(`/drafts/${draftId}`);
      setDraft(res.data);
      setError(null);
    } catch (err) {
      console.error('Draft fetch error:', err);
      if (err.response?.status === 404) {
        setError('Draft not found');
      } else {
        setError(err.response?.data?.detail || err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [draftId]);

  // Initial fetch
  useEffect(() => {
    fetchDraft();
  }, [fetchDraft]);

  // Polling for real-time updates
  useEffect(() => {
    if (!draftId) return;

    pollRef.current = setInterval(fetchDraft, POLL_INTERVAL);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [draftId, fetchDraft]);

  return { draft, loading, error, refetch: fetchDraft };
}

/**
 * Hook to fetch and poll draft picks
 */
export function useDraftPicks(draftId) {
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  const fetchPicks = useCallback(async () => {
    if (!draftId) {
      setLoading(false);
      return;
    }

    try {
      const res = await api.get(`/drafts/${draftId}/picks`);
      setPicks(res.data);
      setError(null);
    } catch (err) {
      console.error('Picks fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [draftId]);

  // Initial fetch
  useEffect(() => {
    fetchPicks();
  }, [fetchPicks]);

  // Polling for real-time updates
  useEffect(() => {
    if (!draftId) return;

    pollRef.current = setInterval(fetchPicks, POLL_INTERVAL);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [draftId, fetchPicks]);

  return { picks, loading, error, refetch: fetchPicks };
}

/**
 * Hook to fetch and poll draft teams
 */
export function useDraftTeams(draftId) {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  const fetchTeams = useCallback(async () => {
    if (!draftId) {
      setLoading(false);
      return;
    }

    try {
      const res = await api.get(`/drafts/${draftId}/teams`);
      setTeams(res.data);
      setError(null);
    } catch (err) {
      console.error('Teams fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [draftId]);

  // Initial fetch
  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  // Polling for real-time updates
  useEffect(() => {
    if (!draftId) return;

    pollRef.current = setInterval(fetchTeams, POLL_INTERVAL);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [draftId, fetchTeams]);

  return { teams, loading, error, refetch: fetchTeams };
}

/**
 * Hook to fetch available players for drafting
 */
export function useAvailablePlayers(draftId) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  const fetchPlayers = useCallback(async () => {
    if (!draftId) {
      setLoading(false);
      return;
    }

    try {
      const res = await api.get(`/drafts/${draftId}/players`);
      setPlayers(res.data);
      setError(null);
    } catch (err) {
      console.error('Players fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [draftId]);

  // Initial fetch
  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  // Polling for real-time updates (to track who's been drafted)
  useEffect(() => {
    if (!draftId) return;

    pollRef.current = setInterval(fetchPlayers, POLL_INTERVAL);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [draftId, fetchPlayers]);

  return { players, loading, error, refetch: fetchPlayers };
}

/**
 * Hook to manage coach's personal rankings
 */
export function useCoachRankings(draftId) {
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const fetchRankings = useCallback(async () => {
    if (!draftId) {
      setLoading(false);
      return;
    }

    try {
      const res = await api.get(`/drafts/${draftId}/rankings`);
      setRankings(res.data.ranked_player_ids || []);
      setError(null);
    } catch (err) {
      console.error('Rankings fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [draftId]);

  const saveRankings = useCallback(async (rankedPlayerIds) => {
    if (!draftId) return;

    setSaving(true);
    try {
      await api.put(`/drafts/${draftId}/rankings`, {
        ranked_player_ids: rankedPlayerIds
      });
      setRankings(rankedPlayerIds);
      setError(null);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [draftId]);

  useEffect(() => {
    fetchRankings();
  }, [fetchRankings]);

  return { rankings, loading, saving, error, saveRankings, refetch: fetchRankings };
}

/**
 * Hook for draft actions (pick, pause, resume, etc.)
 */
export function useDraftActions(draftId) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const makePick = useCallback(async (playerId) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post(`/drafts/${draftId}/picks`, {
        player_id: playerId
      });
      return res.data;
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [draftId]);

  const startDraft = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post(`/drafts/${draftId}/start`);
      return res.data;
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [draftId]);

  const pauseDraft = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.post(`/drafts/${draftId}/pause`);
      return res.data;
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [draftId]);

  const resumeDraft = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.post(`/drafts/${draftId}/resume`);
      return res.data;
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [draftId]);

  const undoPick = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.post(`/drafts/${draftId}/picks/undo`);
      return res.data;
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [draftId]);

  const autoPick = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.post(`/drafts/${draftId}/picks/auto`);
      return res.data;
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [draftId]);

  return {
    makePick,
    startDraft,
    pauseDraft,
    resumeDraft,
    undoPick,
    autoPick,
    loading,
    error
  };
}

/**
 * List drafts for an event
 */
export function useDraftList(eventId) {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDrafts = useCallback(async () => {
    if (!eventId) {
      setLoading(false);
      return;
    }

    try {
      const res = await api.get(`/drafts?event_id=${eventId}`);
      setDrafts(res.data);
      setError(null);
    } catch (err) {
      console.error('Drafts list fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  return { drafts, loading, error, refetch: fetchDrafts };
}
