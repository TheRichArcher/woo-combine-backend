console.log('Loading leagueService.js');

import api from '../lib/api';

export const leagueService = {
  // Get user's leagues
  getUserLeagues: () => {
    return api.get('/leagues/me');
  },

  // Create a new league
  createLeague: (leagueData) => {
    return api.post('/leagues', leagueData);
  },

  // Join a league - FIX: Use URL path parameter structure that backend expects
  joinLeague: (leagueCode, role = 'coach') => {
    const payload = { role };
    return api.post(`/leagues/join/${leagueCode}`, payload);
  },

  // Get league events
  getLeagueEvents: (leagueId) => {
    return api.get(`/leagues/${leagueId}/events`);
  },

  // Get league details
  getLeague: (leagueId) => {
    return api.get(`/leagues/${leagueId}`);
  }
};

export default leagueService; 