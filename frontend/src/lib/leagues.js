import api from './api';
import axios from 'axios';

/**
 * Centralized API client for league operations
 * 
 * This module provides normalized, type-safe wrappers around raw API calls.
 * ALL league fetching should go through these functions to ensure consistent
 * response shape handling.
 */

/**
 * Check if error is from request cancellation
 * Robust check for all axios cancel patterns
 */
function isCancelError(error) {
  // Modern axios (1.x): axios.isCancel() utility
  if (axios.isCancel && axios.isCancel(error)) {
    return true;
  }
  
  // Axios 1.x: ERR_CANCELED code
  if (error.code === 'ERR_CANCELED') {
    return true;
  }
  
  // Axios 1.x: CanceledError name
  if (error.name === 'CanceledError') {
    return true;
  }
  
  // Standard AbortError (fetch API)
  if (error.name === 'AbortError') {
    return true;
  }
  
  return false;
}

/**
 * Get leagues for the current user
 * 
 * @param {Object} options - Optional configuration
 * @param {AbortSignal} options.signal - AbortController signal for request cancellation
 * @returns {Promise<Array>} Always returns a plain array of leagues
 * @throws {Error} Re-throws API errors for caller to handle
 * 
 * Contract:
 * - Backend returns: {"leagues": [...]} or {"leagues": []}
 * - This function returns: [...] or []
 * - NEVER returns: undefined, null, or object with leagues key
 */
export async function getMyLeagues(options = {}) {
  try {
    // Pass signal to axios for abort support
    const response = await api.get('/leagues/me', {
      signal: options.signal
    });
    
    // Normalize response to plain array
    const data = response?.data;
    
    // Handle all possible response shapes
    if (!data) {
      // No response data
      return [];
    }
    
    if (Array.isArray(data)) {
      // Backend returned bare array (shouldn't happen, but handle it)
      return data;
    }
    
    if (typeof data === 'object' && data.leagues !== undefined) {
      // Standard shape: {"leagues": [...]}
      const leagues = data.leagues;
      
      // Protect against {"leagues": null}
      if (leagues === null || leagues === undefined) {
        return [];
      }
      
      if (Array.isArray(leagues)) {
        return leagues;
      }
      
      // leagues is neither array nor null/undefined - invalid
      console.warn('[API] Unexpected leagues type:', typeof leagues);
      return [];
    }
    
    // Unknown shape
    console.warn('[API] Unexpected response shape from /leagues/me:', data);
    return [];
  } catch (error) {
    // Robust cancel detection - don't log as error
    if (isCancelError(error)) {
      // Expected cancellation, re-throw silently
      throw error;
    }
    
    // Real error - re-throw for caller to handle
    throw error;
  }
}

/**
 * Create a new league
 * 
 * @param {Object} leagueData - League details
 * @param {string} leagueData.name - League name (required)
 * @returns {Promise<Object>} Created league object
 */
export async function createLeague(leagueData) {
  const response = await api.post('/leagues/', leagueData);
  return response.data;
}

/**
 * Get league by ID
 * 
 * @param {string} leagueId - League ID
 * @returns {Promise<Object>} League object
 */
export async function getLeague(leagueId) {
  const response = await api.get(`/leagues/${leagueId}`);
  return response.data;
}

/**
 * Update league
 * 
 * @param {string} leagueId - League ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated league object
 */
export async function updateLeague(leagueId, updates) {
  const response = await api.put(`/leagues/${leagueId}`, updates);
  return response.data;
}

/**
 * Delete league
 * 
 * @param {string} leagueId - League ID
 * @returns {Promise<void>}
 */
export async function deleteLeague(leagueId) {
  await api.delete(`/leagues/${leagueId}`);
}

/**
 * Join league with invite code
 * 
 * @param {string} inviteCode - League invite code
 * @returns {Promise<Object>} League object
 */
export async function joinLeague(inviteCode) {
  const response = await api.post('/leagues/join', { code: inviteCode });
  return response.data;
}

