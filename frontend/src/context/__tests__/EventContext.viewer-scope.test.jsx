import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { EventProvider, useEvent } from '../EventContext';

const mockUseAuth = jest.fn();
const mockApiGet = jest.fn();

jest.mock('../AuthContext', () => ({
  __esModule: true,
  useAuth: () => mockUseAuth(),
}));

jest.mock('../../firebase', () => ({
  __esModule: true,
  auth: {
    currentUser: null,
  },
}));

jest.mock('../../lib/api', () => ({
  __esModule: true,
  default: {
    get: (...args) => mockApiGet(...args),
  },
}));

jest.mock('../../utils/dataCache', () => ({
  __esModule: true,
  withCache: (fn) => fn,
  cacheInvalidation: {
    eventsUpdated: jest.fn(),
  },
}));

const TestHarness = () => {
  const { events, selectedEvent } = useEvent();
  return (
    <div>
      <div data-testid="event-ids">{events.map((event) => event.id).join(',')}</div>
      <div data-testid="selected-event-id">{selectedEvent?.id || 'none'}</div>
    </div>
  );
};

describe('EventContext viewer invite scoping', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();

    mockApiGet.mockResolvedValue({
      data: {
        events: [
          { id: 'event-1', name: 'Invite Event', league_id: 'league-1' },
          { id: 'event-2', name: 'Other Event', league_id: 'league-1' },
        ],
      },
    });
  });

  test('scopes viewer invite sessions to the invited event', async () => {
    localStorage.setItem('viewerInviteEventContext', JSON.stringify({
      eventId: 'event-1',
      leagueId: 'league-1',
      role: 'viewer',
      source: 'join-event',
      event: { id: 'event-1', name: 'Invite Event', league_id: 'league-1' },
      timestamp: new Date().toISOString(),
    }));

    mockUseAuth.mockReturnValue({
      selectedLeagueId: 'league-1',
      authChecked: true,
      roleChecked: true,
      userRole: 'viewer',
    });

    render(
      <EventProvider>
        <TestHarness />
      </EventProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('event-ids')).toHaveTextContent('event-1');
      expect(screen.getByTestId('selected-event-id')).toHaveTextContent('event-1');
    });
  });

  test('keeps full event list for organizer sessions', async () => {
    mockUseAuth.mockReturnValue({
      selectedLeagueId: 'league-1',
      authChecked: true,
      roleChecked: true,
      userRole: 'organizer',
    });

    render(
      <EventProvider>
        <TestHarness />
      </EventProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('event-ids')).toHaveTextContent('event-1,event-2');
    });
  });

  test('does not apply viewer invite scoping for organizer when stale invite context exists', async () => {
    localStorage.setItem('viewerInviteEventContext', JSON.stringify({
      eventId: 'event-1',
      leagueId: 'league-1',
      role: 'viewer',
      source: 'join-event',
      event: { id: 'event-1', name: 'Invite Event', league_id: 'league-1' },
      timestamp: new Date().toISOString(),
    }));

    mockUseAuth.mockReturnValue({
      selectedLeagueId: 'league-1',
      authChecked: true,
      roleChecked: true,
      userRole: 'organizer',
    });

    render(
      <EventProvider>
        <TestHarness />
      </EventProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('event-ids')).toHaveTextContent('event-1,event-2');
      expect(screen.getByTestId('selected-event-id')).toHaveTextContent('event-1');
    });
  });

  test('replaces stale coach selectedEvent with first accessible scoped event', async () => {
    localStorage.setItem('selectedEvent', JSON.stringify({
      id: 'event-2',
      name: 'Stale Event',
      league_id: 'league-1',
    }));

    mockApiGet.mockResolvedValue({
      data: {
        events: [
          { id: 'event-1', name: 'Assigned Event', league_id: 'league-1' },
        ],
      },
    });

    mockUseAuth.mockReturnValue({
      selectedLeagueId: 'league-1',
      authChecked: true,
      roleChecked: true,
      userRole: 'coach',
    });

    render(
      <EventProvider>
        <TestHarness />
      </EventProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('event-ids')).toHaveTextContent('event-1');
      expect(screen.getByTestId('selected-event-id')).toHaveTextContent('event-1');
    });
  });
});
