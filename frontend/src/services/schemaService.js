console.log('Loading schemaService.js');

import api from '../lib/api';

/**
 * Fetch the event schema for a given event ID
 * @param {string} eventId - The event ID to fetch schema for
 * @returns {Promise<Object|null>} Event schema object with drills array, or null if not found
 */
export async function fetchEventSchema(eventId) {
  if (!eventId) {
    console.warn('fetchEventSchema: No eventId provided');
    return null;
  }

  try {
    const response = await api.get(`/events/${eventId}/schema`);
    return response.data || null;
  } catch (error) {
    console.error('Failed to fetch event schema:', error);
    return null;
  }
}

/**
 * Get drills for a specific event using the event schema
 * @param {string} eventId - The event ID to get drills for
 * @returns {Promise<Array>} Array of drill objects for the event
 */
export async function getDrillsForEvent(eventId) {
  const schema = await fetchEventSchema(eventId);
  return schema?.drills || [];
}
