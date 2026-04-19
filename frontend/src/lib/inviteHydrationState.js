const INVITE_HYDRATION_KEY = 'inviteJoinHydrationState';
const DEFAULT_MAX_AGE_MS = 5 * 60 * 1000;
const VALID_ROLES = ['organizer', 'coach', 'viewer', 'player', 'evaluator', 'admin'];

const sanitizeRole = (value) => {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return VALID_ROLES.includes(trimmed) ? trimmed : null;
};

export function setInviteHydrationState(payload = {}) {
  const role = sanitizeRole(payload.role);
  if (!role) return;
  const snapshot = {
    role,
    leagueId: payload.leagueId || null,
    eventId: payload.eventId || null,
    timestamp: Date.now()
  };
  try {
    localStorage.setItem(INVITE_HYDRATION_KEY, JSON.stringify(snapshot));
  } catch {
    // best effort
  }
}

export function getInviteHydrationState(maxAgeMs = DEFAULT_MAX_AGE_MS) {
  try {
    const raw = localStorage.getItem(INVITE_HYDRATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const role = sanitizeRole(parsed?.role);
    const timestamp = Number(parsed?.timestamp || 0);
    if (!role || !timestamp) return null;
    if (Date.now() - timestamp > maxAgeMs) return null;
    return {
      role,
      leagueId: parsed?.leagueId || null,
      eventId: parsed?.eventId || null,
      timestamp
    };
  } catch {
    return null;
  }
}

export function clearInviteHydrationState() {
  try {
    localStorage.removeItem(INVITE_HYDRATION_KEY);
  } catch {
    // best effort
  }
}
