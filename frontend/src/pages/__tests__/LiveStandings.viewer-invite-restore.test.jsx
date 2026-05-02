import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LiveStandings from '../LiveStandings';

const mockSetSelectedEvent = jest.fn();
const mockSetEvents = jest.fn();
const mockSetSelectedLeagueId = jest.fn();
const mockUseEvent = jest.fn();
const mockUseAuth = jest.fn();
const mockApiGet = jest.fn();
const mockShowError = jest.fn();
const mockDownloadWithApiAuth = jest.fn();

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

jest.mock('../../context/ToastContext', () => ({
  __esModule: true,
  useToast: () => ({
    showError: mockShowError,
  }),
}));

jest.mock('../../utils/authenticatedDownload', () => ({
  __esModule: true,
  downloadWithApiAuth: (...args) => mockDownloadWithApiAuth(...args),
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
      role: currentRole,
      leagues: [{ id: 'league-9', role: currentRole }],
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
    mockDownloadWithApiAuth.mockResolvedValue('standings.pdf');
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

  test('restores even before delayed role hydration to viewer', async () => {
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
    await waitFor(() => {
      expect(mockSetSelectedEvent).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'event-99', name: 'Hydrated Event' })
      );
    });

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
      role: 'viewer',
      leagues: [{ id: 'league-new', role: 'viewer' }],
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

  test('restores invite context even when global role is coach', async () => {
    mockUseAuth.mockImplementation(() => ({
      userRole: 'coach',
      role: 'coach',
      leagues: [{ id: 'league-8', role: 'coach' }],
      selectedLeagueId: '',
      setSelectedLeagueId: mockSetSelectedLeagueId,
    }));
    localStorage.setItem('viewerInviteEventContext', JSON.stringify({
      eventId: 'event-88',
      leagueId: 'league-8',
      role: 'viewer',
      source: 'join-event',
      event: { id: 'event-88', name: 'Cross Role Recovery Event', drillTemplate: 'football' },
      timestamp: new Date().toISOString(),
    }));

    render(<LiveStandings />);

    await waitFor(() => {
      expect(mockSetSelectedEvent).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'event-88', name: 'Cross Role Recovery Event' })
      );
    });
    expect(mockSetSelectedLeagueId).toHaveBeenCalledWith('league-8');
    expect(mockSetEvents).toHaveBeenCalled();
  });

  test('hides staff export for viewer-scoped league membership even when global role is coach', async () => {
    mockUseAuth.mockImplementation(() => ({
      userRole: 'coach',
      role: 'viewer',
      leagues: [{ id: 'league-9', role: 'viewer' }],
      selectedLeagueId: 'league-9',
      setSelectedLeagueId: mockSetSelectedLeagueId,
    }));
    mockUseEvent.mockReturnValue({
      selectedEvent: { id: 'event-42', name: 'Viewer Scoped Event', league_id: 'league-9', drillTemplate: 'football' },
      setSelectedEvent: mockSetSelectedEvent,
      events: [],
      setEvents: mockSetEvents,
    });

    render(<LiveStandings />);

    await waitFor(() => {
      expect(screen.getByText('No Rankings Yet')).toBeInTheDocument();
    });
    expect(screen.queryByText('Export PDF')).not.toBeInTheDocument();
    expect(mockDownloadWithApiAuth).not.toHaveBeenCalled();
  });

  test('downloads standings PDF for selected league staff membership', async () => {
    mockUseAuth.mockImplementation(() => ({
      userRole: 'coach',
      role: 'coach',
      leagues: [{ id: 'league-9', role: 'coach' }],
      selectedLeagueId: 'league-9',
      setSelectedLeagueId: mockSetSelectedLeagueId,
    }));
    mockUseEvent.mockReturnValue({
      selectedEvent: { id: 'event-42', name: 'Coach Scoped Event', league_id: 'league-9', drillTemplate: 'football' },
      setSelectedEvent: mockSetSelectedEvent,
      events: [],
      setEvents: mockSetEvents,
    });

    render(<LiveStandings />);
    await waitFor(() => {
      expect(screen.getByText('No Rankings Yet')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Export PDF'));

    await waitFor(() => {
      expect(mockDownloadWithApiAuth).toHaveBeenCalledWith(
        expect.any(Object),
        '/events/event-42/export-pdf',
        expect.stringMatching(/^Coach Scoped Event_standings_\d{4}-\d{2}-\d{2}\.pdf$/)
      );
    });
  });
});
