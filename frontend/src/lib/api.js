import axios from 'axios';
import { auth } from '../firebase';

/*
 * Centralised axios instance
 * The base URL is injected at build-time from Render (or .env.local).
 * Example:  https://woo-combine-backend.onrender.com
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE,
  withCredentials: false,         // not needed since we use Authorization headers
  timeout: 45000                  // Increased to 45s for extreme Render cold start scenarios
});

// Request deduplication to prevent concurrent identical requests
const pendingRequests = new Map();

// Enhanced retry logic with exponential backoff and cold start handling
api.interceptors.response.use(
  response => response,
  async (error) => {
    const config = error.config;
    if (!config || !config.retry) return Promise.reject(error);

    config.retryCount = config.retryCount || 0;
    if (config.retryCount >= config.retry) return Promise.reject(error);

    config.retryCount += 1;
    
    // Extended delays for cold start scenarios - more aggressive for severe cases
    let delay = Math.pow(2, config.retryCount) * 3000; // Longer delays: 3s, 6s, 12s
    
    // Special handling for timeout errors (likely cold starts)
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      // Even longer delays for timeout scenarios
      delay = Math.min(delay * 3, 15000); // Up to 15s delay for severe cold starts
      console.log(`[API] Severe cold start detected, retrying in ${delay/1000}s...`);
    } else if (error.response?.status >= 500) {
      // Server errors also indicate cold start issues
      delay = Math.min(delay * 2, 12000); // Up to 12s for server errors
      console.log(`[API] Server error (${error.response.status}), retrying in ${delay/1000}s...`);
    }
    
    await new Promise(resolve => setTimeout(resolve, delay));
    return api(config);
  }
);

// Request deduplication and cold start optimization
api.interceptors.request.use(async (config) => {
  // Create request key for deduplication (method + url + auth state)
  const user = auth.currentUser;
  const requestKey = `${config.method}-${config.url}-${user ? user.uid : 'anonymous'}`;
  
  // Check if same request is already pending
  if (pendingRequests.has(requestKey)) {
    console.log(`[API] Deduplicating request: ${requestKey}`);
    return pendingRequests.get(requestKey);
  }
  
  // Add Authorization header if authenticated
  if (user) {
    const token = await user.getIdToken();
    config.headers = config.headers || {};
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Store request promise for deduplication
  const requestPromise = Promise.resolve(config);
  pendingRequests.set(requestKey, requestPromise);
  
  // Clean up after request completes
  requestPromise.finally(() => {
    pendingRequests.delete(requestKey);
  });
  
  return config;
}, (error) => Promise.reject(error));

// Surface backend error messages and log context
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response && error.response.data && error.response.data.detail) {
      // Optionally, you can surface this toasts, modals, etc.
      console.error('API Error:', error.response.data.detail);
    } else {
      console.error('API Error:', error.message);
    }
    return Promise.reject(error);
  }
);

// Optional interceptors for JWT refresh, logging, etc.
// api.interceptors.response.use(
//   res => res,
//   err => { … }
// );

export default api; 