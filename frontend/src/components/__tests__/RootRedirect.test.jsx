import React from 'react';
import { render, screen } from '@testing-library/react';
import RootRedirect from '../RootRedirect';
import { useAuth } from '../../context/AuthContext';

jest.mock('../../context/AuthContext', () => ({
  __esModule: true,
  useAuth: jest.fn(),
}));

jest.mock('react-router-dom', () => ({
  __esModule: true,
  Navigate: ({ to }) => <div data-testid="navigate-target">{to}</div>,
}));

jest.mock('../LoadingScreen', () => ({
  __esModule: true,
  default: () => <div data-testid="loading-screen">loading</div>,
}));

const baseAuth = {
  user: { uid: 'u1', emailVerified: true },
  userRole: 'viewer',
  initializing: false,
  authChecked: true,
  roleChecked: true,
};

describe('RootRedirect', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('routes directly to pending invite join path from root', () => {
    localStorage.setItem('pendingEventJoin', 'league-1/event-1/viewer');
    useAuth.mockReturnValue({
      ...baseAuth,
      userRole: null,
    });

    render(<RootRedirect />);

    expect(screen.getByTestId('navigate-target')).toHaveTextContent('/join-event/league-1/event-1/viewer');
    expect(screen.queryByText('/welcome')).not.toBeInTheDocument();
    expect(screen.queryByText('/select-role')).not.toBeInTheDocument();
  });

  it('routes role-null users without pending invite to select-role', () => {
    useAuth.mockReturnValue({
      ...baseAuth,
      userRole: null,
    });

    render(<RootRedirect />);

    expect(screen.getByTestId('navigate-target')).toHaveTextContent('/select-role');
  });
});
