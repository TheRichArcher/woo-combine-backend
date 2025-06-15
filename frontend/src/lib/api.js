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

// Active request tracking for proper deduplication
const activeRequests = new Map();

// Enhanced retry logic with exponential backoff
api.interceptors.response.use(
  response => response,
  async (error) => {
    const config = error.config;
    
    // Initialize retry count and enable retries for ALL requests
    if (!config._retryCount) {
      config._retryCount = 0;
    }
    
    // Retry up to 3 times for network/timeout/server errors
    const maxRetries = 3;
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
    
    // Progressive delays: 3s, 6s, 12s
    let delay = Math.pow(2, config._retryCount) * 3000;
    
    // Extended delays for cold start indicators
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      delay = Math.min(delay * 2, 15000); // Up to 15s for severe cold starts
      console.log(`[API] Cold start timeout detected, retrying in ${delay/1000}s... (attempt ${config._retryCount}/${maxRetries})`);
    } else if (!error.response) {
      delay = Math.min(delay * 1.5, 12000); // Network failures
      console.log(`[API] Network failure, retrying in ${delay/1000}s... (attempt ${config._retryCount}/${maxRetries})`);
    } else if (error.response?.status >= 500) {
      delay = Math.min(delay * 1.5, 10000); // Server errors
      console.log(`[API] Server error (${error.response.status}), retrying in ${delay/1000}s... (attempt ${config._retryCount}/${maxRetries})`);
    }
    
    await new Promise(resolve => setTimeout(resolve, delay));
    return api(config);
  }
);

// Request interceptor with PROPER deduplication and auth
api.interceptors.request.use(async (config) => {
  // Add Authorization header if authenticated
  const user = auth.currentUser;
  if (user) {
    try {
      const token = await user.getIdToken();
      config.headers = config.headers || {};
      config.headers['Authorization'] = `Bearer ${token}`;
    } catch (authError) {
      console.warn('[API] Failed to get auth token:', authError);
    }
  }
  
  // Create request key for deduplication
  const requestKey = `${config.method?.toUpperCase()}-${config.url}-${user?.uid || 'anonymous'}`;
  
  // Check if identical request is already in progress
  if (activeRequests.has(requestKey)) {
    console.log(`[API] Deduplicating concurrent request: ${requestKey}`);
    return activeRequests.get(requestKey);
  }
  
  // Create the actual request promise and store it
  const requestPromise = axios(config).finally(() => {
    // Clean up when request completes (success or failure)
    activeRequests.delete(requestKey);
  });
  
  activeRequests.set(requestKey, requestPromise);
  
  // Return the config for the current request (not the promise)
  return config;
}, (error) => Promise.reject(error));

// Enhanced error handling with user-friendly messages
api.interceptors.response.use(
  response => response,
  error => {
    // Log detailed error info for debugging
    if (error.response?.data?.detail) {
      console.error('[API] Server Error:', error.response.data.detail);
    } else if (error.code === 'ECONNABORTED') {
      console.error('[API] Request timeout - server may be starting up');
    } else if (error.message.includes('Network Error')) {
      console.error('[API] Network connectivity issue');
    } else {
      console.error('[API] Request failed:', error.message);
    }
    
    return Promise.reject(error);
  }
);

export default api; 