import { render, screen } from '@testing-library/react';
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

jest.mock('../../context/AuthContext', () => ({
  __esModule: true,
  AuthProvider: ({ children }) => children,
  useAuth: () => mockAuthContext,
  useLogout: () => jest.fn(),
}));

jest.mock('../../context/EventContext', () => ({
  __esModule: true,
  EventProvider: ({ children }) => children,
  useEvent: () => ({ events: [], selectedEvent: null }),
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
});
