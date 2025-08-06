import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '../AuthContext';
import { ToastProvider } from '../ToastContext';

// Test component to access auth context
const TestComponent = () => {
  const { user, userRole, authChecked } = useAuth();
  
  return (
    <div>
      <div data-testid="auth-checked">{authChecked ? 'checked' : 'not-checked'}</div>
      <div data-testid="user">{user ? user.uid : 'no-user'}</div>
      <div data-testid="role">{userRole || 'no-role'}</div>
    </div>
  );
};

const AuthTestWrapper = ({ children }) => (
  <BrowserRouter>
    <ToastProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </ToastProvider>
  </BrowserRouter>
);

describe('AuthContext', () => {
  it('initializes with proper default values', async () => {
    render(
      <AuthTestWrapper>
        <TestComponent />
      </AuthTestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-checked')).toHaveTextContent('checked');
    });

    expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    expect(screen.getByTestId('role')).toHaveTextContent('no-role');
  });

  it('provides auth context to children', () => {
    render(
      <AuthTestWrapper>
        <TestComponent />
      </AuthTestWrapper>
    );

    // Context should be available (no error thrown)
    expect(screen.getByTestId('auth-checked')).toBeInTheDocument();
  });
});