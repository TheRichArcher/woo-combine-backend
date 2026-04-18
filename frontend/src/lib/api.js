import axios from 'axios';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { apiLogger } from '../utils/logger';
import { evaluate403ContextPolicy } from './contextClearPolicy';

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
const SESSION_STALE_GRACE_MS = 5000;
let refreshPromise = null;
let crossTabListenersInitialized = false;
let authGeneration = 0;
let lastSeenAuthUid;
let lastSeenTokenIat = null;
let lastLoginAtMs = 0;
const inflightRequestControllers = new Set();
const QR_DEBUG_KEY = 'debug_qr_flow';

const isCancellationError = (error) => {
  if (!error) return false;

  if (typeof axios !== 'undefined' && typeof axios.isCancel === 'function' && axios.isCancel(error)) {
    return true;
  }

  if (error.code === 'ERR_CANCELED') return true;
  if (error.name === 'CanceledError' || error.name === 'AbortError') return true;

  const message = String(error.message || '').toLowerCase();
  if (message === 'canceled' || message.includes('aborted')) return true;

  return false;
};

const isQrDebugEnabled = () => {
  try {
    return localStorage.getItem(QR_DEBUG_KEY) === '1';
  } catch {
    return false;
  }
};

const log403ContextClear = (requestUrl, branch) => {
  if (!isQrDebugEnabled()) return;
  console.warn('[QR_FLOW][api][403-clear]', {
    branch,
    requestUrl,
    clearing: ['selectedEvent', 'selectedEventId', 'selectedLeagueId']
  });
};

const markContextClear = (reason, payload = {}) => {
  if (!isQrDebugEnabled()) return;
  const snapshot = {
    reason,
    ...payload,
    pathname: typeof window !== 'undefined' ? window.location?.pathname || null : null,
    timestamp: new Date().toISOString()
  };
  console.warn('[QR_FLOW][api][context-clear]', snapshot);
  try {
    localStorage.setItem('debug_qr_last_context_clear', JSON.stringify(snapshot));
  } catch {
    // best-effort debug write
  }
};

const apply403ContextPolicy = (error, branch) => {
  const requestUrl = String(error?.config?.url || '');
  const {
    postJoinWindow,
    definitiveEventLoss,
    clearSelectedEvent,
    clearSelectedLeague
  } = evaluate403ContextPolicy(error);

  markContextClear('403-policy-evaluated', {
    branch,
    requestUrl,
    postJoinWindow,
    definitiveEventLoss,
    clearSelectedEvent,
    clearSelectedLeague
  });

  try {
    if (clearSelectedEvent) {
      localStorage.removeItem('selectedEvent');
      localStorage.removeItem('selectedEventId');
    }
    if (clearSelectedLeague) {
      localStorage.removeItem('selectedLeagueId');
    }
  } catch (e) {
    console.error('[API] Failed applying 403 context policy', e);
  }
};

const broadcastLogout = () => {
  try {
    localStorage.setItem(LOGOUT_BROADCAST_KEY, Date.now().toString());
  } catch {
    /* ignore */
  }
};

