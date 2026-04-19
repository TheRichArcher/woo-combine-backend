import { getInviteHydrationState } from './inviteHydrationState';

const SELECT_ROLE_REDIRECT_DEBUG_KEY = 'debug_select_role_redirect';

const safeReadStorage = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeReadSelectedEvent = () => {
  const raw = safeReadStorage('selectedEvent');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return {
      id: parsed?.id || null,
      league_id: parsed?.league_id || null
    };
  } catch {
    return { raw };
  }
};

export function logSelectRoleRedirect({
  source,
  reason,
  pathname,
  userRole,
  leaguesLength,
  selectedLeagueId,
  selectedEventId
}) {
  const payload = {
    source: source || 'unknown',
    reason: reason || 'unspecified',
    pathname: pathname || (typeof window !== 'undefined' ? window.location.pathname : null),
    userRole: userRole || null,
    pendingInvite: safeReadStorage('pendingEventJoin'),
    inviteJoinInProgress: safeReadStorage('inviteJoinInProgress') === '1',
    inviteHydrationState: getInviteHydrationState(),
    leaguesLength: Number.isFinite(leaguesLength) ? leaguesLength : null,
    selectedLeagueId: selectedLeagueId || safeReadStorage('selectedLeagueId') || null,
    selectedEvent: selectedEventId ? { id: selectedEventId } : safeReadSelectedEvent(),
    timestamp: new Date().toISOString()
  };
  console.warn('[AuthRedirect] /select-role', payload);
  try {
    localStorage.setItem(SELECT_ROLE_REDIRECT_DEBUG_KEY, JSON.stringify(payload));
  } catch {
    // best effort
  }
}
