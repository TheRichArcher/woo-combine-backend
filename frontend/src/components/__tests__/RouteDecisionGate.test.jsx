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
    localStorage.clear();
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
      userRole: 'coach',
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

  it('recovers to pending join-event path for coach when context is missing', async () => {
    localStorage.setItem('pendingEventJoin', 'league-1/event-1/coach');
    useAuth.mockReturnValue({
      ...baseAuth,
      userRole: 'coach',
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
      expect(navigateMock).toHaveBeenCalledWith('/join-event/league-1/event-1/coach', { replace: true });
    });
    expect(navigateMock).not.toHaveBeenCalledWith('/coach', { replace: true });
  });

  it('redirects coach with league but no event to event-required screen', async () => {
    useAuth.mockReturnValue({
      ...baseAuth,
      userRole: 'coach',
      selectedLeagueId: 'league-1',
      leagues: [{ id: 'league-1', role: 'coach' }],
    });
    useEvent.mockReturnValue({
      ...baseEvent,
      selectedEvent: null,
      noLeague: false,
    });
    useLocation.mockReturnValue({ pathname: '/coach' });

    render(
      <RouteDecisionGate>
        <div data-testid="gate-child">coach content</div>
      </RouteDecisionGate>
    );

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/coach-event-required', { replace: true });
    });
  });

  it('redirects viewer with missing event context to /live-standings instead of /coach', async () => {
    useAuth.mockReturnValue({
      ...baseAuth,
      userRole: 'viewer',
      selectedLeagueId: '',
      leagues: [],
    });
    useEvent.mockReturnValue({
      ...baseEvent,
      selectedEvent: null,
      noLeague: true,
    });
    useLocation.mockReturnValue({ pathname: '/players' });

    render(
      <RouteDecisionGate>
        <div data-testid="gate-child">viewer protected content</div>
      </RouteDecisionGate>
    );

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/live-standings', { replace: true });
    });
    expect(navigateMock).not.toHaveBeenCalledWith('/coach', { replace: true });
  });

  it('does not redirect viewer away from /live-standings when selectedEvent exists without league', async () => {
    useAuth.mockReturnValue({
      ...baseAuth,
      userRole: 'viewer',
      selectedLeagueId: '',
      leagues: [],
    });
    useEvent.mockReturnValue({
      ...baseEvent,
      selectedEvent: { id: 'event-1', name: 'QR Event' },
      noLeague: true,
    });
    useLocation.mockReturnValue({ pathname: '/live-standings' });

    render(
      <RouteDecisionGate>
        <div data-testid="gate-child">viewer standings content</div>
      </RouteDecisionGate>
    );

    await waitFor(() => {
      expect(screen.getByTestId('gate-child')).toBeInTheDocument();
    });
    expect(navigateMock).not.toHaveBeenCalledWith('/coach', { replace: true });
  });
});
