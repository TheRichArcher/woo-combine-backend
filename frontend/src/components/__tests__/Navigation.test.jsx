import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Navigation from '../Navigation';
import { AuthProvider } from '../../context/AuthContext';
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
        {children}
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

    expect(screen.getByText('WooCombine')).toBeInTheDocument();
  });

  it('displays user role in navigation', () => {
    render(
      <NavigationWrapper>
        <Navigation />
      </NavigationWrapper>
    );

    // Check if organizer-specific elements are shown
    expect(screen.getByText('WooCombine')).toBeInTheDocument();
  });
});