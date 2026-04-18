import React from 'react';
import { render, screen } from '@testing-library/react';
import CoachDashboard from '../CoachDashboard';
import { useAuth } from '../../context/AuthContext';
import { useEvent } from '../../context/EventContext';

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
  useNavigate: () => jest.fn(),
}));

jest.mock('../../context/LeagueFallback', () => ({
  __esModule: true,
  default: () => <div data-testid="league-fallback">league fallback</div>,
}));

jest.mock('../../components/CreateEventModal', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../components/EditEventModal', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../components/DeleteEventFlow', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

describe('CoachDashboard viewer fallback behavior', () => {
  beforeEach(() => {
    useEvent.mockReturnValue({
      events: [],
      selectedEvent: null,
      setSelectedEvent: jest.fn(),
      noLeague: true,
      setEvents: jest.fn(),
    });
  });

  it('does not render LeagueFallback for viewer when context is missing', () => {
    useAuth.mockReturnValue({ userRole: 'viewer' });

    render(<CoachDashboard />);

    expect(screen.getByText("We couldn't load your event")).toBeInTheDocument();
    expect(screen.queryByTestId('league-fallback')).not.toBeInTheDocument();
    expect(screen.queryByText('No League Selected')).not.toBeInTheDocument();
  });

  it('still renders LeagueFallback for coach when noLeague=true', () => {
    useAuth.mockReturnValue({ userRole: 'coach' });

    render(<CoachDashboard />);

    expect(screen.getByTestId('league-fallback')).toBeInTheDocument();
  });
});
