import axios from 'axios';
import { auth } from '../firebase';

/*
 * Centralised axios instance
 * The base URL is injected at build-time from Render (or .env.local).
 * Example:  https://woo-combine-backend-new.onrender.com
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE,
  withCredentials: true,          // keep if you use cookies / auth headers
  timeout: 10000                  // reduced to 10 seconds to prevent long hangs
});

// Exponential backoff retry logic
api.interceptors.response.use(
  response => response,
  async (error) => {
    const config = error.config;
    if (!config || !config.retry) return Promise.reject(error);

    config.retryCount = config.retryCount || 0;
    if (config.retryCount >= config.retry) return Promise.reject(error);

    config.retryCount += 1;
    const delay = Math.pow(2, config.retryCount) * 1000; // Exponential backoff
    await new Promise(resolve => setTimeout(resolve, delay));
    return api(config);
  }
);

// Attach Authorization header to all requests if user is authenticated
api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers = config.headers || {};
    config.headers['Authorization'] = `Bearer ${token}`;
  }
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