/**
 * Batch Service for WooCombine Frontend
 *
 * Provides optimized batch operations to reduce API call overhead
 * and improve page load performance.
 */

import api from '../lib/api';
import { withCache } from '../utils/dataCache';

/**
 * Fetch players for multiple events in a single request
 * @param {string[]} eventIds - Array of event IDs
 * @returns {Promise<Object>} Batch results object
 */
export const fetchBatchPlayers = withCache(
  async (eventIds) => {
    const response = await api.post('/batch/players', {
      event_ids: eventIds
    });
    return response.data;
  },
  'batch-players',
  2 * 60 * 1000 // 2 minute cache
);

/**
 * Fetch events for multiple leagues in a single request
 * @param {string[]} leagueIds - Array of league IDs
 * @returns {Promise<Object>} Batch results object
 */
export const fetchBatchEvents = withCache(
  async (leagueIds) => {
    const response = await api.post('/batch/events', {
      league_ids: leagueIds
    });
    return response.data;
  },
  'batch-events',
  5 * 60 * 1000 // 5 minute cache
);

/**
 * Fetch all dashboard data for a league in a single optimized request
 * @param {string} leagueId - League ID
 * @returns {Promise<Object>} Dashboard data object
 */
export const fetchDashboardData = withCache(
  async (leagueId) => {
    const response = await api.get(`/batch/dashboard-data/${leagueId}`);
    return response.data;
  },
  'dashboard-data',
  3 * 60 * 1000 // 3 minute cache
);

/**
 * Smart data fetching that automatically chooses between single and batch requests
 * based on the number of items requested
 */
export class SmartDataFetcher {
  constructor() {
    this.batchThreshold = 2; // Minimum items to trigger batch request
  }

  /**
   * Fetch players with automatic batching
   * @param {string|string[]} eventIds - Single event ID or array of event IDs
   * @returns {Promise<Object|Array>} Player data
   */
  async fetchPlayers(eventIds) {
    if (Array.isArray(eventIds)) {
      if (eventIds.length >= this.batchThreshold) {
        // Use batch request
        const batchResult = await fetchBatchPlayers(eventIds);
        return batchResult.results;
      } else {
        // Use individual requests for small numbers
        const results = {};
        for (const eventId of eventIds) {
          try {
            const response = await api.get(`/players?event_id=${eventId}`);
            results[eventId] = {
              success: true,
              players: response.data,
              count: response.data.length
            };
          } catch (error) {
            results[eventId] = {
              success: false,
              error: error.message,
              players: [],
              count: 0
            };
          }
        }
        return results;
      }
    } else {
      // Single event request
      const response = await api.get(`/players?event_id=${eventIds}`);
      return response.data;
    }
  }

  /**
   * Fetch events with automatic batching
   * @param {string|string[]} leagueIds - Single league ID or array of league IDs
   * @returns {Promise<Object|Array>} Event data
   */
  async fetchEvents(leagueIds) {
    if (Array.isArray(leagueIds)) {
      if (leagueIds.length >= this.batchThreshold) {
        // Use batch request
        const batchResult = await fetchBatchEvents(leagueIds);
        return batchResult.results;
      } else {
        // Use individual requests for small numbers
        const results = {};
        for (const leagueId of leagueIds) {
          try {
            const response = await api.get(`/leagues/${leagueId}/events`);
            results[leagueId] = {
              success: true,
              events: response.data.events || [],
              count: (response.data.events || []).length
            };
          } catch (error) {
            results[leagueId] = {
              success: false,
              error: error.message,
              events: [],
              count: 0
            };
          }
        }
        return results;
      }
    } else {
      // Single league request
      const response = await api.get(`/leagues/${leagueIds}/events`);
      return response.data;
    }
  }
}

// Export singleton instance
export const smartFetcher = new SmartDataFetcher();

/**
 * Preload data for better performance
 * @param {Object} config - Preload configuration
 * @param {string[]} config.eventIds - Event IDs to preload
 * @param {string[]} config.leagueIds - League IDs to preload
 * @param {string} config.dashboardLeagueId - League ID for dashboard preload
 */
export async function preloadData(config) {
  const promises = [];

  if (config.eventIds && config.eventIds.length > 0) {
    promises.push(
      fetchBatchPlayers(config.eventIds).catch(err => {
        console.warn('Failed to preload players:', err);
      })
    );
  }

  if (config.leagueIds && config.leagueIds.length > 0) {
    promises.push(
      fetchBatchEvents(config.leagueIds).catch(err => {
        console.warn('Failed to preload events:', err);
      })
    );
  }

  if (config.dashboardLeagueId) {
    promises.push(
      fetchDashboardData(config.dashboardLeagueId).catch(err => {
        console.warn('Failed to preload dashboard data:', err);
      })
    );
  }

  await Promise.allSettled(promises);
}

export default {
  fetchBatchPlayers,
  fetchBatchEvents,
  fetchDashboardData,
  smartFetcher,
  preloadData
};