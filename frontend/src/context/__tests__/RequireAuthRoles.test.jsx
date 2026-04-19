import React from 'react';
import { render, screen } from '@testing-library/react';
import RequireAuth from '../RequireAuth';
import { useAuth } from '../AuthContext';
import api from '../../lib/api';

jest.mock('../AuthContext', () => ({
  __esModule: true,
  useAuth: jest.fn(),
}));

jest.mock('../../lib/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

jest.mock('react-router-dom', () => ({
  __esModule: true,
  Navigate: ({ to }) => <div data-testid="navigate-target">{to}</div>,
  useLocation: () => ({ pathname: '/players' }),
}));

jest.mock('../../components/LoadingScreen', () => ({
  __esModule: true,
  default: () => <div data-testid="loading-screen">loading</div>,
}));

const baseAuth = {
  user: { uid: 'u1', emailVerified: true },
  initializing: false,
  authChecked: true,
  roleChecked: true,
};

function LiveEntryPlayersFetchProbe() {
  React.useEffect(() => {
    api.get('/players?event_id=test-event');
  }, []);

  return <div data-testid="live-entry-probe">live entry probe</div>;
}

describe('RequireAuth role enforcement', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('prioritizes pending invite join flow over no-role redirect', () => {
    localStorage.setItem('pendingEventJoin', 'league-1/event-1/viewer');
    useAuth.mockReturnValue({ ...baseAuth, userRole: null });

    render(
      <RequireAuth>
        <div data-testid="protected-page">protected</div>
      </RequireAuth>
    );

    expect(screen.getByTestId('navigate-target')).toHaveTextContent('/join-event/league-1/event-1/viewer');
  });

  it('suppresses no-role redirect while invite join hydration is in progress', () => {
    localStorage.setItem('inviteJoinInProgress', '1');
    useAuth.mockReturnValue({ ...baseAuth, userRole: null });

    render(
      <RequireAuth>
        <div data-testid="protected-page">protected</div>
      </RequireAuth>
    );

    expect(screen.getByTestId('loading-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('navigate-target')).not.toBeInTheDocument();
  });

  it('allows organizer on staff-only routes', () => {
    useAuth.mockReturnValue({ ...baseAuth, userRole: 'organizer' });

    render(
      <RequireAuth allowedRoles={['organizer', 'coach']}>
        <div data-testid="staff-page">staff content</div>
      </RequireAuth>
    );

    expect(screen.getByTestId('staff-page')).toBeInTheDocument();
  });

  it('allows coach on staff-only routes', () => {
    useAuth.mockReturnValue({ ...baseAuth, userRole: 'coach' });

    render(
      <RequireAuth allowedRoles={['organizer', 'coach']}>
        <div data-testid="staff-page">staff content</div>
      </RequireAuth>
    );

    expect(screen.getByTestId('staff-page')).toBeInTheDocument();
  });

  it('blocks viewer on staff-only routes', () => {
    useAuth.mockReturnValue({ ...baseAuth, userRole: 'viewer' });

    render(
      <RequireAuth allowedRoles={['organizer', 'coach']}>
        <div data-testid="staff-page">staff content</div>
      </RequireAuth>
    );

    expect(screen.getByTestId('navigate-target')).toHaveTextContent('/dashboard');
  });

  it('blocks viewer before live-entry players fetch effect can run', () => {
    api.get.mockClear();
    useAuth.mockReturnValue({ ...baseAuth, userRole: 'viewer' });

    render(
      <RequireAuth allowedRoles={['organizer', 'coach']}>
        <LiveEntryPlayersFetchProbe />
      </RequireAuth>
    );

    expect(screen.getByTestId('navigate-target')).toHaveTextContent('/dashboard');
    expect(api.get).not.toHaveBeenCalled();
  });

  it('enforces /drafts access for organizer/coach and blocks viewer', () => {
    useAuth.mockReturnValue({ ...baseAuth, userRole: 'organizer' });
    const { rerender } = render(
      <RequireAuth allowedRoles={['organizer', 'coach']}>
        <div data-testid="drafts-page">drafts</div>
      </RequireAuth>
    );

    expect(screen.getByTestId('drafts-page')).toBeInTheDocument();

    useAuth.mockReturnValue({ ...baseAuth, userRole: 'coach' });
    rerender(
      <RequireAuth allowedRoles={['organizer', 'coach']}>
        <div data-testid="drafts-page">drafts</div>
      </RequireAuth>
    );
    expect(screen.getByTestId('drafts-page')).toBeInTheDocument();

    useAuth.mockReturnValue({ ...baseAuth, userRole: 'viewer' });
    rerender(
      <RequireAuth allowedRoles={['organizer', 'coach']}>
        <div data-testid="drafts-page">drafts</div>
      </RequireAuth>
    );
    expect(screen.getByTestId('navigate-target')).toHaveTextContent('/dashboard');
  });

  it('enforces /event-sharing access for organizer and blocks coach/viewer', () => {
    useAuth.mockReturnValue({ ...baseAuth, userRole: 'organizer' });
    const { rerender } = render(
      <RequireAuth allowedRoles={['organizer']}>
        <div data-testid="event-sharing-page">event sharing</div>
      </RequireAuth>
    );

    expect(screen.getByTestId('event-sharing-page')).toBeInTheDocument();

    useAuth.mockReturnValue({ ...baseAuth, userRole: 'coach' });
    rerender(
      <RequireAuth allowedRoles={['organizer']}>
        <div data-testid="event-sharing-page">event sharing</div>
      </RequireAuth>
    );
    expect(screen.getByTestId('navigate-target')).toHaveTextContent('/dashboard');

    useAuth.mockReturnValue({ ...baseAuth, userRole: 'viewer' });
    rerender(
      <RequireAuth allowedRoles={['organizer']}>
        <div data-testid="event-sharing-page">event sharing</div>
      </RequireAuth>
    );
    expect(screen.getByTestId('navigate-target')).toHaveTextContent('/dashboard');
  });

  it('enforces /onboarding/event access for organizer and blocks coach/viewer', () => {
    useAuth.mockReturnValue({ ...baseAuth, userRole: 'organizer' });
    const { rerender } = render(
      <RequireAuth allowedRoles={['organizer']}>
        <div data-testid="onboarding-event-page">onboarding event</div>
      </RequireAuth>
    );

    expect(screen.getByTestId('onboarding-event-page')).toBeInTheDocument();

    useAuth.mockReturnValue({ ...baseAuth, userRole: 'coach' });
    rerender(
      <RequireAuth allowedRoles={['organizer']}>
        <div data-testid="onboarding-event-page">onboarding event</div>
      </RequireAuth>
    );
    expect(screen.getByTestId('navigate-target')).toHaveTextContent('/dashboard');

    useAuth.mockReturnValue({ ...baseAuth, userRole: 'viewer' });
    rerender(
      <RequireAuth allowedRoles={['organizer']}>
        <div data-testid="onboarding-event-page">onboarding event</div>
      </RequireAuth>
    );
    expect(screen.getByTestId('navigate-target')).toHaveTextContent('/dashboard');
  });

  it('enforces /draft/create access for organizer/coach and blocks viewer', () => {
    useAuth.mockReturnValue({ ...baseAuth, userRole: 'organizer' });
    const { rerender } = render(
      <RequireAuth allowedRoles={['organizer', 'coach']}>
        <div data-testid="draft-create-page">draft create</div>
      </RequireAuth>
    );
    expect(screen.getByTestId('draft-create-page')).toBeInTheDocument();

    useAuth.mockReturnValue({ ...baseAuth, userRole: 'coach' });
    rerender(
      <RequireAuth allowedRoles={['organizer', 'coach']}>
        <div data-testid="draft-create-page">draft create</div>
      </RequireAuth>
    );
    expect(screen.getByTestId('draft-create-page')).toBeInTheDocument();

    useAuth.mockReturnValue({ ...baseAuth, userRole: 'viewer' });
    rerender(
      <RequireAuth allowedRoles={['organizer', 'coach']}>
        <div data-testid="draft-create-page">draft create</div>
      </RequireAuth>
    );
    expect(screen.getByTestId('navigate-target')).toHaveTextContent('/dashboard');
  });

  it('enforces /draft/:draftId/setup access for organizer/coach and blocks viewer', () => {
    useAuth.mockReturnValue({ ...baseAuth, userRole: 'organizer' });
    const { rerender } = render(
      <RequireAuth allowedRoles={['organizer', 'coach']}>
        <div data-testid="draft-setup-page">draft setup</div>
      </RequireAuth>
    );
    expect(screen.getByTestId('draft-setup-page')).toBeInTheDocument();

    useAuth.mockReturnValue({ ...baseAuth, userRole: 'coach' });
    rerender(
      <RequireAuth allowedRoles={['organizer', 'coach']}>
        <div data-testid="draft-setup-page">draft setup</div>
      </RequireAuth>
    );
    expect(screen.getByTestId('draft-setup-page')).toBeInTheDocument();

    useAuth.mockReturnValue({ ...baseAuth, userRole: 'viewer' });
    rerender(
      <RequireAuth allowedRoles={['organizer', 'coach']}>
        <div data-testid="draft-setup-page">draft setup</div>
      </RequireAuth>
    );
    expect(screen.getByTestId('navigate-target')).toHaveTextContent('/dashboard');
  });

  it('enforces /draft/:draftId/live access for organizer/coach and blocks viewer', () => {
    useAuth.mockReturnValue({ ...baseAuth, userRole: 'organizer' });
    const { rerender } = render(
      <RequireAuth allowedRoles={['organizer', 'coach']}>
        <div data-testid="draft-live-page">draft live</div>
      </RequireAuth>
    );
    expect(screen.getByTestId('draft-live-page')).toBeInTheDocument();

    useAuth.mockReturnValue({ ...baseAuth, userRole: 'coach' });
    rerender(
      <RequireAuth allowedRoles={['organizer', 'coach']}>
        <div data-testid="draft-live-page">draft live</div>
      </RequireAuth>
    );
    expect(screen.getByTestId('draft-live-page')).toBeInTheDocument();

    useAuth.mockReturnValue({ ...baseAuth, userRole: 'viewer' });
    rerender(
      <RequireAuth allowedRoles={['organizer', 'coach']}>
        <div data-testid="draft-live-page">draft live</div>
      </RequireAuth>
    );
    expect(screen.getByTestId('navigate-target')).toHaveTextContent('/dashboard');
  });
});
