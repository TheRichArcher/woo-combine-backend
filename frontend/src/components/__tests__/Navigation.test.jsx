import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Navigation from '../Navigation';
import { AuthProvider } from '../../context/AuthContext';
import { EventProvider } from '../../context/EventContext';
import { ToastProvider } from '../../context/ToastContext';

// Mock the AuthContext hook
const mockAuthContext = {
  user: { uid: 'test-user', email: 'test@example.com' },
  userRole: 'organizer',
  leagues: [{ id: 'league1', name: 'Test League' }],
  selectedLeagueId: 'league1',
  setSelectedLeagueId: jest.fn(),
  logout: jest.fn(),
};

jest.mock('../../context/AuthContext', () => ({
  ...jest.requireActual('../../context/AuthContext'),
  useAuth: () => mockAuthContext,
}));

const NavigationWrapper = ({ children }) => (
  <BrowserRouter>
    <ToastProvider>
      <AuthProvider>
        <EventProvider>
          {children}
        </EventProvider>
      </AuthProvider>
    </ToastProvider>
  </BrowserRouter>
);

describe('Navigation', () => {
  it('renders navigation for authenticated user', () => {
    render(
      <NavigationWrapper>
        <Navigation />
      </NavigationWrapper>
    );
    // Basic nav links render
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Players')).toBeInTheDocument();
  });

  it('displays user role in navigation', () => {
    render(
      <NavigationWrapper>
        <Navigation />
      </NavigationWrapper>
    );

    // Organizer-specific Admin link is visible
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });
});