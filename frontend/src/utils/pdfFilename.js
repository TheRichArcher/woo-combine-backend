const DEFAULT_EVENT_SEGMENT = 'Event';
const DEFAULT_PLAYER_SEGMENT = 'Player';

export function sanitizeFilenameSegment(value, fallback) {
  const safeValue = typeof value === 'string' ? value : '';
  const sanitized = safeValue
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return sanitized || fallback;
}

export function buildPlayerScorecardPdfFilename({ eventName, playerName } = {}) {
  const safeEvent = sanitizeFilenameSegment(eventName, DEFAULT_EVENT_SEGMENT);
  const safePlayer = sanitizeFilenameSegment(playerName, DEFAULT_PLAYER_SEGMENT);
  return `WooCombine_${safeEvent}_${safePlayer}.pdf`;
}
