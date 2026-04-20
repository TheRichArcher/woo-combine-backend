import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Mock firebase before anything imports it
jest.mock('../../firebase', () => ({
  auth: { currentUser: null, onAuthStateChanged: jest.fn() },
  db: {},
}));

// Mock api module
jest.mock('../../lib/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  },
}));

// Mock leagues module
jest.mock('../../lib/leagues', () => ({
  __esModule: true,
  fetchLeagues: jest.fn().mockResolvedValue([]),
  createLeague: jest.fn(),
}));

// Mock the AuthContext hook
const mockAuthContext = {
  user: { uid: 'test-user', email: 'test@example.com' },
  userRole: 'organizer',
  leagues: [{ id: 'league1', name: 'Test League' }],
  selectedLeagueId: 'league1',
  setSelectedLeagueId: jest.fn(),
  logout: jest.fn(),
  loading: false,
};

const mockEventContext = {
  events: [
    { id: 'event-1', name: 'Invite Event', date: '2026-01-01' },
    { id: 'event-2', name: 'Other League Event', date: '2026-01-02' },
  ],
  selectedEvent: { id: 'event-1', name: 'Invite Event', date: '2026-01-01' },
  setSelectedEvent: jest.fn(),
  setEvents: jest.fn(),
  refreshEvents: jest.fn(),
};

jest.mock('../../context/AuthContext', () => ({
  __esModule: true,
  AuthProvider: ({ children }) => children,
  useAuth: () => mockAuthContext,
  useLogout: () => jest.fn(),
}));

jest.mock('../../context/EventContext', () => ({
  __esModule: true,
  EventProvider: ({ children }) => children,
  useEvent: () => mockEventContext,
}));

jest.mock('../../context/ToastContext', () => ({
  __esModule: true,
  ToastProvider: ({ children }) => children,
  useToast: () => ({ showToast: jest.fn() }),
}));

import Navigation from '../Navigation';

describe('Navigation', () => {
  afterEach(() => {
    mockAuthContext.userRole = 'organizer';
    localStorage.clear();
  });

  it('renders navigation for authenticated user', () => {
    render(
      <BrowserRouter>
        <Navigation />
      </BrowserRouter>
    );
    // Check that nav renders with expected links
    const nav = document.querySelector('nav');
    expect(nav).toBeTruthy();
  });

  it('renders without crashing', () => {
    const { container } = render(
      <BrowserRouter>
        <Navigation />
      </BrowserRouter>
    );
    expect(container).toBeTruthy();
  });

  it('hides /players navigation links for viewer role', () => {
    mockAuthContext.userRole = 'viewer';

    const { container } = render(
      <BrowserRouter>
        <Navigation />
      </BrowserRouter>
    );

    const playerLinks = container.querySelectorAll('a[href^="/players"]');
    expect(playerLinks.length).toBe(0);
  });

  it('hides sport templates navigation links for viewer role', () => {
    mockAuthContext.userRole = 'viewer';

    const { container } = render(
      <BrowserRouter>
        <Navigation />
      </BrowserRouter>
    );

    const sportTemplateLinks = container.querySelectorAll('a[href="/sport-templates"]');
    expect(sportTemplateLinks.length).toBe(0);
  });

  it('hides evaluators navigation links for viewer role', () => {
    mockAuthContext.userRole = 'viewer';

    const { container } = render(
      <BrowserRouter>
        <Navigation />
      </BrowserRouter>
    );

    const evaluatorLinks = container.querySelectorAll('a[href="/evaluators"]');
    expect(evaluatorLinks.length).toBe(0);
  });

  it('prevents locked viewer from opening event switcher list', () => {
    mockAuthContext.userRole = 'viewer';
    localStorage.setItem('viewerInviteEventContext', JSON.stringify({
      eventId: 'event-1',
      leagueId: 'league1',
      role: 'viewer',
      source: 'join-event',
      event: { id: 'event-1', name: 'Invite Event' },
      timestamp: new Date().toISOString(),
    }));

    render(
      <BrowserRouter>
        <Navigation />
      </BrowserRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /invite event/i }));
    expect(screen.queryByText('Switch Event')).not.toBeInTheDocument();
    expect(screen.queryByText('Other League Event')).not.toBeInTheDocument();
  });

  it('allows organizer to view full event switcher list', async () => {
    mockAuthContext.userRole = 'organizer';

    render(
      <BrowserRouter>
        <Navigation />
      </BrowserRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /invite event/i }));

    await waitFor(() => {
      expect(screen.getByText('Other League Event')).toBeInTheDocument();
    });
  });
});
