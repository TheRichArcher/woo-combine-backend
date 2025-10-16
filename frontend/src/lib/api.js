import axios from 'axios';
import { auth } from '../firebase';
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

const api = axios.create({
  baseURL: resolveBaseUrl(),
  withCredentials: false,
  // Extended default timeout to handle backend cold starts more gracefully
  timeout: 90000
});

// Enhanced retry logic for cold start recovery

// Enhanced retry logic with exponential backoff
api.interceptors.response.use(
  response => response,
  async (error) => {
    const config = error.config;
    
    // Initialize retry count and enable retries for ALL requests
    if (!config._retryCount) {
      config._retryCount = 0;
    }
    
    // Avoid retries for auth-critical endpoints to prevent cascades
    const url = String(error.config?.url || '');
    const isAuthCritical = url.includes('/users/me') || url.includes('/leagues/me');
    // COLD START handling: limited retry for generic timeouts, none for auth-critical endpoints
    const maxRetries = url.includes('/warmup') ? 0
                      : isAuthCritical ? 0
                      : (error.code === 'ECONNABORTED' || error.message.includes('timeout')) ? 1
                      : (error.response?.status >= 500 ? 1 : 0);
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
    
    // More conservative progressive delays: 2s max for our single retry
    let delay = Math.min(Math.pow(2, config._retryCount) * 1000, 2000);
    
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
  
  if (user) {
    try {
      // ULTRA-PERFORMANCE OPTIMIZATION: Smart token caching with expiry checking
      let token;
      try {
        // Get cached token first
        token = await user.getIdToken(false);
        
        // ADVANCED: Check token expiry to avoid unnecessary refreshes
        const tokenPayload = JSON.parse(atob(token.split('.')[1]));
        const expiresAt = tokenPayload.exp * 1000; // Convert to milliseconds
        const now = Date.now();
        const timeUntilExpiry = expiresAt - now;
        
        // Only refresh if token expires in less than 5 minutes
        if (timeUntilExpiry < 5 * 60 * 1000) {
          apiLogger.debug('Token expires soon, refreshing proactively');
          token = await user.getIdToken(true);
        }
        
      } catch (cachedTokenError) {
        // Fallback: Only refresh if it's been > 50 minutes since last refresh
        const lastRefresh = localStorage.getItem('lastTokenRefresh');
        const now = Date.now();
        if (!lastRefresh || (now - parseInt(lastRefresh)) > 50 * 60 * 1000) {
          apiLogger.debug('Cached token failed, refreshing');
          token = await user.getIdToken(true);
          localStorage.setItem('lastTokenRefresh', now.toString());
        } else {
          // Token should still be valid, continue without refresh
          apiLogger.warn('Cached token failed but recently refreshed, continuing without token');
          return config;
        }
      }
      
      config.headers = config.headers || {};
      config.headers['Authorization'] = `Bearer ${token}`;
    } catch (authError) {
      apiLogger.warn('Failed to get auth token', authError);
      // Continue without token for non-auth endpoints
    }
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
    // CRITICAL FIX: Handle 401 errors globally to prevent cascading
    if (error.response?.status === 401) {
      // Try a one-time token refresh and retry the original request
      const original = error.config || {};
      if (!original._did401Refresh && auth.currentUser) {
        original._did401Refresh = true;
        return auth.currentUser.getIdToken(true)
          .then((token) => {
            original.headers = original.headers || {};
            original.headers['Authorization'] = `Bearer ${token}`;
            return api(original);
          })
          .catch(() => {
            // fall through to rejection if refresh fails
            apiLogger.warn('Token refresh after 401 failed');
            return Promise.reject(error);
          });
      }
      apiLogger.warn('Session expired - user needs to log in again');
      // Proactive redirect to login to avoid infinite 401 loops
      try {
        const current = typeof window !== 'undefined' ? (window.location.pathname + window.location.search) : '/';
        localStorage.setItem('postLoginRedirect', current);
        if (typeof window !== 'undefined') {
          window.location.href = '/login?reason=session_expired';
        }
      } catch {}
      // Mark handled and reject
      error._handled = true;
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