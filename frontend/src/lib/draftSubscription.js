import api from '../lib/api';

// One subscription per mounted draft, not one polling loop per panel.
const stores = new Map();
const ACTIVE_INTERVAL = 10000;
const IDLE_INTERVAL = 60000;
const DETAIL_INTERVAL = 60000;
const EMPTY = { draft: null, picks: [], teams: [], players: [], loading: true, error: null };

function createStore(id) {
  const listeners = new Set();
  let snapshot = { ...EMPTY }, timer, flight, flightForced = false, queuedForce, fingerprint, lastDetails = 0, failures = 0, disposed = false;
  const emit = () => listeners.forEach(fn => fn());
  const visible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';
  const schedule = () => {
    clearTimeout(timer);
    if (disposed || !listeners.size || !visible()) return;
    const normal = snapshot.draft?.status === 'active' ? ACTIVE_INTERVAL : IDLE_INTERVAL;
    timer = setTimeout(() => refresh(false), Math.min(300000, normal * 2 ** failures));
  };
  const refresh = (force = true) => {
    if (disposed) return Promise.resolve();
    if (flight) {
      if (!force || flightForced) return flight;
      if (!queuedForce) queuedForce = flight.then(() => { queuedForce = null; return refresh(true); });
      return queuedForce;
    }
    clearTimeout(timer);
    flightForced = force;
    flight = (async () => {
      try {
        const { data: draft } = await api.get(`/drafts/${id}`);
        if (disposed) return;
        const nextFingerprint = JSON.stringify(draft);
        if (force || nextFingerprint !== fingerprint || Date.now() - lastDetails >= DETAIL_INTERVAL) {
          const responses = await Promise.all(['picks', 'teams', 'players'].map(part => api.get(`/drafts/${id}/${part}`)));
          if (disposed) return;
          const [picks, teams, players] = responses.map(r => r.data);
          snapshot = { draft, picks, teams, players: (players || []).map(player => ({
            ...player, draftPercentile: player.canonical_percentile ?? null,
            draftStarCount: player.star_count ?? null, draftStarLabel: player.star_label ?? '',
            draftStarDisplay: player.star_display ?? '', draftDrillMetrics: player.canonical_drill_metrics ?? {}
          })), loading: false, error: null };
          fingerprint = nextFingerprint;
          lastDetails = Date.now();
        } else {
          snapshot = { ...snapshot, draft, loading: false, error: null };
        }
        failures = 0;
      } catch (error) {
        if (disposed) return;
        failures = Math.min(failures + 1, 5);
        snapshot = { ...snapshot, loading: false, error: error.response?.data?.detail || error.message || 'Draft connection unavailable' };
      } finally {
        flight = null;
        if (!disposed) { emit(); schedule(); }
      }
    })();
    return flight;
  };
  const onVisibility = () => {
    clearTimeout(timer);
    if (visible()) refresh(false);
  };
  return {
    getSnapshot: () => snapshot,
    refresh,
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) {
        document.addEventListener('visibilitychange', onVisibility);
        if (visible()) refresh(true);
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          disposed = true;
          clearTimeout(timer);
          document.removeEventListener('visibilitychange', onVisibility);
          if (stores.get(id) === this) stores.delete(id);
        }
      };
    }
  };
}

export function getDraftSubscription(id) {
  if (!stores.has(id)) stores.set(id, createStore(id));
  return stores.get(id);
}
