import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import RouteDecisionGate from '../RouteDecisionGate';
import { useAuth } from '../../context/AuthContext';
import { useEvent } from '../../context/EventContext';
import { useLocation, useNavigate } from 'react-router-dom';

jest.mock('../../context/AuthContext', () => ({
  __esModule: true,
  useAuth: jest.fn(),
}));

jest.mock('../../context/EventContext', () => ({
  __esModule: true,
  useEvent: jest.fn(),
}));

jest.mock('react-router-dom', () => ({
  __esModule: true,
  useLocation: jest.fn(),
  useNavigate: jest.fn(),
}));

jest.mock('../LoadingScreen', () => ({
  __esModule: true,
  default: () => <div data-testid="loading-screen">loading</div>,
}));

const baseAuth = {
  user: { uid: 'u1', emailVerified: true },
  userRole: 'viewer',
  authChecked: true,
  roleChecked: true,
  initializing: false,
  selectedLeagueId: 'league-1',
  leagues: [],
  leaguesLoading: false,
};

const baseEvent = {
  selectedEvent: { id: 'event-1', name: 'QR Event' },
  eventsLoaded: true,
  loading: false,
  noLeague: true,
};

describe('RouteDecisionGate QR onboarding guard', () => {
  const navigateMock = jest.fn();

  beforeEach(() => {
    navigateMock.mockClear();
    useNavigate.mockReturnValue(navigateMock);
    useLocation.mockReturnValue({ pathname: '/live-standings' });
    useAuth.mockReturnValue(baseAuth);
    useEvent.mockReturnValue(baseEvent);
  });

  it('renders route content when selected event and league are already set', async () => {
    render(
      <RouteDecisionGate>
        <div data-testid="gate-child">live standings content</div>
      </RouteDecisionGate>
    );

    await waitFor(() => {
      expect(screen.getByTestId('gate-child')).toBeInTheDocument();
    });
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('still redirects to /coach when league context is missing', async () => {
    useAuth.mockReturnValue({
      ...baseAuth,
      selectedLeagueId: '',
      leagues: [],
    });
    useEvent.mockReturnValue({
      ...baseEvent,
      selectedEvent: null,
      noLeague: true,
    });

    render(
      <RouteDecisionGate>
        <div data-testid="gate-child">protected content</div>
      </RouteDecisionGate>
    );

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/coach', { replace: true });
    });
  });
});
