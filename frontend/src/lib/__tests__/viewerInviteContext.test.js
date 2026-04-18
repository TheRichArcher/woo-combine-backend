import {
  VIEWER_INVITE_EVENT_CONTEXT_KEY,
  persistViewerInviteEventContext,
  readViewerInviteEventContext,
  getViewerInviteEventLock,
  isViewerInviteEventScopedSession
} from '../viewerInviteContext';

describe('viewer invite context persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('persists invited viewer event context from join result', () => {
    persistViewerInviteEventContext({
      event: { id: 'event-123', name: 'Invite Event', league_id: 'league-77' },
      leagueId: 'league-77',
      role: 'viewer',
      source: 'join-event'
    });

    const raw = localStorage.getItem(VIEWER_INVITE_EVENT_CONTEXT_KEY);
    expect(raw).toBeTruthy();

    const restored = readViewerInviteEventContext();
    expect(restored?.eventId).toBe('event-123');
    expect(restored?.leagueId).toBe('league-77');
    expect(restored?.role).toBe('viewer');
    expect(restored?.source).toBe('join-event');
    expect(restored?.event?.name).toBe('Invite Event');
  });

  test('returns event lock only for viewer join-event sessions', () => {
    persistViewerInviteEventContext({
      event: { id: 'event-123', name: 'Invite Event', league_id: 'league-77' },
      leagueId: 'league-77',
      role: 'viewer',
      source: 'join-event'
    });

    expect(getViewerInviteEventLock({ userRole: 'viewer' })).toEqual({
      eventId: 'event-123',
      leagueId: 'league-77'
    });
    expect(isViewerInviteEventScopedSession({ userRole: 'viewer' })).toBe(true);
    expect(getViewerInviteEventLock({ userRole: 'organizer' })).toBeNull();
    expect(isViewerInviteEventScopedSession({ userRole: 'organizer' })).toBe(false);
  });

  test('still returns lock when session role is unknown but invite payload is viewer join-event', () => {
    persistViewerInviteEventContext({
      event: { id: 'event-123', name: 'Invite Event', league_id: 'league-77' },
      leagueId: 'league-77',
      role: 'viewer',
      source: 'join-event'
    });

    expect(getViewerInviteEventLock()).toEqual({
      eventId: 'event-123',
      leagueId: 'league-77'
    });
  });
});
