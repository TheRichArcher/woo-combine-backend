import api from '../lib/api';

export const eventService = {
  // Create a new event
  createEvent: (leagueId, eventData) => {
    return api.post(`/leagues/${leagueId}/events`, eventData);
  },

  // Update an existing event
  updateEvent: (leagueId, eventId, eventData) => {
    return api.put(`/leagues/${leagueId}/events/${eventId}`, eventData);
  },

  // Get event details
  getEvent: (leagueId, eventId) => {
    return api.get(`/leagues/${leagueId}/events/${eventId}`);
  },

  // Delete an event
  deleteEvent: (leagueId, eventId) => {
    // TODO: Backend needs to implement DELETE /leagues/{leagueId}/events/{eventId}
    return api.delete(`/leagues/${leagueId}/events/${eventId}`);
  },

  // Get all events for a league
  getLeagueEvents: (leagueId) => {
    return api.get(`/leagues/${leagueId}/events`);
  }
};

export default eventService; 