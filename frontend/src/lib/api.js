import axios from 'axios';
import { auth } from '../firebase';

/*
 * Centralized axios instance with proper cold start handling
 * Base URL with fallback for production reliability
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || 'https://woo-combine-backend.onrender.com/api',
  withCredentials: false,
  timeout: 45000  // 45s for extreme cold start scenarios
});

// Request interceptor with auth
api.interceptors.request.use(async (config) => {
  // Add Authorization header if authenticated
  const user = auth.currentUser;
  if (user) {
    try {
      // Force refresh token if it's close to expiring
      const token = await user.getIdToken(true); // Force refresh
      config.headers = config.headers || {};
      config.headers['Authorization'] = `Bearer ${token}`;
      
      // Debug logging for authentication
      console.debug('[API] Request with auth token for:', config.url);
    } catch (authError) {
      console.warn('[API] Failed to get auth token:', authError);
      // Don't fail the request, let the backend handle it
    }
  } else {
    console.debug('[API] Request without authentication for:', config.url);
  }
  
  // Return the config for the current request
  return config;
}, (error) => Promise.reject(error));

// COMBINED response interceptor with retry logic and error handling
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
    
    // Log errors first (before retrying)
    const isExpected404 = error.response?.status === 404 && (
      error.config?.url?.includes('/leagues/me') ||
      error.config?.url?.includes('/players?event_id=')
    );
    
    if (!isExpected404 && !shouldRetry) {
      // Only log if we're not retrying and it's not an expected 404
      if (error.response?.data?.detail) {
        console.error('[API] Server Error:', error.response.data.detail);
      } else if (error.code === 'ECONNABORTED') {
        console.error('[API] Request timeout - server may be starting up');
      } else if (error.message.includes('Network Error')) {
        console.error('[API] Network connectivity issue');
      } else {
        console.error('[API] Request failed:', error.message);
      }
    }
    
    // Retry logic
    if (shouldRetry) {
      config._retryCount += 1;
      
      // Progressive delays: 3s, 6s, 12s
      let delay = Math.pow(2, config._retryCount) * 3000;
      
      // Extended delays for cold start indicators
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        delay = Math.min(delay * 2, 15000); // Up to 15s for severe cold starts
      } else if (!error.response) {
        delay = Math.min(delay * 1.5, 12000); // Network failures
      } else if (error.response?.status >= 500) {
        delay = Math.min(delay * 1.5, 10000); // Server errors
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return api(config);
    }
    
    return Promise.reject(error);
  }
);

export default api; 