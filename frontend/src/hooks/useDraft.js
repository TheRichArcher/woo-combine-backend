/**
 * Draft hooks for managing draft state and real-time updates
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  doc, 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../firebase';
import api from '../lib/api';

/**
 * Hook to fetch and subscribe to a draft's real-time state
 */
export function useDraft(draftId) {
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!draftId) {
      setLoading(false);
      return;
    }

    // Real-time subscription to draft document
    const unsubscribe = onSnapshot(
      doc(db, 'drafts', draftId),
      (doc) => {
        if (doc.exists()) {
          setDraft({ id: doc.id, ...doc.data() });
        } else {
          setError('Draft not found');
        }
        setLoading(false);
      },
      (err) => {
        console.error('Draft subscription error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [draftId]);

  return { draft, loading, error };
}

/**
 * Hook to fetch and subscribe to draft picks
 */
export function useDraftPicks(draftId) {
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!draftId) {
      setLoading(false);
      return;
    }

    const picksQuery = query(
      collection(db, 'draft_picks'),
      where('draft_id', '==', draftId),
      orderBy('pick_number', 'asc')
    );

    const unsubscribe = onSnapshot(
      picksQuery,
      (snapshot) => {
        const picksData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setPicks(picksData);
        setLoading(false);
      },
      (err) => {
        console.error('Picks subscription error:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [draftId]);

  return { picks, loading };
}

/**
 * Hook to fetch draft teams
 */
export function useDraftTeams(draftId) {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTeams = useCallback(async () => {
    if (!draftId) {
      setLoading(false);
      return;
    }

    try {
      const res = await api.get(`/drafts/${draftId}/teams`);
      setTeams(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [draftId]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  // Real-time updates for teams
  useEffect(() => {
    if (!draftId) return;

    const teamsQuery = query(
      collection(db, 'draft_teams'),
      where('draft_id', '==', draftId),
      orderBy('pick_order', 'asc')
    );

    const unsubscribe = onSnapshot(teamsQuery, (snapshot) => {
      const teamsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTeams(teamsData);
    });

    return () => unsubscribe();
  }, [draftId]);

  return { teams, loading, error, refetch: fetchTeams };
}

/**
 * Hook to fetch available players for drafting
 */
export function useAvailablePlayers(draftId) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPlayers = useCallback(async () => {
    if (!draftId) {
      setLoading(false);
      return;
    }

    try {
      const res = await api.get(`/drafts/${draftId}/players`);
      setPlayers(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [draftId]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

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
    } catch (err) {
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
    } catch (err) {
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
