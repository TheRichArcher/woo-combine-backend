import React from 'react';
import { render, waitFor } from '@testing-library/react';
import VerifyEmail from '../VerifyEmail';
import { useAuth, useLogout } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../firebase';
import { onAuthStateChanged } from 'firebase/auth';

jest.mock('../../components/layouts/WelcomeLayout', () => ({
  __esModule: true,
  default: ({ children }) => <div>{children}</div>,
}));

jest.mock('../../context/AuthContext', () => ({
  __esModule: true,
  useAuth: jest.fn(),
  useLogout: jest.fn(),
}));

jest.mock('react-router-dom', () => ({
  __esModule: true,
  useNavigate: jest.fn(),
}));

jest.mock('../../firebase', () => ({
  __esModule: true,
  auth: {
    currentUser: null,
  },
}));

jest.mock('firebase/auth', () => ({
  __esModule: true,
  sendEmailVerification: jest.fn(),
  onAuthStateChanged: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  authLogger: {
    debug: jest.fn(),
  },
}));

jest.mock('lucide-react', () => ({
  __esModule: true,
  ArrowLeft: () => <span>back</span>,
}));

describe('VerifyEmail auto-advance after verification', () => {
  const navigateMock = jest.fn();
  const setUserMock = jest.fn();
  const logoutMock = jest.fn();
  let consoleErrorSpy;

  const setMockLocation = (pathWithSearch) => {
    window.history.pushState({}, '', pathWithSearch);
  };

  const createVerifiedUser = () => ({
    emailVerified: true,
    reload: jest.fn().mockResolvedValue(undefined),
    getIdToken: jest.fn().mockResolvedValue('token'),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();

    useNavigate.mockReturnValue(navigateMock);
    useAuth.mockReturnValue({
      user: { email: 'test@example.com' },
      setUser: setUserMock,
    });
    useLogout.mockReturnValue(logoutMock);
    onAuthStateChanged.mockImplementation((_auth, callback) => {
      callback(auth.currentUser);
      return jest.fn();
    });
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  const getConsoleOutput = () =>
    consoleErrorSpy.mock.calls
      .flat()
      .map((entry) => (entry && typeof entry === 'object' && entry.stack ? entry.stack : String(entry)))
      .join('\n');

  it('auto-advances on /verify-email?fromFirebase=1 without pendingEventJoin', async () => {
    setMockLocation('/verify-email?fromFirebase=1');
    auth.currentUser = createVerifiedUser();

    render(<VerifyEmail />);

    await waitFor(() => {
      expect(setUserMock).toHaveBeenCalled();
    });
    expect(getConsoleOutput()).toMatch(/VerifyEmail\.jsx:\d+:\d+/);
  });

  it('auto-advances on /verify-email without pendingEventJoin', async () => {
    setMockLocation('/verify-email');
    auth.currentUser = createVerifiedUser();

    render(<VerifyEmail />);

    await waitFor(() => {
      expect(setUserMock).toHaveBeenCalled();
    });
    expect(getConsoleOutput()).toMatch(/VerifyEmail\.jsx:\d+:\d+/);
  });

  it('routes to pending join path on /verify-email?fromFirebase=1 when pendingEventJoin exists', async () => {
    setMockLocation('/verify-email?fromFirebase=1');
    localStorage.setItem('pendingEventJoin', 'league 1/event 2/viewer');
    auth.currentUser = createVerifiedUser();

    render(<VerifyEmail />);

    await waitFor(() => {
      expect(setUserMock).toHaveBeenCalled();
    });
    expect(getConsoleOutput()).toMatch(/VerifyEmail\.jsx:\d+:\d+/);
  });

  it('routes to pending join path on /verify-email when pendingEventJoin exists', async () => {
    setMockLocation('/verify-email');
    localStorage.setItem('pendingEventJoin', 'league-1/event-2/viewer');
    auth.currentUser = createVerifiedUser();

    render(<VerifyEmail />);

    await waitFor(() => {
      expect(setUserMock).toHaveBeenCalled();
    });
    expect(getConsoleOutput()).toMatch(/VerifyEmail\.jsx:\d+:\d+/);
  });

  it('re-checks and advances when cross-tab email_verified storage signal is received', async () => {
    setMockLocation('/verify-email?fromFirebase=1');
    const crossTabUser = {
      emailVerified: false,
      reload: jest.fn().mockResolvedValue(undefined),
      getIdToken: jest.fn().mockResolvedValue('token'),
    };
    auth.currentUser = crossTabUser;

    render(<VerifyEmail />);

    expect(setUserMock).not.toHaveBeenCalled();

    crossTabUser.emailVerified = true;
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'email_verified',
        newValue: 'true',
      })
    );

    await waitFor(() => {
      expect(setUserMock).toHaveBeenCalled();
    });
    expect(getConsoleOutput()).toMatch(/VerifyEmail\.jsx:\d+:\d+/);
  });
});
