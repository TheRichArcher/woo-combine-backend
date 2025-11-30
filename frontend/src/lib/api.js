import axios from 'axios';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { apiLogger } from '../utils/logger';

/*
 * Centralized axios instance with proper cold start handling
 * Base URL with fallback for production reliability
 */
// Resolve base URL in both Vite (build-time) and Jest/node environments
const resolveBaseUrl = () => {
  // Prefer Vite-injected env at build time (production frontend)
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE;
  }
  // Jest/node fallback for tests or server-side tooling
  if (typeof process !== 'undefined' && process.env && process.env.VITE_API_BASE) {
    return process.env.VITE_API_BASE;
  }
  // Browser fallback: same-origin /api (useful in local dev with proxy)
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return `${window.location.origin}/api`;
  }
  // Final fallback
  return 'http://localhost:3000/api';
};

const decodeJwtPayload = (token) => {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  const padded = parts[1].padEnd(parts[1].length + ((4 - (parts[1].length % 4)) % 4), '=');

  try {
    if (typeof atob === 'function') {
      return JSON.parse(atob(padded));
    }
  } catch (err) {
    // Fallback to Node-style decoding below
  }

  try {
    if (typeof window !== 'undefined' && typeof window.atob === 'function') {
      return JSON.parse(window.atob(padded));
    }
  } catch {
    // continue to Buffer fallback
  }

  if (typeof Buffer !== 'undefined') {
    try {
      const decoded = Buffer.from(padded, 'base64').toString('utf-8');
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }

  return null;
};

const LOGOUT_BROADCAST_KEY = 'wc-logout';
const SESSION_STALE_KEY = 'wc-session-stale';
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
let refreshPromise = null;
let crossTabListenersInitialized = false;

const broadcastLogout = () => {
  try {
    localStorage.setItem(LOGOUT_BROADCAST_KEY, Date.now().toString());
  } catch {
    /* ignore */
  }
};

const markSessionStale = () => {
  try {
    localStorage.setItem(SESSION_STALE_KEY, Date.now().toString());
  } catch {
    /* ignore */
  }
};

const initCrossTabListeners = () => {
  if (crossTabListenersInitialized || typeof window === 'undefined') return;
  window.addEventListener('storage', (event) => {
    if (event.key === LOGOUT_BROADCAST_KEY) {
      signOut(auth).catch(() => {});
      window.dispatchEvent(new CustomEvent('wc-session-expired'));
    }
    if (event.key === SESSION_STALE_KEY) {
      window.dispatchEvent(new CustomEvent('wc-session-expired'));
    }
  });
  crossTabListenersInitialized = true;
};

initCrossTabListeners();

const ensureFreshToken = async (forceRefresh = false) => {
  const user = auth.currentUser;
  if (!user) {
    return null;
  }

  if (forceRefresh) {
    return user.getIdToken(true);
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  let token = await user.getIdToken(false);
  const payload = decodeJwtPayload(token);
  if (payload?.exp) {
    const expiresAt = payload.exp * 1000;
    const remaining = expiresAt - Date.now();
    if (remaining < TOKEN_REFRESH_BUFFER_MS) {
      refreshPromise = user.getIdToken(true);
      try {
        token = await refreshPromise;
        localStorage.setItem('lastTokenRefresh', Date.now().toString());
      } finally {
        refreshPromise = null;
      }
    }
  }
  return token;
};

const api = axios.create({
  baseURL: resolveBaseUrl(),
  withCredentials: false,
  // Balanced default timeout to avoid long stalls on cold start
  timeout: 45000
});

// Enhanced retry logic for cold start recovery

// Enhanced retry logic with exponential backoff
api.interceptors.response.use(
  response => response,
  async (error) => {
    const config = error.config;
    
    // Some network failures (CORS, browser cancellations) produce errors without config.
    // In those cases we can't retry, so fail fast to avoid undefined config access crashes.
    if (!config) {
      return Promise.reject(error);
    }
    
    // Initialize retry count and enable retries for ALL requests
    if (typeof config._retryCount !== 'number') {
      config._retryCount = 0;
    }
    
    // Avoid retries for auth-critical endpoints to prevent cascades
    const url = String(error.config?.url || '');
    const isAuthCritical = url.includes('/users/me') || url.includes('/leagues/me');
    // COLD START handling: limited retry for generic timeouts, none for auth-critical endpoints
    const maxRetries = url.includes('/warmup') ? 0
                      : isAuthCritical ? 0
                      : (error.code === 'ECONNABORTED' || error.message.includes('timeout')) ? 2
                      : (error.response?.status >= 500 ? 2 : 0);
    const shouldRetry = config._retryCount < maxRetries && (
      error.code === 'ECONNABORTED' ||           // Timeout
      error.message.includes('timeout') ||        // Timeout variations
      error.message.includes('Network Error') ||  // Network failures
      error.response?.status >= 500 ||            // Server errors
      !error.response                            // No response (hibernation)
    );
    
    if (!shouldRetry) {
      return Promise.reject(error);
    }
    
    config._retryCount += 1;
    
    // Progressive backoff (up to ~3s)
    let delay = Math.min(Math.pow(2, config._retryCount) * 1000, 3000);
    
    // Optimized delays for different error types
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      delay = Math.min(delay * 1.2, 2000);
    } else if (!error.response) {
      delay = Math.min(delay * 1.1, 2000);
    } else if (error.response?.status >= 500) {
      delay = Math.min(delay, 1500);
    }
    
    await new Promise(resolve => setTimeout(resolve, delay));
    return api(config);
  }
);

// Request interceptor with auth (deduplication removed to fix _retryCount bug)
api.interceptors.request.use(async (config) => {
  // Add Authorization header if authenticated
  const user = auth.currentUser;
  const reqPath = String(config?.url || '');
  const isAuthCriticalPath = reqPath.includes('/users/me') || reqPath.includes('/users/role') || reqPath.includes('/leagues/me');
  
  if (user) {
    try {
      const token = await ensureFreshToken(isAuthCriticalPath);
      if (token) {
        config.headers = config.headers || {};
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (authError) {
      apiLogger.warn('Failed to get auth token', authError);
    }
  } else {
    markSessionStale();
  }
  
  // Return the config for the current request
  return config;
}, (error) => Promise.reject(error));

// Enhanced error handling with user-friendly messages and auth handling
api.interceptors.response.use(
  response => response,
  error => {
    try {
      // Surface 429 with retry-after if present
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers?.['retry-after'] || error.response.headers?.['x-ratelimit-reset'];
        const waitMsg = retryAfter ? `Please wait ${retryAfter} seconds and try again.` : 'Please slow down and try again.';
        apiLogger.warn('Rate limit exceeded. ' + waitMsg);
      }
    } catch {}
    // CRITICAL FIX: Handle 401 errors globally without redirect loops
    if (error.response?.status === 401) {
      // Try a one-time token refresh and retry the original request
      const original = error.config || {};
    const reqUrl = String(original.url || error.config?.url || '');
    const isAuthCriticalPath = reqUrl.includes('/users/me') || reqUrl.includes('/users/role') || reqUrl.includes('/leagues/me');
      const currentPath = (typeof window !== 'undefined' && window.location) ? window.location.pathname : '';
      const isOnboardingPath = ['/login','/signup','/verify-email','/welcome','/'].includes(currentPath);

      if (!original._did401Refresh && auth.currentUser) {
        original._did401Refresh = true;
        return ensureFreshToken(true)
          .then((token) => {
            if (!token) {
              throw new Error('Token refresh unavailable');
            }
            original.headers = original.headers || {};
            original.headers['Authorization'] = `Bearer ${token}`;
            return api(original);
          })
          .catch(() => {
            apiLogger.warn('Token refresh after 401 failed');
            // On refresh failure: sign out and trigger global session-expired modal
            try { signOut(auth).catch(() => {}); broadcastLogout(); } catch {}
            try {
              if (typeof window !== 'undefined') {
                if (!window.__wcSessionExpiredShown) {
                  window.__wcSessionExpiredShown = true;
                }
                markSessionStale();
                const ev = new CustomEvent('wc-session-expired');
                window.dispatchEvent(ev);
              }
            } catch {}
            return Promise.reject(error);
          });
      }

      // For all other 401 paths (including onboarding), sign out and show modal instead of redirecting
      try { signOut(auth).catch(() => {}); } catch {}
      broadcastLogout();
      markSessionStale();
      try {
        if (typeof window !== 'undefined') {
          if (!window.__wcSessionExpiredShown) {
            window.__wcSessionExpiredShown = true;
          }
          const ev = new CustomEvent('wc-session-expired');
          window.dispatchEvent(ev);
        }
      } catch {}
      return Promise.reject(error);
    }
    
    // CRITICAL FIX: Don't log 404s for endpoints where they're expected (new user onboarding)
    const isExpected404 = error.response?.status === 404 && (
      error.config?.url?.includes('/leagues/me') ||
      error.config?.url?.includes('/players?event_id=')
    );
    
    if (isExpected404) {
      // Silent handling for expected 404s during new user onboarding
      return Promise.reject(error);
    }
    
    // Handle 403 email verification errors gracefully
    if (error.response?.status === 403 && error.response?.data?.detail?.includes('Email verification required')) {
      console.warn('[API] Email verification required - redirecting to verification page');
      // Don't log this as an error since it's expected behavior
      return Promise.reject(error);
    }
    
    // Log detailed error info for debugging (excluding expected 404s and handled 401s)
    if (error.response?.data?.detail) {
      apiLogger.error('Server Error', error.response.data.detail);
    } else if (error.code === 'ECONNABORTED') {
      apiLogger.info('Request timeout - server may be starting up');
    } else if (error.message.includes('Network Error')) {
      apiLogger.error('Network connectivity issue');
    } else {
      apiLogger.error('Request failed', error.message);
    }
    
    return Promise.reject(error);
  }
);

export default api; 

// Convenience helpers for health and warmup
export const apiHealth = () => api.get('/health');
export const apiWarmup = () => api.get('/warmup');