import api from '../lib/api';

export const eventService = {
  // Create a new event
  createEvent: (leagueId, eventData) => {
    return api.post(`/leagues/${leagueId}/events`, eventData);
  },

  // Update an existing event
  updateEvent: (eventId, eventData) => {
    return api.put(`/events/${eventId}`, eventData);
  },

  // Get event details
  getEvent: (eventId) => {
    return api.get(`/events/${eventId}`);
  },

  // Delete an event
  deleteEvent: (eventId) => {
    return api.delete(`/events/${eventId}`);
  }
};

export default eventService; 