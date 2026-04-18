export const VIEWER_INVITE_EVENT_CONTEXT_KEY = 'viewerInviteEventContext';

const parseJsonSafe = (raw) => {
  if (!raw || typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const persistViewerInviteEventContext = ({ event, leagueId, role = 'viewer', source = 'join-event' }) => {
  if (!event?.id) return;

  const payload = {
    event,
    eventId: event.id,
    leagueId: leagueId || event.league_id || null,
    role,
    source,
    timestamp: new Date().toISOString()
  };

  try {
    localStorage.setItem(VIEWER_INVITE_EVENT_CONTEXT_KEY, JSON.stringify(payload));
  } catch {
    // best-effort persistence for browser-recovery path
  }
};

export const readViewerInviteEventContext = () => {
  try {
    const raw = localStorage.getItem(VIEWER_INVITE_EVENT_CONTEXT_KEY);
    return parseJsonSafe(raw);
  } catch {
    return null;
  }
};
