import React from 'react';
import { render, waitFor } from '@testing-library/react';
import Welcome from '../Welcome';
import { useAuth } from '../../context/AuthContext';

const mockNavigate = jest.fn();

jest.mock('../../context/AuthContext', () => ({
  __esModule: true,
  useAuth: jest.fn(),
}));

jest.mock('react-router-dom', () => ({
  __esModule: true,
  Link: ({ children }) => <span>{children}</span>,
  useNavigate: () => mockNavigate,
}));

jest.mock('../../components/layouts/WelcomeLayout', () => ({
  __esModule: true,
  default: ({ children }) => <div>{children}</div>,
}));

jest.mock('../../components/ui/Button', () => ({
  __esModule: true,
  default: ({ children, onClick }) => <button onClick={onClick}>{children}</button>,
}));

describe('Welcome invite-first routing', () => {
  beforeEach(() => {
    localStorage.clear();
    mockNavigate.mockClear();
  });

  it('redirects logged-in role-null invited users to join-event and not select-role', async () => {
    localStorage.setItem('pendingEventJoin', 'league-1/event-1/viewer');
    useAuth.mockReturnValue({
      user: { uid: 'u1', emailVerified: true },
      userRole: null,
      initializing: false,
      status: 'ROLE_REQUIRED',
    });

    render(<Welcome />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/join-event/league-1/event-1/viewer', { replace: true });
    });
    expect(mockNavigate).not.toHaveBeenCalledWith('/select-role', { replace: true });
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });
});
