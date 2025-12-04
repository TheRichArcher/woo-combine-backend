import api from '../lib/api';

export const playerService = {
  // Get all players for an event
  getPlayers: (eventId) => {
    return api.get(`/players?event_id=${eventId}`);
  },

  // Create a new player
  createPlayer: (eventId, playerData) => {
    return api.post(`/players?event_id=${eventId}`, playerData);
  },

  // Update an existing player
  updatePlayer: (playerId, eventId, playerData) => {
    return api.put(`/players/${playerId}?event_id=${eventId}`, playerData);
  },

  // Upload multiple players via CSV
  uploadPlayers: (payload) => {
    return api.post('/players/upload', payload);
  },

  // Reset all players for an event
  resetPlayers: (eventId) => {
    return api.delete(`/players/reset?event_id=${eventId}`);
  },

  // Get player rankings
  getRankings: (eventId, ageGroup, weights = null) => {
    const params = new URLSearchParams({ 
      age_group: ageGroup, 
      event_id: eventId 
    });
    
    if (weights) {
      Object.entries(weights).forEach(([drill, weight]) => {
        params.append(`weight_${drill}`, weight);
      });
    }
    
    return api.get(`/rankings?${params.toString()}`);
  }
};

export default playerService; 