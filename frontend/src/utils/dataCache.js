console.log('Loading dataCache.js');

/**
 * Data Caching Utility for WooCombine
 *
 * Implements intelligent caching to reduce redundant API calls
 * and improve page load performance.
 */

/**
 * In-memory cache with TTL (Time To Live) support
 */
class DataCache {
  constructor() {
    this.cache = new Map();
    this.defaultTTL = 5 * 60 * 1000; // 5 minutes default
  }

  /**
   * Generate cache key from parameters
   * @param {string} prefix - Cache key prefix (e.g., 'players', 'events')
   * @param {Object} params - Parameters to include in key
   * @returns {string} Cache key
   */
  generateKey(prefix, params = {}) {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    
    return `${prefix}:${sortedParams}`;
  }

  /**
   * Store data in cache with TTL
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   * @param {number} ttl - Time to live in milliseconds
   */
  set(key, data, ttl = this.defaultTTL) {
    const expiry = Date.now() + ttl;
    this.cache.set(key, {
      data,
      expiry,
      timestamp: Date.now()
    });

    // Clean up expired entries occasionally
    if (this.cache.size > 100) {
      this.cleanup();
    }
  }

  /**
   * Retrieve data from cache
   * @param {string} key - Cache key
   * @returns {any|null} Cached data or null if expired/missing
   */
  get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Check if data exists and is fresh
   * @param {string} key - Cache key
   * @returns {boolean} True if data exists and is not expired
   */
  has(key) {
    return this.get(key) !== null;
  }

  /**
   * Invalidate specific cache entry
   * @param {string} key - Cache key
   */
  invalidate(key) {
    this.cache.delete(key);
  }

  /**
   * Invalidate all cache entries with a specific prefix
   * @param {string} prefix - Cache key prefix
   */
  invalidatePrefix(prefix) {
    const keysToDelete = [];
    
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    const keysToDelete = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    const now = Date.now();
    let expired = 0;
    let active = 0;
    
    for (const entry of this.cache.values()) {
      if (now > entry.expiry) {
        expired++;
      } else {
        active++;
      }
    }
    
    return {
      total: this.cache.size,
      active,
      expired
    };
  }
}

// Create singleton instance
export const dataCache = new DataCache();

/**
 * Higher-order function to add caching to API calls
 * @param {Function} apiFunction - API function to cache
 * @param {string} cachePrefix - Cache key prefix
 * @param {number} ttl - Cache TTL in milliseconds
 * @returns {Function} Cached API function
 */
/**
 * Higher-order function that adds caching to an API function
 * @param {Function} apiFunction - The API function to cache
 * @param {string} cachePrefix - Cache key prefix for categorization
 * @param {number} ttl - Time to live in milliseconds (default: 5 minutes)
 * @returns {Function} Cached version of the API function
 */
export function withCache(apiFunction, cachePrefix, ttl = 5 * 60 * 1000) {
  return async function cachedApiCall(...args) {
    // Generate cache key from function arguments
    const cacheKey = dataCache.generateKey(cachePrefix, {
      args: JSON.stringify(args)
    });

    // Try to get from cache first
    const cached = dataCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Call API function and cache result
    try {
      const result = await apiFunction(...args);
      dataCache.set(cacheKey, result, ttl);
      return result;
    } catch (error) {
      // Don't cache errors
      throw error;
    }
  };
}

/**
 * Smart cache invalidation based on data mutations
 */
export const cacheInvalidation = {
  /**
   * Invalidate player-related caches when player data changes
   * @param {string} eventId - Event ID
   */
  playersUpdated(eventId) {
    dataCache.invalidatePrefix(`players:args=["${eventId}"]`);
    dataCache.invalidatePrefix(`rankings:`);
    dataCache.invalidatePrefix(`scorecards:`);
  },

  /**
   * Invalidate event-related caches when event data changes
   * @param {string} leagueId - League ID
   */
  eventsUpdated(leagueId) {
    dataCache.invalidatePrefix(`events:args=["${leagueId}"]`);
    dataCache.invalidatePrefix(`players:`);
  },

  /**
   * Invalidate league-related caches when league data changes
   */
  leaguesUpdated() {
    dataCache.invalidatePrefix(`leagues:`);
    dataCache.invalidatePrefix(`events:`);
  },

  /**
   * Clear all caches on logout
   */
  userLoggedOut() {
    dataCache.clear();
  }
};

/**
 * Prefetch data for better performance
 * @param {Array} requests - Array of { apiFunction, args, cachePrefix } objects
 */
/**
 * Prefetch multiple data requests concurrently
 * @param {Array<{key: string, apiCall: Function}>} requests - Array of prefetch requests
 * @returns {Promise<Object>} Map of results by key
 */
export async function prefetchData(requests) {
  const promises = requests.map(async ({ apiFunction, args, cachePrefix }) => {
    const cacheKey = dataCache.generateKey(cachePrefix, {
      args: JSON.stringify(args)
    });

    // Only fetch if not in cache
    if (!dataCache.has(cacheKey)) {
      try {
        const result = await apiFunction(...args);
        dataCache.set(cacheKey, result);
        return result;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('Prefetch failed:', error);
        return null;
      }
    }
  });

  return Promise.allSettled(promises);
}