const clearLocalAuthState = () => {
  markContextClear('clearLocalAuthState', {
    selectedLeagueIdBefore: localStorage.getItem('selectedLeagueId') || null,
    selectedEventBefore: localStorage.getItem('selectedEvent') || null
  });
  try {
    localStorage.removeItem('selectedEvent');
    localStorage.removeItem('selectedEventId');
    localStorage.removeItem('selectedLeagueId');
    localStorage.removeItem('userRole');
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

const redirectToSessionExpiredLogin = () => {
  if (typeof window === 'undefined') return;
  try {
    const currentPath = window.location?.pathname || '/';
    const currentSearch = window.location?.search || '';
    const onboarding = ['/login', '/signup', '/verify-email', '/welcome', '/'];
    const target = onboarding.includes(currentPath) ? '/dashboard' : `${currentPath}${currentSearch}`;
    localStorage.setItem('postLoginRedirect', target);
  } catch {
    /* ignore */
  }

  // Force login route in-app after stale-session logout.
  const loginUrl = '/login?reason=session_expired';
  try {
    window.history.replaceState({}, '', loginUrl);
    window.dispatchEvent(new PopStateEvent('popstate'));
  } catch {
    /* ignore */
  }
};

const emitSessionExpired = () => {
  try {
    if (typeof window !== 'undefined') {
      if (!window.__wcSessionExpiredShown) {
        window.__wcSessionExpiredShown = true;
      }
      const ev = new CustomEvent('wc-session-expired');
      window.dispatchEvent(ev);
    }
  } catch {
    /* ignore */
  }
};

const bumpAuthGeneration = (reason) => {
  authGeneration += 1;
  apiLogger.info(`[API] Auth generation -> ${authGeneration} (${reason})`);
};

const cancelInFlightRequests = (reason) => {
  for (const controller of inflightRequestControllers) {
    try {
      controller.abort(reason);
    } catch {
      /* ignore */
    }
  }
  inflightRequestControllers.clear();
};

const reconcileAuthGeneration = ({ uid, tokenIat }) => {
  if (typeof lastSeenAuthUid === 'undefined') {
    lastSeenAuthUid = uid;
    lastSeenTokenIat = tokenIat || null;
    return;
  }

  if (uid !== lastSeenAuthUid) {
    bumpAuthGeneration('uid changed');
    if (uid) {
      lastLoginAtMs = Date.now();
    }
    lastSeenAuthUid = uid;
    lastSeenTokenIat = tokenIat || null;
    cancelInFlightRequests('auth uid transition');
    return;
  }

  if (uid && tokenIat && lastSeenTokenIat && tokenIat !== lastSeenTokenIat) {
    bumpAuthGeneration('token iat changed');
    lastLoginAtMs = Date.now();
    lastSeenTokenIat = tokenIat;
    cancelInFlightRequests('auth token transition');
    return;
  }

  if (uid && tokenIat && !lastSeenTokenIat) {
    lastSeenTokenIat = tokenIat;
  }
};

const attachRequestSessionSnapshot = (config, uid) => {
  config._authGeneration = authGeneration;
  config._authUidSnapshot = uid || null;
  config._requestStartedAt = Date.now();
};

const registerInternalAbortController = (config) => {
  // Respect caller-provided signal; only manage controllers for internal requests.
  if (config.signal) return;
  const controller = new AbortController();
  config.signal = controller.signal;
  config._internalAbortController = controller;
  inflightRequestControllers.add(controller);
};

const releaseInternalAbortController = (config) => {
  const controller = config?._internalAbortController;
  if (!controller) return;
  inflightRequestControllers.delete(controller);
  config._internalAbortController = null;
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
  response => {
    releaseInternalAbortController(response?.config);
    return response;
  },
  async (error) => {
    const config = error.config;
    releaseInternalAbortController(config);

    if (isCancellationError(error)) {
      apiLogger.debug('Request canceled before retry handler', {
        url: String(config?.url || ''),
        method: String(config?.method || '').toLowerCase(),
        canceledByInternalController: Boolean(config?._internalAbortController)
      });
      return Promise.reject(error);
    }
    
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
  const uid = user?.uid || null;
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
        const payload = decodeJwtPayload(token);
        reconcileAuthGeneration({ uid, tokenIat: payload?.iat || null });
        config.headers = config.headers || {};
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (authError) {
      apiLogger.warn('Failed to get auth token', authError);
    }
  } else {
    reconcileAuthGeneration({ uid: null, tokenIat: null });
    markSessionStale();
  }

  attachRequestSessionSnapshot(config, uid);
  registerInternalAbortController(config);
  
  // Return the config for the current request
  return config;
}, (error) => Promise.reject(error));

// Enhanced error handling with user-friendly messages and auth handling
api.interceptors.response.use(
  response => {
    releaseInternalAbortController(response?.config);
    return response;
  },
  error => {
    releaseInternalAbortController(error?.config);

    if (isCancellationError(error)) {
      apiLogger.debug('Request canceled (expected)', {
        url: String(error?.config?.url || ''),
        method: String(error?.config?.method || '').toLowerCase(),
        canceledByInternalController: Boolean(error?.config?._internalAbortController)
      });
      return Promise.reject(error);
    }

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
        log403ContextClear(String(error.config?.url || ''), 'early-403-handler');
        markContextClear('403-early-handler', {
          requestUrl: String(error.config?.url || ''),
          status: 403
        });
        console.warn("[API] 403 Forbidden - applying context clear policy");
        apply403ContextPolicy(error, 'early-403-handler');
      } catch (e) {
        console.error("Failed to clear state on 403", e);
      }
    }

    // CRITICAL FIX: Handle 401 errors globally without redirect loops
    if (error.response?.status === 401) {
      const detail = error.response?.data?.detail;
      const isSessionTooOld = detail === 'Session too old';
      if (isSessionTooOld) {
        const requestGeneration = error.config?._authGeneration;
        const requestUid = error.config?._authUidSnapshot || null;
        const currentUid = auth.currentUser?.uid || null;
        const generationMatches = requestGeneration === authGeneration;
        const uidMatches = requestUid === currentUid;
        const withinLoginGrace = !!currentUid && (Date.now() - lastLoginAtMs) < SESSION_STALE_GRACE_MS;
        const shouldForceLogout = !!currentUid && generationMatches && uidMatches && !withinLoginGrace;

        if (!shouldForceLogout) {
          apiLogger.info(
            '[API] Ignoring stale-session 401 from non-current auth context',
            { requestUid, currentUid, requestGeneration, currentGeneration: authGeneration, withinLoginGrace }
          );
          return Promise.reject(error);
        }

        apiLogger.warn('401 Session too old - forcing re-authentication');
        cancelInFlightRequests('stale-session logout');
        clearLocalAuthState();
        try { signOut(auth).catch(() => {}); } catch {}
        broadcastLogout();
        markSessionStale();
        emitSessionExpired();
        redirectToSessionExpiredLogin();
        return Promise.reject(error);
      }

      // Try a one-time token refresh and retry the original request
      const original = error.config || {};
      const reqUrl = String(original.url || error.config?.url || '');
      const isAuthCriticalPath = reqUrl.includes('/users/me') || reqUrl.includes('/users/role') || reqUrl.includes('/leagues/me');
      const isSchemaPath = reqUrl.includes('/schema');
      const currentPath = (typeof window !== 'undefined' && window.location) ? window.location.pathname : '';
      const isOnboardingPath = ['/login','/signup','/verify-email','/welcome','/'].includes(currentPath);

      // Special handling for schema 401s - these are often context mismatches, not auth failures
      // Let the component handle gracefully with fallback templates instead of forcing logout
      if (isSchemaPath) {
        apiLogger.info('401 on schema endpoint - likely event/league context mismatch, allowing component fallback');
        return Promise.reject(error);
      }

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
          .catch((refreshError) => {
            // Only force logout if token refresh actually failed (not just a permission issue)
            const refreshFailed = refreshError?.message?.includes('Token refresh unavailable') || 
                                  !auth.currentUser;
            
            if (refreshFailed) {
              apiLogger.warn('Token refresh after 401 failed - forcing logout');
              // On refresh failure: sign out and trigger global session-expired modal
              try { signOut(auth).catch(() => {}); broadcastLogout(); } catch {}
              try {
                markSessionStale();
                emitSessionExpired();
              } catch {}
            } else {
              // Permission issue, not auth failure - let component handle it
              apiLogger.info('401 after token refresh but auth still valid - likely permission/context issue');
            }
            return Promise.reject(error);
          });
      }

      // For repeat 401s (already tried refresh), only logout if no current user
      // This prevents logout loops when user has valid auth but wrong context
      if (!auth.currentUser) {
        apiLogger.warn('401 with no current user - forcing logout');
        try { signOut(auth).catch(() => {}); } catch {}
        broadcastLogout();
        markSessionStale();
        emitSessionExpired();
      } else {
        // User is authenticated but getting 401 - likely a permission/context issue
        apiLogger.info('401 with valid auth - likely permission or context mismatch, not forcing logout');
      }
      
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
      log403ContextClear(String(error.config?.url || ''), 'late-403-handler');
      markContextClear('403-late-handler', {
        requestUrl: String(error.config?.url || ''),
        status: 403,
        detail
      });
      console.warn('[API] 403 Forbidden - applying late context clear policy');
      try {
        apply403ContextPolicy(error, 'late-403-handler');
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