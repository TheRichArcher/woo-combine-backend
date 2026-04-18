export const VIEWER_INVITE_EVENT_CONTEXT_KEY = 'viewerInviteEventContext';

const isQrDebugEnabled = () => {
  try {
    return localStorage.getItem('debug_qr_flow') === '1';
  } catch {
    return false;
  }
};

const qrInviteDebug = (message, payload) => {
  if (!isQrDebugEnabled()) return;
  console.log(`[QR_FLOW][ViewerInviteContext] ${message}`, payload);
};

const parseJsonSafe = (raw) => {
  if (!raw || typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const persistViewerInviteEventContext = ({ event, leagueId, role = 'viewer', source = 'join-event' }) => {
  if (!event?.id) {
    qrInviteDebug('Skipping persist (missing event.id)', { event, leagueId, role, source });
    return { written: false, key: VIEWER_INVITE_EVENT_CONTEXT_KEY, payload: null };
  }

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
    qrInviteDebug('Persisted invite event context', {
      key: VIEWER_INVITE_EVENT_CONTEXT_KEY,
      payload
    });
    return { written: true, key: VIEWER_INVITE_EVENT_CONTEXT_KEY, payload };
  } catch {
    // best-effort persistence for browser-recovery path
    qrInviteDebug('Persist failed (storage write threw)', {
      key: VIEWER_INVITE_EVENT_CONTEXT_KEY,
      payload
    });
    return { written: false, key: VIEWER_INVITE_EVENT_CONTEXT_KEY, payload };
  }
};

export const readViewerInviteEventContext = () => {
  try {
    const raw = localStorage.getItem(VIEWER_INVITE_EVENT_CONTEXT_KEY);
    const parsed = parseJsonSafe(raw);
    qrInviteDebug('Read invite event context', {
      key: VIEWER_INVITE_EVENT_CONTEXT_KEY,
      raw,
      parsed
    });
    return parsed;
  } catch {
    qrInviteDebug('Read failed (storage read threw)', {
      key: VIEWER_INVITE_EVENT_CONTEXT_KEY
    });
    return null;
  }
};

export const getViewerInviteEventLock = ({ userRole, inviteContext } = {}) => {
  if (userRole && userRole !== 'viewer') return null;

  const context = inviteContext || readViewerInviteEventContext();
  if (!context) return null;

  const role = (context.role || '').toLowerCase();
  const source = (context.source || '').toLowerCase();
  const eventId = context.eventId || context.event?.id || null;
  const leagueId = context.leagueId || context.event?.league_id || null;

  // Only lock sessions that originated from viewer invite flow.
  if (role && role !== 'viewer') return null;
  if (source !== 'join-event') return null;
  if (!eventId) return null;

  return { eventId, leagueId };
};

export const isViewerInviteEventScopedSession = (options = {}) => {
  return Boolean(getViewerInviteEventLock(options));
};
