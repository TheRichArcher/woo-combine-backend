import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

const mockNavigate = jest.fn();
const mockGetLocation = () => ({
  pathname: globalThis.location?.pathname || '/',
  search: globalThis.location?.search || '',
  hash: '',
  state: null,
});

jest.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }) => children,
  useNavigate: () => mockNavigate,
  useLocation: () => mockGetLocation(),
}));

// Mock firebase before anything imports it
jest.mock('../../firebase', () => ({
  auth: {
    currentUser: null,
    onAuthStateChanged: jest.fn((callback) => {
      // Simulate no user signed in
      callback(null);
      return jest.fn(); // unsubscribe
    }),
  },
  db: {},
}));

jest.mock('../../lib/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn().mockResolvedValue({ data: {} }),
    post: jest.fn().mockResolvedValue({ data: {} }),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  },
}));

jest.mock('../../lib/leagues', () => ({
  __esModule: true,
  getMyLeagues: jest.fn().mockResolvedValue([]),
  createLeague: jest.fn(),
}));

jest.mock('../../constants/drillTemplates', () => ({
  __esModule: true,
  fetchSchemas: jest.fn().mockResolvedValue([]),
}));

jest.mock('../ToastContext', () => ({
  __esModule: true,
  ToastProvider: ({ children }) => children,
  useToast: () => ({ showToast: jest.fn() }),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  onAuthStateChanged: jest.fn((auth, callback) => {
    callback(null);
    return jest.fn();
  }),
  signOut: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  GoogleAuthProvider: jest.fn(),
  signInWithPopup: jest.fn(),
}));

import { AuthProvider, useAuth } from '../AuthContext';
import { EventProvider, useEvent } from '../EventContext';
import api from '../../lib/api';
import { onAuthStateChanged } from 'firebase/auth';
import { getMyLeagues } from '../../lib/leagues';

// Test component to access auth context
const TestComponent = () => {
  const { user, userRole } = useAuth();

  return (
    <div>
      <div data-testid="user">{user ? user.uid : 'no-user'}</div>
      <div data-testid="role">{userRole || 'no-role'}</div>
    </div>
  );
};

const RefreshContextHarness = () => {
  const { selectedLeagueId, refreshLeagues } = useAuth();
  const { selectedEvent } = useEvent();

  return (
    <div>
      <div data-testid="selected-league">{selectedLeagueId || 'none'}</div>
      <div data-testid="selected-event">{selectedEvent?.id || 'none'}</div>
      <button onClick={() => refreshLeagues()} type="button">
        refresh
      </button>
    </div>
  );
};

const RefreshWithRoleOverrideHarness = () => {
  const { refreshLeagues } = useAuth();
  return (
    <button onClick={() => refreshLeagues({ roleOverride: 'viewer' })} type="button">
      refresh-with-role-override
    </button>
  );
};

