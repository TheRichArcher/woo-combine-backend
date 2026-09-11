/** Shared, visibility-aware draft polling. */
import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../lib/api';
import { getDraftSubscription } from '../lib/draftSubscription';

function useDraftResource(draftId, key, empty) {
  const [state, setState] = useState({ loading: Boolean(draftId), error: null });
  const storeRef = useRef(null);
  useEffect(() => {
    if (!draftId) { setState({ loading: false, error: null }); return; }
    const store = getDraftSubscription(draftId);
    storeRef.current = store;
    const update = () => setState(store.getSnapshot());
    const unsubscribe = store.subscribe(update);
    update();
    return () => { storeRef.current = null; unsubscribe(); };
  }, [draftId]);
  const refetch = useCallback(() => storeRef.current?.refresh(true), []);
  return { [key]: state[key] ?? empty, loading: state.loading, error: state.error, refetch };
}
export const useDraft = id => useDraftResource(id, 'draft', null);
export const useDraftPicks = id => useDraftResource(id, 'picks', []);
export const useDraftTeams = id => useDraftResource(id, 'teams', []);
export const useAvailablePlayers = id => useDraftResource(id, 'players', []);

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

  const makePick = useCallback(async (playerId, expectedPickNumber) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post(`/drafts/${draftId}/picks`, {
        player_id: playerId,
        expected_pick_number: expectedPickNumber
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

  const autoPick = useCallback(async (expectedPickNumber) => {
    setLoading(true);
    try {
      const res = await api.post(`/drafts/${draftId}/picks/auto`, { expected_pick_number: expectedPickNumber });
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
