export const QR_JOIN_STAGE_KEY = 'debug_qr_join_stage';
const POST_JOIN_PROTECT_WINDOW_MS = 45 * 1000;

const parseJsonSafe = (value) => {
  if (!value || typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const readJoinStageRaw = () => {
  try {
    return localStorage.getItem(QR_JOIN_STAGE_KEY);
  } catch {
    return null;
  }
};

const isImmediatePostJoinWindow = (joinStageRaw, nowMs) => {
  const parsed = parseJsonSafe(joinStageRaw);
  if (!parsed?.timestamp) return false;
  const stageTime = Date.parse(parsed.timestamp);
  if (!Number.isFinite(stageTime)) return false;
  const ageMs = nowMs - stageTime;
  return ageMs >= 0 && ageMs <= POST_JOIN_PROTECT_WINDOW_MS;
};

export const isDefinitiveEventAccessLoss403 = (error) => {
  const detail = String(error?.response?.data?.detail || '').toLowerCase();
  const requestUrl = String(error?.config?.url || '').toLowerCase();

  const definitiveDetailMarkers = [
    'event not found',
    'league not found',
    'removed from this league',
    'no longer a member',
    'membership revoked',
    'deleted'
  ];

  if (definitiveDetailMarkers.some(marker => detail.includes(marker))) {
    return true;
  }

  // Only treat event-specific denials as definitive when backend names the event resource.
  if (requestUrl.includes('/events/') && detail.includes('not found')) {
    return true;
  }

  return false;
};

export const evaluate403ContextPolicy = (error, options = {}) => {
  const nowMs = options.nowMs ?? Date.now();
  const joinStageRaw = options.joinStageRaw ?? readJoinStageRaw();
  const postJoinWindow = isImmediatePostJoinWindow(joinStageRaw, nowMs);
  const definitiveEventLoss = isDefinitiveEventAccessLoss403(error);

  // Keep league selection stable on generic 403 so users are not dropped into no-league fallback.
  const clearSelectedLeague = false;
  // During immediate post-join window, preserve selectedEvent unless access loss is definitive.
  const clearSelectedEvent = definitiveEventLoss || !postJoinWindow;

  return {
    postJoinWindow,
    definitiveEventLoss,
    clearSelectedEvent,
    clearSelectedLeague
  };
};
