import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Mock firebase before anything imports it
jest.mock('../../firebase', () => ({
  auth: {
    currentUser: null,
    onAuthStateChanged: jest.fn((callback) => {
      // Simulate no user signed in
      callback(null);
      return jest.fn(); // unsubscribe
    }),
  },
  db: {},
}));

jest.mock('../../lib/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn().mockResolvedValue({ data: {} }),
    post: jest.fn().mockResolvedValue({ data: {} }),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  },
}));

jest.mock('../../lib/leagues', () => ({
  __esModule: true,
  fetchLeagues: jest.fn().mockResolvedValue([]),
  createLeague: jest.fn(),
}));

jest.mock('../ToastContext', () => ({
  __esModule: true,
  ToastProvider: ({ children }) => children,
  useToast: () => ({ showToast: jest.fn() }),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  onAuthStateChanged: jest.fn((auth, callback) => {
    callback(null);
    return jest.fn();
  }),
  signOut: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  GoogleAuthProvider: jest.fn(),
  signInWithPopup: jest.fn(),
}));

import { AuthProvider, useAuth } from '../AuthContext';

// Test component to access auth context
const TestComponent = () => {
  const { user, userRole } = useAuth();

  return (
    <div>
      <div data-testid="user">{user ? user.uid : 'no-user'}</div>
      <div data-testid="role">{userRole || 'no-role'}</div>
    </div>
  );
};

describe('AuthContext', () => {
  it('provides auth context to children', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </BrowserRouter>
    );

    // Context should be available (no error thrown)
    expect(screen.getByTestId('user')).toBeInTheDocument();
    expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    expect(screen.getByTestId('role')).toHaveTextContent('no-role');
  });
});
