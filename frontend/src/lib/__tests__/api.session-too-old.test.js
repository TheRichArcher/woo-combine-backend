describe('api 401 handling for stale sessions', () => {
  const makeHarness = ({ currentUser }) => {
    jest.resetModules();

    const responseUse = jest.fn();
    const requestUse = jest.fn();
    const apiInstance = {
      interceptors: {
        request: { use: requestUse },
        response: { use: responseUse }
      }
    };

    const mockSignOut = jest.fn(() => Promise.resolve());
    const mockAuth = { currentUser };

    jest.doMock('axios', () => ({
      __esModule: true,
      default: { create: jest.fn(() => apiInstance) }
    }));
    jest.doMock('../../firebase', () => ({ auth: mockAuth }));
    jest.doMock('firebase/auth', () => ({ signOut: mockSignOut }));
    jest.doMock('../../utils/logger', () => ({
      apiLogger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      }
    }));

    require('../api.js');

    // First response interceptor is retry handler; second is auth/error handling.
    const authErrorHandler = responseUse.mock.calls[1][1];
    return { authErrorHandler, mockSignOut };
  };

  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/dashboard?tab=leagues');
    window.__wcSessionExpiredShown = false;
  });

  test('401 "Session too old" forces re-auth flow', async () => {
    const { authErrorHandler, mockSignOut } = makeHarness({
      currentUser: { uid: 'user-1' }
    });

    const expiredEventListener = jest.fn();
    window.addEventListener('wc-session-expired', expiredEventListener);

    localStorage.setItem('selectedLeagueId', 'league-1');
    localStorage.setItem('selectedEventId', 'event-1');
    localStorage.setItem('selectedEvent', '{"id":"event-1"}');
    localStorage.setItem('userRole', 'coach');

    const err = {
      response: { status: 401, data: { detail: 'Session too old' } },
      config: {
        url: '/leagues/me',
        headers: {},
        _authGeneration: 0,
        _authUidSnapshot: 'user-1'
      }
    };

    await expect(authErrorHandler(err)).rejects.toBe(err);

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('selectedLeagueId')).toBeNull();
    expect(localStorage.getItem('selectedEventId')).toBeNull();
    expect(localStorage.getItem('selectedEvent')).toBeNull();
    expect(localStorage.getItem('userRole')).toBeNull();
    expect(localStorage.getItem('postLoginRedirect')).toBe('/dashboard?tab=leagues');
    expect(window.location.pathname + window.location.search).toBe('/login?reason=session_expired');
    expect(expiredEventListener).toHaveBeenCalledTimes(1);

    window.removeEventListener('wc-session-expired', expiredEventListener);
  });

  test('stale pre-login "Session too old" response is ignored for logged-in user', async () => {
    const { authErrorHandler, mockSignOut } = makeHarness({
      currentUser: { uid: 'user-1' }
    });

    const err = {
      response: { status: 401, data: { detail: 'Session too old' } },
      // Represents a request started before login/user hydration.
      config: { url: '/leagues/me', headers: {}, _authGeneration: 0, _authUidSnapshot: null }
    };

    await expect(authErrorHandler(err)).rejects.toBe(err);
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(window.location.pathname + window.location.search).toBe('/dashboard?tab=leagues');
  });

  test('other 401s do not force sign-out when auth user exists', async () => {
    const { authErrorHandler, mockSignOut } = makeHarness({
      currentUser: { uid: 'user-1' }
    });

    const err = {
      response: { status: 401, data: { detail: 'Access denied' } },
      config: { url: '/events/abc', headers: {}, _did401Refresh: true }
    };

    await expect(authErrorHandler(err)).rejects.toBe(err);
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(window.location.pathname + window.location.search).toBe('/dashboard?tab=leagues');
  });
});
