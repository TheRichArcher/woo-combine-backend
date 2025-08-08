import '@testing-library/jest-dom';

// Polyfill for TextEncoder/TextDecoder
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Provide a minimal fetch stub for libraries that expect it
if (!global.fetch) {
  global.fetch = jest.fn(() => Promise.reject(new Error('fetch not implemented in test env')));
}

// Mock Firebase modules
jest.mock('./firebase', () => ({
  auth: {
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    signOut: jest.fn(),
    onAuthStateChanged: jest.fn(),
  },
  db: {},
}));

// Mock firebase/auth to avoid Node fetch dependency and control auth flow in tests
jest.mock('firebase/auth', () => {
  return {
    onAuthStateChanged: (_auth, callback) => {
      // Simulate next tick to avoid setState outside act warnings
      setTimeout(() => callback(null), 0);
      // Return unsubscribe function
      return () => {};
    },
    signOut: jest.fn(),
  };
});

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }) => children,
  useNavigate: () => jest.fn(),
  useLocation: () => ({
    pathname: '/',
    search: '',
    hash: '',
    state: null,
  }),
  Link: ({ children, to }) => <a href={to}>{children}</a>,
  NavLink: ({ children, to }) => <a href={to}>{children}</a>,
}));

// Mock environment variables
process.env.VITE_API_BASE = 'http://localhost:3000/api';