import React from 'react';
import { render, screen } from '@testing-library/react';
import RequireAuth from '../RequireAuth';
import { useAuth } from '../AuthContext';

jest.mock('../AuthContext', () => ({
  __esModule: true,
  useAuth: jest.fn(),
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

describe('RequireAuth role enforcement', () => {
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
