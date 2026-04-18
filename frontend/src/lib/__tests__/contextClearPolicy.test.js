import { evaluate403ContextPolicy } from '../contextClearPolicy';

describe('403 context clear policy', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('successful join followed by generic 403 preserves selected event and league', () => {
    localStorage.setItem('selectedLeagueId', 'league-1');
    localStorage.setItem('selectedEventId', 'event-1');
    localStorage.setItem('selectedEvent', JSON.stringify({ id: 'event-1', league_id: 'league-1' }));
    localStorage.setItem('debug_qr_join_stage', JSON.stringify({
      stage: 'selection-state-written',
      timestamp: new Date().toISOString()
    }));

    const error = {
      response: { status: 403, data: { detail: 'Access denied' } },
      config: { url: '/players?event_id=event-1' }
    };

    const policy = evaluate403ContextPolicy(error);
    expect(policy.clearSelectedEvent).toBe(false);
    expect(policy.clearSelectedLeague).toBe(false);

    // Simulate global clear behavior applying this policy.
    if (policy.clearSelectedEvent) {
      localStorage.removeItem('selectedEvent');
      localStorage.removeItem('selectedEventId');
    }
    if (policy.clearSelectedLeague) {
      localStorage.removeItem('selectedLeagueId');
    }

    expect(localStorage.getItem('selectedLeagueId')).toBe('league-1');
    expect(localStorage.getItem('selectedEventId')).toBe('event-1');
    expect(localStorage.getItem('selectedEvent')).toBeTruthy();
  });
});
