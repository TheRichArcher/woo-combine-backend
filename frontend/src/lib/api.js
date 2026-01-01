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
  // PRODUCTION FALLBACK: Use Render backend directly
  // This ensures production builds work even if env var is not set
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    // If we're on the production domain, use the Render backend
    if (hostname === 'woo-combine.com' || hostname === 'www.woo-combine.com') {
      return 'https://woo-combine-backend.onrender.com/api';
    }
    // Otherwise assume local dev with proxy
    return `${window.location.origin}/api`;
  }
  // Final fallback for local dev
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
    
    // Initialize retry count
    if (typeof config._retryCount !== 'number') {
      config._retryCount = 0;
    }
    
    const url = String(error.config?.url || '');
    const method = (error.config?.method || 'get').toLowerCase();
    const isIdempotent = ['get', 'head', 'options'].includes(method) || !!error.config?.idempotent;
    const statusCode = error.response?.status;
    
    // CRITICAL FIX: Only retry on real infrastructure errors
    // DO NOT retry on client errors (4xx) OR application errors (500/501)
    const isRetryableError = 
      error.code === 'ECONNABORTED' ||                    // Timeout
      error.message.includes('timeout') ||                 // Timeout variations
      error.message.includes('Network Error') ||           // Network failures
      !error.response ||                                   // No response (hibernation)
      statusCode === 502 ||                               // Bad Gateway (cold start/proxy)
      statusCode === 503 ||                               // Service Unavailable (hibernation)
      statusCode === 504;                                 // Gateway Timeout (cold start)
    
    // Never retry 4xx errors (401, 403, 404, etc.) - they won't succeed on retry
    // Never retry 500/501 - those are application errors, not infrastructure issues
    if (statusCode >= 400 && statusCode < 502) {
      return Promise.reject(error);
    }
    
    // Never retry 500 Internal Server Error or 501 Not Implemented
    if (statusCode === 500 || statusCode === 501) {
      return Promise.reject(error);
    }
    
    // Check for non-idempotent methods (POST, PUT, PATCH, DELETE)
    // Only retry idempotent requests to prevent duplicate data
    if (!isIdempotent) {
      return Promise.reject(error);
    }
    
    // Max retries: 2 for cold starts, 0 for warmup endpoint
    const maxRetries = url.includes('/warmup') ? 0 : 2;
    
    const shouldRetry = config._retryCount < maxRetries && isRetryableError;
    
    if (!shouldRetry) {
      return Promise.reject(error);
    }
    
    config._retryCount += 1;
    
    // Progressive backoff: 1s, 2s, 4s (capped at 3s)
    let delay = Math.min(Math.pow(2, config._retryCount) * 1000, 3000);
    
    // Optimized delays for different error types
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      delay = Math.min(delay * 1.2, 2000); // Slightly longer for timeouts
    } else if (!error.response) {
      delay = Math.min(delay * 1.1, 2000); // Network failures
    } else if (statusCode === 502 || statusCode === 503 || statusCode === 504) {
      delay = Math.min(delay * 1.5, 3000); // Cold start recovery needs more time
    }
    
    apiLogger.info(`Retrying request (attempt ${config._retryCount}/${maxRetries}) after ${delay}ms: ${url}`);
    
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
      // Respect existing Authorization header if provided (e.g. by AuthContext)
      if (config.headers?.['Authorization']) {
        return config;
      }

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

    // Handle 403 Forbidden - Clear stale state (e.g. removed from league)
    if (error.response?.status === 403) {
      try {
        console.warn("[API] 403 Forbidden - Clearing selected event/league state");
        localStorage.removeItem('selectedEvent');
        localStorage.removeItem('selectedEventId');
        localStorage.removeItem('selectedLeagueId');
      } catch (e) {
        console.error("Failed to clear state on 403", e);
      }
    }

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
    
    // Handle 403 Forbidden errors (e.g. accessing resources from wrong league context)
    if (error.response?.status === 403) {
      const detail = error.response?.data?.detail || '';
      
      // Special case: Email verification required
      if (detail.includes('Email verification required')) {
        console.warn('[API] Email verification required - redirecting to verification page');
        return Promise.reject(error);
      }
      
      // General 403: Likely due to stale context (e.g. reading event from wrong league)
      // Force clear selectedEvent to allow user to recover by selecting a valid event
      console.warn('[API] 403 Forbidden - clearing potentially stale selection state');
      try {
        localStorage.removeItem('selectedEvent');
        localStorage.removeItem('selectedEventId'); // Clean up potential legacy keys
        localStorage.removeItem('selectedLeagueId'); // Force league re-selection to be safe
        // Dispatch event to notify EventContext if needed, or just rely on reload/re-render
      } catch {}
      
      // Continue to reject so UI can show error if needed
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