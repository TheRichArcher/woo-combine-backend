import axios from 'axios';
import { auth } from '../firebase';

/*
 * Centralized axios instance with proper cold start handling
 * Base URL with fallback for production reliability
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || 'https://woo-combine-backend.onrender.com/api',
  withCredentials: false,
  timeout: 15000  // Reduced to 15s - faster failure for better UX
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
    
    // PERFORMANCE FIX: Reduce retries for faster failure recovery
    const maxRetries = error.config?.url?.includes('/leagues/me') ? 0 : // No retries for league fetch 
                      error.config?.url?.includes('/users/me') ? 0 : // No retries for role check
                      error.config?.url?.includes('/warmup') ? 0 : // No retries for warmup
                      0; // AGGRESSIVE: No retries for faster UX
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
    
    // More reasonable progressive delays: 2s, 4s, 8s
    let delay = Math.pow(2, config._retryCount) * 2000;
    
    // Optimized delays for different error types
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      delay = Math.min(delay * 1.5, 8000); // Up to 8s for cold starts
    } else if (!error.response) {
      delay = Math.min(delay * 1.2, 6000); // Network failures
    } else if (error.response?.status >= 500) {
      delay = Math.min(delay, 5000); // Server errors
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
          console.log('[API] Token expires soon, refreshing proactively');
          token = await user.getIdToken(true);
        }
        
      } catch (cachedTokenError) {
        // Fallback: Only refresh if it's been > 50 minutes since last refresh
        const lastRefresh = localStorage.getItem('lastTokenRefresh');
        const now = Date.now();
        if (!lastRefresh || (now - parseInt(lastRefresh)) > 50 * 60 * 1000) {
          console.log('[API] Cached token failed, refreshing');
          token = await user.getIdToken(true);
          localStorage.setItem('lastTokenRefresh', now.toString());
        } else {
          // Token should still be valid, continue without refresh
          console.warn('[API] Cached token failed but recently refreshed, continuing without token');
          return config;
        }
      }
      
      config.headers = config.headers || {};
      config.headers['Authorization'] = `Bearer ${token}`;
    } catch (authError) {
      console.warn('[API] Failed to get auth token:', authError);
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
    // CRITICAL FIX: Handle 401 errors globally to prevent cascading
    if (error.response?.status === 401) {
      console.warn('[API] Session expired - user needs to log in again');
      // Don't show multiple error messages - let auth context handle it
      // Just mark the error as handled to prevent UI cascades
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
      console.error('[API] Server Error:', error.response.data.detail);
    } else if (error.code === 'ECONNABORTED') {
      console.log('[API] Request timeout - server may be starting up');
    } else if (error.message.includes('Network Error')) {
      console.error('[API] Network connectivity issue');
    } else {
      console.error('[API] Request failed:', error.message);
    }
    
    return Promise.reject(error);
  }
);

export default api; 