import axios from 'axios';
import { auth } from '../firebase';

/*
 * Centralized axios instance with proper cold start handling
 * Base URL with fallback for production reliability
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || 'https://woo-combine-backend.onrender.com/api',
  withCredentials: false,
  timeout: 20000  // 20s timeout - more reasonable for user experience
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
    
    // CRITICAL FIX: Reduce retries for cold start scenarios to prevent cascade
    const maxRetries = error.config?.url?.includes('/leagues/me') ? 1 : 2; // Only 1 retry for league fetching
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
  console.log('[API] Request interceptor - user:', user ? 'authenticated' : 'not authenticated');
  
  if (user) {
    try {
      const token = await user.getIdToken(true); // Force refresh token to get latest verification status
      console.log('[API] Auth token retrieved:', token ? 'success' : 'failed');
      config.headers = config.headers || {};
      config.headers['Authorization'] = `Bearer ${token}`;
      console.log('[API] Authorization header added to request:', config.url);
    } catch (authError) {
      console.warn('[API] Failed to get auth token:', authError);
    }
  } else {
    console.warn('[API] No authenticated user found for request:', config.url);
  }
  
  // Return the config for the current request
  return config;
}, (error) => Promise.reject(error));

// Enhanced error handling with user-friendly messages
api.interceptors.response.use(
  response => response,
  error => {
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
    
    // Log detailed error info for debugging (excluding expected 404s)
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