const LogoutHarness = () => {
  const { logout } = useAuth();
  return (
    <button onClick={() => logout()} type="button">
      logout
    </button>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('provides auth context to children', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </BrowserRouter>
    );

    // Context should be available (no error thrown)
    expect(screen.getByTestId('user')).toBeInTheDocument();
    expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    expect(screen.getByTestId('role')).toHaveTextContent('no-role');
  });

  it('preserves selected league and event after transient leagues refresh failure', async () => {
    const mockUser = {
      uid: 'user-1',
      email: 'viewer@example.com',
      emailVerified: true,
      getIdToken: jest.fn().mockResolvedValue('token'),
      stsTokenManager: { expirationTime: Date.now() + 60 * 60 * 1000 },
      multiFactor: { enrolledFactors: [] },
    };

    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(mockUser);
      return jest.fn();
    });

    localStorage.setItem('userRole', 'viewer');
    localStorage.setItem('userEmail', mockUser.email);
    localStorage.setItem('selectedLeagueId', 'league-1');
    localStorage.setItem('selectedEvent', JSON.stringify({
      id: 'event-1',
      league_id: 'league-1',
      name: 'Joined Event',
    }));

    const unauthorizedError = { response: { status: 401 }, message: 'Unauthorized' };
    getMyLeagues.mockRejectedValue(unauthorizedError);

    api.get.mockImplementation((url) => {
      if (url === '/leagues/me') {
        return Promise.reject(unauthorizedError);
      }
      if (url === '/leagues/league-1/events') {
        return Promise.resolve({
          data: {
            events: [{ id: 'event-1', league_id: 'league-1', name: 'Joined Event' }],
          },
        });
      }
      if (url === '/users/me') {
        return Promise.resolve({ data: { role: 'viewer' } });
      }
      return Promise.resolve({ data: {} });
    });

    render(
      <BrowserRouter>
        <AuthProvider>
          <EventProvider>
            <RefreshContextHarness />
          </EventProvider>
        </AuthProvider>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('selected-league')).toHaveTextContent('league-1');
      expect(screen.getByTestId('selected-event')).toHaveTextContent('event-1');
    });

    fireEvent.click(screen.getByRole('button', { name: 'refresh' }));

    await waitFor(() => {
      expect(getMyLeagues).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByTestId('selected-league')).toHaveTextContent('league-1');
      expect(screen.getByTestId('selected-event')).toHaveTextContent('event-1');
    });
  });

  it('keeps pendingEventJoin priority over postLoginTarget after login', async () => {
    const mockUser = {
      uid: 'user-1',
      email: 'coach@example.com',
      emailVerified: true,
      getIdToken: jest.fn().mockResolvedValue('token'),
      stsTokenManager: { expirationTime: Date.now() + 60 * 60 * 1000 },
      multiFactor: { enrolledFactors: [] },
    };

    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(mockUser);
      return jest.fn();
    });

    window.history.replaceState({}, '', '/login?reason=session_expired');
    localStorage.setItem('pendingEventJoin', 'league-1/event-1/coach');
    localStorage.setItem('postLoginTarget', '/analytics?tab=team');

    render(
      <BrowserRouter>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/join-event/league-1/event-1/coach', { replace: true });
    });
    expect(mockNavigate).not.toHaveBeenCalledWith('/analytics?tab=team', { replace: true });
  });

  it('allows league refresh with role override when pre-join userRole is null', async () => {
    const mockUser = {
      uid: 'user-role-override',
      email: 'viewer-override@example.com',
      emailVerified: true,
      getIdToken: jest.fn().mockResolvedValue('token'),
      stsTokenManager: { expirationTime: Date.now() + 60 * 60 * 1000 },
      multiFactor: { enrolledFactors: [] },
    };

    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(mockUser);
      return jest.fn();
    });

    window.history.replaceState({}, '', '/join-event/league-1/event-1/viewer');
    api.get.mockImplementation((url) => {
      if (url === '/users/me') {
        return Promise.resolve({ data: { role: null, pending_invite: 'league-1/event-1/viewer' } });
      }
      return Promise.resolve({ data: {} });
    });
    getMyLeagues.mockResolvedValue([{ id: 'league-1', role: 'viewer', name: 'Viewer League' }]);

    render(
      <BrowserRouter>
        <AuthProvider>
          <RefreshWithRoleOverrideHarness />
        </AuthProvider>
      </BrowserRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'refresh-with-role-override' }));

    await waitFor(() => {
      expect(getMyLeagues).toHaveBeenCalled();
    });
  });

  it('uses postLoginTarget when no pendingEventJoin exists', async () => {
    const mockUser = {
      uid: 'user-2',
      email: 'viewer@example.com',
      emailVerified: true,
      getIdToken: jest.fn().mockResolvedValue('token'),
      stsTokenManager: { expirationTime: Date.now() + 60 * 60 * 1000 },
      multiFactor: { enrolledFactors: [] },
    };

    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(mockUser);
      return jest.fn();
    });

    window.history.replaceState({}, '', '/login?reason=session_expired');
    localStorage.setItem('postLoginTarget', '/live-standings?event=abc');
    api.get.mockImplementation((url) => {
      if (url === '/users/me') {
        return Promise.resolve({ data: { role: 'viewer' } });
      }
      return Promise.resolve({ data: {} });
    });

    render(
      <BrowserRouter>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/live-standings?event=abc', { replace: true });
    });
    expect(localStorage.getItem('postLoginTarget')).toBeNull();
  });

  it('never resumes to /login and falls back to /dashboard', async () => {
    const mockUser = {
      uid: 'user-3',
      email: 'viewer2@example.com',
      emailVerified: true,
      getIdToken: jest.fn().mockResolvedValue('token'),
      stsTokenManager: { expirationTime: Date.now() + 60 * 60 * 1000 },
      multiFactor: { enrolledFactors: [] },
    };

    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(mockUser);
      return jest.fn();
    });

    window.history.replaceState({}, '', '/login?reason=session_expired');
    localStorage.setItem('postLoginTarget', '/login');
    api.get.mockImplementation((url) => {
      if (url === '/users/me') {
        return Promise.resolve({ data: { role: 'viewer' } });
      }
      return Promise.resolve({ data: {} });
    });

    render(
      <BrowserRouter>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    });
    expect(mockNavigate).not.toHaveBeenCalledWith('/login', { replace: true });
    expect(localStorage.getItem('postLoginTarget')).toBeNull();
  });

  it('ignores unsafe postLoginTarget values and falls back to /dashboard', async () => {
    const mockUser = {
      uid: 'user-unsafe-target',
      email: 'unsafe-target@example.com',
      emailVerified: true,
      getIdToken: jest.fn().mockResolvedValue('token'),
      stsTokenManager: { expirationTime: Date.now() + 60 * 60 * 1000 },
      multiFactor: { enrolledFactors: [] },
    };

    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(mockUser);
      return jest.fn();
    });

    window.history.replaceState({}, '', '/login');
    localStorage.setItem('postLoginTarget', 'https://evil.example/steal-session');
    api.get.mockImplementation((url) => {
      if (url === '/users/me') {
        return Promise.resolve({ data: { role: 'viewer' } });
      }
      return Promise.resolve({ data: {} });
    });

    render(
      <BrowserRouter>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    });
    expect(mockNavigate).not.toHaveBeenCalledWith('https://evil.example/steal-session', { replace: true });
    expect(localStorage.getItem('postLoginTarget')).toBeNull();
  });

  it('does not trust cached role from another identity when profile lookup fails', async () => {
    const mockUser = {
      uid: 'user-4',
      email: 'actual@example.com',
      emailVerified: true,
      getIdToken: jest.fn().mockResolvedValue('token'),
      stsTokenManager: { expirationTime: Date.now() + 60 * 60 * 1000 },
      multiFactor: { enrolledFactors: [] },
    };

    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(mockUser);
      return jest.fn();
    });

    // Simulate stale cached role from a different account.
    localStorage.setItem('userRole', 'coach');
    localStorage.setItem('userEmail', 'different@example.com');

    api.get.mockImplementation((url) => {
      if (url === '/users/me') {
        return Promise.reject(new Error('profile lookup failed'));
      }
      return Promise.resolve({ data: {} });
    });

    render(
      <BrowserRouter>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/select-role');
    });
    expect(screen.getByTestId('role')).toHaveTextContent('no-role');
  });

  it('does not trust same-identity cached role when backend role lookup fails', async () => {
    const mockUser = {
      uid: 'user-5',
      email: 'cached@example.com',
      emailVerified: true,
      getIdToken: jest.fn().mockResolvedValue('token'),
      stsTokenManager: { expirationTime: Date.now() + 60 * 60 * 1000 },
      multiFactor: { enrolledFactors: [] },
    };

    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(mockUser);
      return jest.fn();
    });

    localStorage.setItem('userRole', 'coach');
    localStorage.setItem('userEmail', mockUser.email);

    api.get.mockImplementation((url) => {
      if (url === '/users/me') {
        return Promise.reject(new Error('backend unavailable'));
      }
      return Promise.resolve({ data: {} });
    });

    render(
      <BrowserRouter>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/select-role');
    });
    expect(screen.getByTestId('role')).toHaveTextContent('no-role');
  });

  it('routes to join flow when backend returns pending invite with null role', async () => {
    const mockUser = {
      uid: 'user-6',
      email: 'invited-viewer@example.com',
      emailVerified: true,
      getIdToken: jest.fn().mockResolvedValue('token'),
      stsTokenManager: { expirationTime: Date.now() + 60 * 60 * 1000 },
      multiFactor: { enrolledFactors: [] },
    };

    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(mockUser);
      return jest.fn();
    });

    window.history.replaceState({}, '', '/dashboard');
    api.get.mockImplementation((url) => {
      if (url === '/users/me') {
        return Promise.resolve({ data: { role: null, pending_invite: 'league-1/event-1/viewer' } });
      }
      return Promise.resolve({ data: {} });
    });

    render(
      <BrowserRouter>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/join-event/league-1/event-1/viewer', { replace: true });
    });
    expect(mockNavigate).not.toHaveBeenCalledWith('/select-role');
  });

  it('routes to select-role when role is null and no pending invite exists', async () => {
    const mockUser = {
      uid: 'user-7',
      email: 'no-invite@example.com',
      emailVerified: true,
      getIdToken: jest.fn().mockResolvedValue('token'),
      stsTokenManager: { expirationTime: Date.now() + 60 * 60 * 1000 },
      multiFactor: { enrolledFactors: [] },
    };

    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(mockUser);
      return jest.fn();
    });

    window.history.replaceState({}, '', '/dashboard');
    api.get.mockImplementation((url) => {
      if (url === '/users/me') {
        return Promise.resolve({ data: { role: null, pending_invite: null } });
      }
      return Promise.resolve({ data: {} });
    });

    render(
      <BrowserRouter>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/select-role');
    });
    expect(mockNavigate).not.toHaveBeenCalledWith('/join-event/league-1/event-1/viewer', { replace: true });
  });

  it('clears viewer invite context on logout', async () => {
    localStorage.setItem('viewerInviteEventContext', JSON.stringify({
      eventId: 'event-1',
      leagueId: 'league-1',
      role: 'viewer',
      source: 'join-event',
    }));
    localStorage.setItem('pendingEventJoin', 'league-1/event-1/viewer');

    render(
      <BrowserRouter>
        <AuthProvider>
          <LogoutHarness />
        </AuthProvider>
      </BrowserRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'logout' }));

    await waitFor(() => {
      expect(localStorage.getItem('viewerInviteEventContext')).toBeNull();
      expect(localStorage.getItem('pendingEventJoin')).toBeNull();
    });
  });
});
