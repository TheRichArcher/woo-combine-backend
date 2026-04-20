import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import CheckIn from '../CheckIn';
import { useAuth } from '../../context/AuthContext';
import { useEvent } from '../../context/EventContext';
import api from '../../lib/api';

jest.mock('../../context/AuthContext', () => ({
  __esModule: true,
  useAuth: jest.fn(),
}));

jest.mock('../../context/EventContext', () => ({
  __esModule: true,
  useEvent: jest.fn(),
}));

jest.mock('../../context/ToastContext', () => ({
  __esModule: true,
  useToast: () => ({
    showError: jest.fn(),
    showSuccess: jest.fn(),
    showInfo: jest.fn(),
  }),
}));

jest.mock('../../lib/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    put: jest.fn(),
  },
}));

jest.mock('../../components/Players/AddPlayerModal', () => ({
  __esModule: true,
  default: ({ onSave, onClose }) => (
    <div data-testid="add-player-modal">
      <button
        type="button"
        onClick={() => {
          onSave?.();
          onClose?.();
        }}
      >
        Complete Add Player
      </button>
    </div>
  ),
}));

describe('CheckIn walk-up player CTA', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useEvent.mockReturnValue({
      selectedEvent: { id: 'event-1', name: 'Spring Combine' },
    });
  });

  function mockApiGetForPermissionsAndPlayers({
    membership = { role: 'organizer', canWrite: true },
    event = { isLocked: false },
    playerResponses = [[]],
  } = {}) {
    const queue = [...playerResponses];
    api.get.mockImplementation((url) => {
      if (url.startsWith('/players?event_id=event-1')) {
        return Promise.resolve({ data: queue.shift() || [] });
      }
      if (url === '/leagues/league-1/members/u1') {
        return Promise.resolve({ data: membership });
      }
      if (url === '/leagues/league-1/events/event-1') {
        return Promise.resolve({ data: event });
      }
      return Promise.resolve({ data: {} });
    });
  }

  it('shows Add Walk-Up Player button for organizer', async () => {
    useAuth.mockReturnValue({
      user: { uid: 'u1' },
      userRole: 'organizer',
      selectedLeagueId: 'league-1',
    });
    mockApiGetForPermissionsAndPlayers();

    render(<CheckIn />);

    expect(await screen.findByRole('button', { name: /add walk-up player/i })).toBeInTheDocument();
  });

  it('shows Add Walk-Up Player button for writable coach', async () => {
    useAuth.mockReturnValue({
      user: { uid: 'u1' },
      userRole: 'coach',
      selectedLeagueId: 'league-1',
    });
    mockApiGetForPermissionsAndPlayers({
      membership: { role: 'coach', canWrite: true },
      event: { isLocked: false },
    });

    render(<CheckIn />);

    const button = await screen.findByRole('button', { name: /add walk-up player/i });
    expect(button).toBeEnabled();
  });

  it('does not show Add Walk-Up Player button for viewer', async () => {
    useAuth.mockReturnValue({
      user: { uid: 'u1' },
      userRole: 'viewer',
      selectedLeagueId: 'league-1',
    });
    mockApiGetForPermissionsAndPlayers();

    render(<CheckIn />);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /add walk-up player/i })).not.toBeInTheDocument();
    });
  });

  it('refreshes roster after successful add and shows new player', async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue({
      user: { uid: 'u1' },
      userRole: 'organizer',
      selectedLeagueId: 'league-1',
    });

    mockApiGetForPermissionsAndPlayers({
      playerResponses: [
        [{ id: 'p1', name: 'Alice Adams', age_group: '10U', number: null }],
        [
          { id: 'p1', name: 'Alice Adams', age_group: '10U', number: null },
          { id: 'p2', name: 'Bobby Brown', age_group: '10U', number: null },
        ],
      ],
    });

    render(<CheckIn />);

    expect(await screen.findByText('Alice Adams')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /add walk-up player/i }));
    expect(screen.getByTestId('add-player-modal')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /complete add player/i }));

    expect(await screen.findByText('Bobby Brown')).toBeInTheDocument();
  });
});
