import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import LiveStandings from '../LiveStandings';

const mockSetSelectedEvent = jest.fn();
const mockSetEvents = jest.fn();
const mockSetSelectedLeagueId = jest.fn();
const mockUseEvent = jest.fn();
const mockUseAuth = jest.fn();
const mockApiGet = jest.fn();

jest.mock('../../context/EventContext', () => ({
  __esModule: true,
  useEvent: () => mockUseEvent(),
}));

jest.mock('../../context/AuthContext', () => ({
  __esModule: true,
  useAuth: () => mockUseAuth(),
}));

jest.mock('../../context/PlayerDetailsContext', () => ({
  __esModule: true,
  usePlayerDetails: () => ({
    selectedPlayer: null,
    openDetails: jest.fn(),
    closeDetails: jest.fn(),
  }),
}));

jest.mock('../../lib/api', () => ({
  __esModule: true,
  default: {
    get: (...args) => mockApiGet(...args),
    defaults: { baseURL: 'http://localhost:3000/api' },
  },
}));

jest.mock('../../utils/dataCache', () => ({
  __esModule: true,
  withCache: (fn) => fn,
}));

jest.mock('../../utils/optimizedScoring', () => ({
  __esModule: true,
  calculateOptimizedRankings: jest.fn(() => []),
  calculateOptimizedRankingsAcrossAll: jest.fn(() => []),
}));

jest.mock('../../constants/drillTemplates', () => ({
  __esModule: true,
  getDrillsFromTemplate: jest.fn(() => []),
  getPresetsFromTemplate: jest.fn(() => ({})),
}));

jest.mock('../../components/Skeleton', () => ({
  __esModule: true,
  default: () => <div data-testid="skeleton" />,
}));

describe('LiveStandings viewer invite restoration', () => {
  let currentRole = 'viewer';

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();

    currentRole = 'viewer';
    mockUseAuth.mockImplementation(() => ({
      userRole: currentRole,
      selectedLeagueId: '',
      setSelectedLeagueId: mockSetSelectedLeagueId,
    }));
    mockUseEvent.mockReturnValue({
      selectedEvent: null,
      setSelectedEvent: mockSetSelectedEvent,
      events: [],
      setEvents: mockSetEvents,
    });
    mockApiGet.mockImplementation((url) => {
      if (String(url).includes('/players?event_id=')) {
        return Promise.resolve({ data: [] });
      }
      if (String(url).includes('/schema')) {
        return Promise.resolve({ data: { drills: [], presets: {} } });
      }
      return Promise.resolve({ data: {} });
    });
  });

  test('restores selectedEvent from stored viewer invite context before empty-state', async () => {
    localStorage.setItem('viewerInviteEventContext', JSON.stringify({
      eventId: 'event-42',
      leagueId: 'league-9',
      role: 'viewer',
      source: 'join-event',
      event: { id: 'event-42', name: 'Invite Restored Event', drillTemplate: 'football' },
      timestamp: new Date().toISOString(),
    }));

    render(<LiveStandings />);

    await waitFor(() => {
      expect(mockSetSelectedEvent).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'event-42', name: 'Invite Restored Event' })
      );
    });
    expect(mockSetSelectedLeagueId).toHaveBeenCalledWith('league-9');
    expect(mockSetEvents).toHaveBeenCalled();

    expect(screen.queryByText('No Event Selected')).not.toBeInTheDocument();
    expect(screen.getByText('Live Standings')).toBeInTheDocument();
    expect(screen.getByText('Invite Restored Event')).toBeInTheDocument();
  });

  test('restores after delayed role hydration to viewer', async () => {
    currentRole = null;
    localStorage.setItem('viewerInviteEventContext', JSON.stringify({
      eventId: 'event-99',
      leagueId: 'league-5',
      role: 'viewer',
      source: 'join-event',
      event: { id: 'event-99', name: 'Hydrated Event', drillTemplate: 'football' },
      timestamp: new Date().toISOString(),
    }));

    const { rerender } = render(<LiveStandings />);
    expect(mockSetSelectedEvent).not.toHaveBeenCalled();

    currentRole = 'viewer';
    rerender(<LiveStandings />);

    await waitFor(() => {
      expect(mockSetSelectedEvent).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'event-99', name: 'Hydrated Event' })
      );
    });
    expect(mockSetSelectedLeagueId).toHaveBeenCalledWith('league-5');
    expect(mockSetEvents).toHaveBeenCalled();

    expect(screen.queryByText('No Event Selected')).not.toBeInTheDocument();
    expect(screen.getByText('Hydrated Event')).toBeInTheDocument();
  });

  test('corrects mismatched selectedLeagueId from invite context', async () => {
    mockUseAuth.mockImplementation(() => ({
      userRole: 'viewer',
      selectedLeagueId: 'league-old',
      setSelectedLeagueId: mockSetSelectedLeagueId,
    }));
    localStorage.setItem('viewerInviteEventContext', JSON.stringify({
      eventId: 'event-77',
      leagueId: 'league-new',
      role: 'viewer',
      source: 'join-event',
      event: { id: 'event-77', name: 'Mismatch Recovery Event', drillTemplate: 'football' },
      timestamp: new Date().toISOString(),
    }));

    render(<LiveStandings />);

    await waitFor(() => {
      expect(mockSetSelectedEvent).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'event-77', name: 'Mismatch Recovery Event' })
      );
    });
    expect(mockSetSelectedLeagueId).toHaveBeenCalledWith('league-new');
    expect(mockSetEvents).toHaveBeenCalled();
  });
});
