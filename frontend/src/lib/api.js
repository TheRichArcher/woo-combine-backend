import axios from 'axios';

/*
 * Centralised axios instance
 * The base URL is injected at build-time from Render (or .env.local).
 * Example:  https://woo-combine-backend-new.onrender.com
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE,
  withCredentials: true,          // keep if you use cookies / auth headers
  timeout: 30000                  // increased to 30 s
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

// Optional interceptors for JWT refresh, logging, etc.
// api.interceptors.response.use(
//   res => res,
//   err => { … }
// );

export default api; 